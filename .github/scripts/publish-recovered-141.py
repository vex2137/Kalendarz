#!/usr/bin/env python3
"""Restore pinned 1.4.1 binaries; publish only after downloading every draft asset."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

REPOSITORY = "vex2137/Kalendarz"
TAG = "v1.4.1"
SOURCE_BASE = "1ea6f9ed19ce08964b72a1723a6a8855d9150757"
APK_COMMIT = "7f55cdabc9baaea2f752fe60f551ff98f509b7c1"
PACKAGES_COMMIT = "f3de8e05e63b4fe565b515979b6adaa2e3b18545"
MAX_PART = 40 * 1024 * 1024
PACKAGES = {
    "KALENDARZ-1.4.1-ANDROID.apk": (24005277, "d187778c9185af75dfc8c61d8436fe1412e8f0c5c6f85a2cbc5abe8e633a5c89"),
    "KALENDARZ-1.4.1-linux-x86_64.AppImage": (165035840, "1dd853fc8e64d62337ad0dcee7119a34d7c07b969d8c979ce8f0f01a0564d7ad"),
    "KALENDARZ-1.4.1-WINDOWS-x86_64.exe": (117048817, "ed39c29581b232ec195a77a7de9601b053b8605340bcef822ca86aa3069be0d3"),
    "KALENDARZ-1.4.1-WEB.zip": (6954776, "029906228d815547c24ec5b11709dcb755725baf2ab70a440d95be71790cd8da"),
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(arguments, **options):
    return subprocess.run(arguments, check=True, **options)


def git(*arguments):
    return subprocess.check_output(["git", *arguments], text=True).strip()


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def verify_file(path, size, digest):
    require(path.is_file() and not path.is_symlink(), f"Missing regular file: {path.name}")
    require(path.stat().st_size == size, f"Size mismatch: {path.name}")
    require(sha256(path) == digest, f"SHA-256 mismatch: {path.name}")


def parse_manifest(text):
    result = {}
    for line in text.splitlines():
        match = re.fullmatch(r"([a-f0-9]{64})  ([A-Za-z0-9_.-]+)", line)
        require(match is not None, "Invalid transport checksum manifest")
        digest, name = match.groups()
        require(name not in result, "Duplicate transport checksum entry")
        result[name] = digest
    return result


def original_manifest():
    return "".join(f"{digest}  {name}\n" for name, (_, digest) in sorted(PACKAGES.items()))


def verify_source(source):
    require(re.fullmatch(r"[a-f0-9]{40}", source) is not None, "Invalid source commit")
    require(git("rev-parse", "HEAD") == source, "Checkout does not match the release source")
    run(["git", "merge-base", "--is-ancestor", SOURCE_BASE, source])
    changed = git("diff", "--name-only", SOURCE_BASE, source).splitlines()
    require(all(path.startswith((".github/", "docs/")) or path in {
        "README.md", "README.pl.md", "README_ANDROID_APK.md", "CHANGELOG.md"
    } for path in changed), "Application source differs from the verified 1.4.1 packages")
    require(json.loads(Path("package.json").read_text())["version"] == "1.4.1", "Source is not version 1.4.1")
    require(not git("status", "--porcelain", "--untracked-files=no"), "Tracked release source is dirty")


def ensure_commit(commit):
    exists = subprocess.run(["git", "cat-file", "-e", commit + "^{commit}"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if exists.returncode:
        # Fetch the immutable commit, never the recovery branch name.
        run(["git", "fetch", "--no-tags", "--depth=1", "origin", commit])
    require(git("rev-parse", commit + "^{commit}") == commit, "Recovery commit mismatch")


def extract_blob(commit, name, destination):
    require(destination.name == name, "Unsafe artifact path")
    with destination.open("xb") as output:
        run(["git", "show", f"{commit}:{name}"], stdout=output)


def restore_parts(directory, name, size, digest, entries):
    count = (size + MAX_PART - 1) // MAX_PART
    target = directory / name
    with target.open("xb") as output:
        for number in range(1, count + 1):
            part_name = name + f".part{number:03}"
            part_size = min(MAX_PART, size - (number - 1) * MAX_PART)
            require(part_name in entries, f"Missing transport manifest entry: {part_name}")
            part = directory / part_name
            verify_file(part, part_size, entries[part_name])
            with part.open("rb") as stream:
                shutil.copyfileobj(stream, output, 1024 * 1024)
    verify_file(target, size, digest)


def evidence(directory, **fields):
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "release-evidence.json"
    previous = json.loads(path.read_text()) if path.exists() else {}
    previous.update(fields)
    path.write_text(json.dumps(previous, indent=2) + "\n")


def prepare(source, directory):
    verify_source(source)
    evidence(directory, state="preparing", sourceCommit=source, sourceBase=SOURCE_BASE,
             apkRecoveryCommit=APK_COMMIT, packagesRecoveryCommit=PACKAGES_COMMIT)
    ensure_commit(APK_COMMIT)
    ensure_commit(PACKAGES_COMMIT)
    # A previous verified preparation may be reused, but never partially overwritten.
    output = directory / "packages"
    require(not output.exists(), "Use a fresh preparation directory")
    output.mkdir()
    with tempfile.TemporaryDirectory(prefix="transport-", dir=directory) as temporary:
        transport = Path(temporary)
        apk = "KALENDARZ-1.4.1-ANDROID.apk"
        extract_blob(APK_COMMIT, apk, output / apk)
        entries = parse_manifest(git("show", PACKAGES_COMMIT + ":PARTS-SHA256SUMS.txt"))
        expected_names = {"KALENDARZ-1.4.1-WEB.zip"}
        for name in ("KALENDARZ-1.4.1-linux-x86_64.AppImage", "KALENDARZ-1.4.1-WINDOWS-x86_64.exe"):
            size, _ = PACKAGES[name]
            expected_names.update(name + f".part{n:03}" for n in range(1, (size + MAX_PART - 1) // MAX_PART + 1))
        require(set(entries) == expected_names, "Unexpected or missing transport files")
        for name in sorted(entries):
            extract_blob(PACKAGES_COMMIT, name, transport / name)
        for name in ("KALENDARZ-1.4.1-linux-x86_64.AppImage", "KALENDARZ-1.4.1-WINDOWS-x86_64.exe"):
            restore_parts(transport, name, *PACKAGES[name], entries)
            shutil.move(str(transport / name), output / name)
        web = "KALENDARZ-1.4.1-WEB.zip"
        verify_file(transport / web, *PACKAGES[web])
        require(entries[web] == PACKAGES[web][1], "Web transport checksum mismatch")
        shutil.move(str(transport / web), output / web)
    records = []
    for name, (size, digest) in PACKAGES.items():
        verify_file(output / name, size, digest)
        records.append({"file": name, "bytes": size, "sha256": digest})
        print(f"VERIFIED {name}: {size} bytes, SHA-256 {digest}", flush=True)
    (output / "KALENDARZ-1.4.1-linux-x86_64.AppImage").chmod(0o755)
    (output / "SHA256SUMS.txt").write_text(original_manifest())
    evidence(directory, state="prepared", packages=records, originalChecksumsVerified=True)


def api(method, endpoint, payload=None, missing=False):
    command = ["gh", "api", "--method", method, f"repos/{REPOSITORY}/{endpoint}"]
    if payload is not None:
        command += ["--input", "-"]
    response = subprocess.run(command, input=json.dumps(payload) if payload is not None else None,
                              capture_output=True, text=True)
    if response.returncode:
        if missing and "HTTP 404" in response.stderr:
            return None
        raise RuntimeError(f"GitHub {method} {endpoint} failed: {response.stderr.strip()}")
    return json.loads(response.stdout) if response.stdout.strip() else None


def tag_commit():
    ref = api("GET", f"git/ref/tags/{TAG}", missing=True)
    if ref is None:
        return None
    obj = ref["object"]
    for _ in range(4):
        if obj["type"] == "commit":
            return obj["sha"]
        require(obj["type"] == "tag", "Unexpected release tag object")
        obj = api("GET", f"git/tags/{obj['sha']}")["object"]
    raise RuntimeError("Release tag nesting is invalid")


def expected_assets(directory):
    assets = dict(PACKAGES)
    manifest = directory / "packages" / "SHA256SUMS.txt"
    require(manifest.read_text() == original_manifest(), "Original checksum manifest changed")
    assets[manifest.name] = (manifest.stat().st_size, sha256(manifest))
    return assets


def check_asset_metadata(release, assets, complete=True):
    actual = release["assets"]
    names = [asset["name"] for asset in actual]
    require(len(names) == len(set(names)), "Duplicate release asset names")
    require(set(names) <= set(assets), "Unexpected asset in v1.4.1; refusing to overwrite it")
    if complete:
        require(set(names) == set(assets), "The draft does not contain all five release assets")
    for asset in actual:
        size, digest = assets[asset["name"]]
        require(asset["state"] == "uploaded" and asset["size"] == size, f"Incomplete asset: {asset['name']}")
        if asset.get("digest"):
            require(asset["digest"] == "sha256:" + digest, f"GitHub asset digest mismatch: {asset['name']}")


def verify_downloads(release, assets, directory):
    check_asset_metadata(release, assets)
    records = []
    with tempfile.TemporaryDirectory(prefix="draft-download-", dir=directory) as temporary:
        downloaded = Path(temporary)
        for asset in release["assets"]:
            name = asset["name"]
            run(["gh", "release", "download", TAG, "--repo", REPOSITORY,
                 "--pattern", name, "--dir", str(downloaded)])
            verify_file(downloaded / name, *assets[name])
            records.append({"file": name, "bytes": assets[name][0], "sha256": assets[name][1],
                            "assetId": asset["id"], "url": asset["browser_download_url"]})
            print(f"DRAFT DOWNLOAD VERIFIED: {name}", flush=True)
    return records


def publish(source, directory):
    require(os.environ.get("GITHUB_ACTIONS") == "true", "Publication is permitted only on GitHub Actions")
    require(os.environ.get("GITHUB_REPOSITORY") == REPOSITORY, "Unexpected Actions repository")
    require(os.environ.get("GITHUB_REF") == "refs/heads/main", "Publish only the integrated main source")
    require(os.environ.get("GITHUB_SHA") == source, "Unexpected Actions source commit")
    require(bool(os.environ.get("GH_TOKEN")), "Missing runner GITHUB_TOKEN")
    verify_source(source)
    assets = expected_assets(directory)
    for name, spec in assets.items():
        verify_file(directory / "packages" / name, *spec)
    require(api("GET", "git/ref/heads/main")["object"]["sha"] == source,
            "main advanced after this run; review the new source before publishing")
    current_tag = tag_commit()
    require(current_tag in (None, source), "v1.4.1 already points at a different commit; never move it")
    if current_tag is None:
        api("POST", "git/refs", {"ref": "refs/tags/" + TAG, "sha": source})
    require(tag_commit() == source, "Release tag does not identify the integrated 1.4.1 source")
    notes = Path(".github/release-notes/v1.4.1.md").read_text()
    release = api("GET", f"releases/tags/{TAG}", missing=True)
    if release is None:
        release = api("POST", "releases", {"tag_name": TAG, "target_commitish": source,
            "name": "KALENDARZ 1.4.1", "body": notes, "draft": True, "prerelease": False})
    require(not release["prerelease"], "Unexpected prerelease state")
    check_asset_metadata(release, assets, complete=False)
    evidence(directory, state="draft" if release["draft"] else "checking-existing-release",
             releaseId=release["id"], releaseUrl=release["html_url"], tag=TAG, tagCommit=source)
    if release["draft"]:
        existing = {asset["name"] for asset in release["assets"]}
        for name in assets:
            if name not in existing:
                run(["gh", "release", "upload", TAG, str(directory / "packages" / name), "--repo", REPOSITORY])
    release = api("GET", f"releases/{release['id']}")
    downloads = verify_downloads(release, assets, directory)
    evidence(directory, state="draft-verified" if release["draft"] else "existing-assets-verified",
             assetDownloads=downloads, draftAssetsDownloadedAndHashed=True)
    require(tag_commit() == source, "Tag changed during draft verification")
    if release["draft"]:
        release = api("PATCH", f"releases/{release['id']}", {"draft": False, "prerelease": False,
            "make_latest": "true", "name": "KALENDARZ 1.4.1", "body": notes})
    # A rerun never demotes or overwrites a newer public release.
    latest = api("GET", "releases/latest")
    release = api("GET", f"releases/{release['id']}")
    require(not release["draft"] and not release["prerelease"], "Release is not publicly stable")
    require(latest["id"] == release["id"] and latest["tag_name"] == TAG, "v1.4.1 is not Latest")
    check_asset_metadata(release, assets)
    require(tag_commit() == source, "Published tag does not match verified source")
    evidence(directory, state="published", published=True, latest=True,
             publishedAt=release["published_at"], releaseUrl=release["html_url"])
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
            summary.write(f"## KALENDARZ 1.4.1 published and verified\n\n{release['html_url']}\n\n"
                          f"Source/tag: `{source}`. All five assets were downloaded and hashed before publication. Latest confirmed.\n")
    print("PUBLISHED AND VERIFIED: " + release["html_url"], flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["prepare", "publish"])
    parser.add_argument("--source-commit", required=True)
    parser.add_argument("--directory", type=Path, required=True)
    args = parser.parse_args()
    try:
        globals()[args.command](args.source_commit, args.directory)
    except Exception as error:
        message = str(error)
        for name in ("GH_TOKEN", "GITHUB_TOKEN"):
            value = os.environ.get(name)
            if value:
                message = message.replace(value, "[redacted]")
        evidence(args.directory, state="failed", failedStage=args.command, error=message[:2000])
        print("RELEASE NOT VERIFIED: " + message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
