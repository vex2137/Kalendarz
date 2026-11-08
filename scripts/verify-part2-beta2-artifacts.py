"""Retrieve a matching APK/AppImage pair; never build, sign or publish a release."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
from part2_artifact_guard import ROOT, asar_build_info, expected_source, verify_info, verify_manifest


def main():
    source = expected_source(os.environ["GITHUB_SHA"], check_remote=True)
    manifest = json.loads(os.environ["CALENDAR_ARTIFACT_MANIFEST"])
    files = verify_manifest(manifest, source)
    spec = importlib.util.spec_from_file_location("apk_candidate", ROOT / "scripts/verify-part2-beta2-candidate.py")
    candidate = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(candidate)
    tools = sorted((Path(os.environ["ANDROID_HOME"]) / "build-tools").glob("*/apksigner"))[-1].parent
    out = ROOT / "manual-test-assets"
    notes = (ROOT / "docs/PART2-BETA2-MANUAL-TESTS.md").read_text()
    for asset in files:
        android = asset["name"].endswith(".apk")
        directory = out / ("android" if android else "linux")
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / asset["name"]
        pointer = f"version https://git-lfs.github.com/spec/v1\noid sha256:{asset['sha256']}\nsize {asset['size']}\n"
        with target.open("wb") as stream:
            result = subprocess.run(["git", "lfs", "smudge"], cwd=ROOT, input=pointer.encode(), stdout=stream, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError("Transfer object unavailable or unauthorized")
        with target.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != asset["sha256"] or target.stat().st_size != asset["size"]:
                raise ValueError("Artifact checksum/size mismatch")
        if android:
            candidate.verify_apk(target, source, tools)
        else:
            with target.open("rb") as stream:
                header = stream.read(20)
            if header[:4] != b"\x7fELF" or header[18:20] != b"\x3e\x00":
                raise ValueError("AppImage must be an x86_64 ELF")
            target.chmod(0o755)
            with tempfile.TemporaryDirectory() as directory_name:
                subprocess.run([str(target), "--appimage-extract", "resources/app.asar"],
                               cwd=directory_name, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                info = asar_build_info(Path(directory_name) / "squashfs-root/resources/app.asar")
                verify_info(info, source, android=False)
        (directory / (asset["name"] + ".sha256")).write_text(f"{asset['sha256']}  {asset['name']}\n")
        (directory / "README.md").write_text(notes)
        (directory / "artifact-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
        print("Verified manual-test asset:", asset["name"], "source:", source)
    # Recheck after transfer/extraction in case another change reached the branch.
    expected_source(source, check_remote=True)


if __name__ == "__main__":
    main()
