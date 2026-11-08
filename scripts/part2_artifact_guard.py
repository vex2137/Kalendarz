"""Fail-closed provenance/version checks for Part 2 manual candidates; no builds."""
import argparse
import json
import os
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "feat/1.5.0-part2"


def run(*args):
    return subprocess.check_output(list(map(str, args)), cwd=ROOT, text=True, timeout=30).strip()


def version_policy():
    policy = json.loads((ROOT / "scripts/part2-beta2-version.json").read_text())
    code, previous = policy["versionCode"], policy["lastTestedVersionCode"]
    if type(code) is not int or type(previous) is not int or previous < 10514 or code < 10515 or code <= previous:
        raise ValueError("Candidate versionCode must be >=10515 and greater than the last tested code")
    return code


def expected_source(source, check_remote=False):
    if not re.fullmatch(r"[a-f0-9]{40}", source or "") or source != run("git", "rev-parse", "HEAD"):
        raise ValueError("Expected application commit must equal the exact checkout HEAD")
    if os.environ.get("GITHUB_SHA", source) != source:
        raise ValueError("Workflow commit differs from the expected application commit")
    if run("git", "status", "--porcelain", "--untracked-files=no"):
        raise ValueError("Tracked checkout changes are not allowed in manual candidates")
    if check_remote:
        remote = run("git", "ls-remote", "origin", "refs/heads/" + BRANCH).split()
        if not remote or remote[0] != source:
            raise ValueError("Expected application commit is no longer the remote branch HEAD")
    version_policy()
    return source


def verify_info(info, source, android):
    if (info.get("commit") != source or info.get("dirty") is not False or
            info.get("version") != "1.5.0" or info.get("distribution") != "model-free" or
            info.get("bundledModel") is not False or info.get("androidNative") is not android):
        raise ValueError("Package build-info does not match the expected clean application commit/distribution")


def verify_android_identity(badging):
    expected = ("name='com.kalendarz.offline.diagnostics' "
                f"versionCode='{version_policy()}' versionName='1.5.0-part2-beta.2'")
    if expected not in badging:
        raise ValueError("Candidate Android identity/versionCode is incorrect")


def verify_manifest(manifest, source):
    if manifest.get("source") != source or manifest.get("versionCode") != version_policy():
        raise ValueError("Artifact manifest source/versionCode must match this application checkout")
    files = manifest.get("files", [])
    names = {"Kalendarz-1.5.0-Part-2-Beta-2.apk", "Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage"}
    if len(files) != 2 or {item.get("name") for item in files} != names:
        raise ValueError("Both APK and AppImage are required in the same verified artifact set")
    for item in files:
        if (type(item.get("size")) is not int or item["size"] <= 0 or
                not re.fullmatch(r"[a-f0-9]{64}", item.get("sha256", ""))):
            raise ValueError("Each artifact requires an exact byte size and SHA-256")
    return files


def asar_build_info(archive):
    # ASAR's two Pickle headers precede its JSON directory and file data.
    with archive.open("rb") as stream:
        prefix = stream.read(16)
        _, header_size, _, json_size = struct.unpack("<4I", prefix)
        if not 0 < json_size <= header_size <= 16 * 1024 * 1024:
            raise ValueError("Invalid ASAR header")
        entry = json.loads(stream.read(json_size))
        for name in ("dist", "build-info.json"):
            entry = entry["files"][name]
        if entry.get("unpacked") or not 0 < entry["size"] <= 65536:
            raise ValueError("Invalid ASAR build-info entry")
        stream.seek(8 + header_size + int(entry["offset"]))
        return json.loads(stream.read(entry["size"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--check-remote", action="store_true")
    parser.add_argument("--info", type=Path)
    parser.add_argument("--platform", choices=("android", "desktop"))
    args = parser.parse_args()
    expected_source(args.source, args.check_remote)
    if args.info:
        if not args.platform:
            parser.error("--info requires --platform")
        verify_info(json.loads(args.info.read_text()), args.source, args.platform == "android")
    print(json.dumps({"source": args.source, "versionCode": version_policy()}))


if __name__ == "__main__":
    main()
