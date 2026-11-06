"""Verify a newly built manual APK candidate without publishing or signing it."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import zipfile
from pathlib import Path

CERT = "ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143"
RUNTIME_SHA256 = "e71d0e57a398c5dc0f158f04162388847e5cba82112a89de2c9cfb375dc0bd5b"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("apk", type=Path)
    parser.add_argument("--source", required=True)
    parser.add_argument("--build-tools", type=Path)
    args = parser.parse_args()
    if not re.fullmatch("[a-f0-9]{40}", args.source):
        parser.error("--source requires an exact application commit")
    tools = args.build_tools
    if tools is None:
        sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
        if not sdk:
            parser.error("--build-tools or ANDROID_HOME is required")
        tools = sorted((Path(sdk) / "build-tools").glob("*/apksigner"))[-1].parent

    def run(*command):
        return subprocess.check_output(list(map(str, command)), text=True)

    certs = run(tools / "apksigner", "verify", "--verbose", "--print-certs", args.apk)
    if "certificate SHA-256 digest: " + CERT not in certs:
        raise SystemExit("Candidate does not preserve the installed diagnostics signing certificate.")
    badging = run(tools / "aapt", "dump", "badging", args.apk)
    if "name='com.kalendarz.offline.diagnostics' versionCode='10513' versionName='1.5.0-part2-beta.2'" not in badging:
        raise SystemExit("Candidate Android identity/version is incorrect.")
    run(tools / "zipalign", "-c", "-P", "16", "4", args.apk)
    with zipfile.ZipFile(args.apk) as archive:
        if archive.testzip() is not None:
            raise SystemExit("Candidate APK ZIP is corrupt.")
        if any(name.lower().endswith((".gguf", ".jks", ".p12", ".keystore")) for name in archive.namelist()):
            raise SystemExit("A model weight or signing file was included in the candidate.")
        info = json.loads(archive.read("assets/public/build-info.json"))
        if info.get("commit") != args.source or info.get("dirty") or info.get("bundledModel") is not False or info.get("androidNative") is not True or info.get("distribution") != "model-free":
            raise SystemExit("Candidate frontend provenance is incorrect or dirty.")
        binary = archive.read("lib/arm64-v8a/libcalendar_llama.so")
        if hashlib.sha256(binary).hexdigest() != RUNTIME_SHA256:
            raise SystemExit("Candidate does not contain the verified pinned native executable.")
        if binary[:6] != b"\x7fELF\x02\x01" or binary[18:20] != b"\xb7\x00":
            raise SystemExit("Candidate native executable is not ELF64 AArch64.")
    with args.apk.open("rb") as stream:
        checksum = hashlib.file_digest(stream, "sha256").hexdigest()
    args.apk.with_name(args.apk.name + ".sha256").write_text(f"{checksum}  {args.apk.name}\n")
    print(json.dumps({"file": args.apk.name, "bytes": args.apk.stat().st_size,
                      "sha256": checksum, "source": args.source,
                      "package": "com.kalendarz.offline.diagnostics", "versionCode": 10513,
                      "certificateSha256": CERT}, indent=2))


if __name__ == "__main__":
    main()
