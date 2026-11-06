"""Reuse the unchanged pinned native runtime from the verified previous Beta 2 APK.

Only the executable and its redistribution notices are staged. Application code,
signatures and GGUF weights are never copied into a new candidate.
"""
import hashlib
import json
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APK_SHA256 = "9ce239d51d3703aad2d69cb5773bdef7e79f6f3dc32b1bb0eea97d2f75756605"
APK_BYTES = 24023506
RUNTIME_SHA256 = "e71d0e57a398c5dc0f158f04162388847e5cba82112a89de2c9cfb375dc0bd5b"
RUNTIME_COMMIT = "620d2225cc436ab0b001e3200e590e3b286ef9ab"


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    cache = ROOT / "build/recovered-runtime"
    cache.mkdir(parents=True, exist_ok=True)
    apk = cache / "previous-beta2.apk"
    if not apk.is_file() or apk.stat().st_size != APK_BYTES or digest(apk) != APK_SHA256:
        pointer = f"version https://git-lfs.github.com/spec/v1\noid sha256:{APK_SHA256}\nsize {APK_BYTES}\n"
        partial = apk.with_suffix(".partial")
        with partial.open("wb") as stream:
            result = subprocess.run(["git", "lfs", "smudge"], cwd=ROOT,
                                    input=pointer.encode(), stdout=stream, stderr=subprocess.PIPE)
        if result.returncode:
            partial.unlink(missing_ok=True)
            raise SystemExit("The verified previous APK transfer object is unavailable; use the pinned native build script.")
        if partial.stat().st_size != APK_BYTES or digest(partial) != APK_SHA256:
            partial.unlink(missing_ok=True)
            raise SystemExit("Previous APK size/checksum verification failed.")
        partial.replace(apk)
    with zipfile.ZipFile(apk) as archive:
        manifest = json.loads(archive.read("assets/android-native-runtime.json"))
        if manifest.get("llamaCommit") != RUNTIME_COMMIT or manifest.get("binarySha256") != RUNTIME_SHA256:
            raise SystemExit("Previous APK does not contain the pinned native runtime.")
        binary = archive.read("lib/arm64-v8a/libcalendar_llama.so")
        if hashlib.sha256(binary).hexdigest() != RUNTIME_SHA256:
            raise SystemExit("Native executable checksum verification failed.")
        output = ROOT / "build/android-jni/arm64-v8a/libcalendar_llama.so"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(binary)
        notices = ROOT / "build/android-native-assets"
        for name in archive.namelist():
            if not name.startswith("assets/") or not (
                "license" in name.lower() or name.endswith("android-native-runtime.json")
            ):
                continue
            relative = Path(name.removeprefix("assets/"))
            if relative.is_absolute() or ".." in relative.parts:
                raise SystemExit("Invalid notice path in previous APK.")
            target = notices / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    print("Recovered checksum-verified arm64-v8a b11669 executable and notices; physical GPU inference remains unverified.")


if __name__ == "__main__":
    main()
