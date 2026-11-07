"""Verify an Actions-built Linux candidate; no retrieval, signing or publication."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
from part2_artifact_guard import ROOT, expected_source


def main():
    source=expected_source(os.environ['GITHUB_SHA'],check_remote=True)
    subprocess.run(['git','merge-base','--is-ancestor','388980c5ebd12746ebc19274fbf5f7c12e35e396',source],cwd=ROOT,check=True)
    spec=importlib.util.spec_from_file_location('linux_guard',ROOT/'scripts/verify-part2-appimage.py')
    guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
    package=ROOT/'release'/guard.NAME
    with package.open('rb') as stream:
        header=stream.read(20);stream.seek(0);checksum=hashlib.file_digest(stream,'sha256').hexdigest()
    if header[:6]!=b'\x7fELF\x02\x01' or header[18:20]!=b'\x3e\x00':raise ValueError('Not a Linux x86_64 AppImage')
    package.chmod(0o755)
    extracted=ROOT/'build/checked-appimage';extracted.mkdir(parents=True,exist_ok=True)
    subprocess.run([str(package),'--appimage-extract'],cwd=extracted,stdout=subprocess.DEVNULL,check=True)
    count=guard.verify_extracted(extracted/'squashfs-root',source)
    out=ROOT/'manual-test-assets/appimage';out.mkdir(parents=True,exist_ok=True)
    target=out/guard.NAME
    try:os.link(package,target)
    except OSError:shutil.copy2(package,target)
    asset={'name':guard.NAME,'size':package.stat().st_size,'sha256':checksum}
    manifest={'kind':'appimage-test','source':source,'builtBy':'GitHub Actions','files':[asset],'nativeFilesVerified':count,'physicalGpuVerified':False}
    (out/'artifact-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/(guard.NAME+'.sha256')).write_text(f'{checksum}  {guard.NAME}\n')
    (out/'README.md').write_text(f'''# Linux-only test build — not a Release

Built by GitHub Actions from {source}, including native startup fixes from 388980c.
Includes CPU-native, CUDA and Vulkan; {count} native files verified. No GGUF or signing files.

After extracting the artifact ZIP, run in fish:

    sha256sum -c {guard.NAME}.sha256
    chmod +x {guard.NAME}
    ./{guard.NAME}

Use an existing/imported GGUF. On RTX 4060 compare GPU/Auto/CPU at five GPU layers and context 2048. Inspect nativeAttempts (binary, stage, exit, filtered stderr, requested/observed layers). Only successful tokens and observed offload confirm GPU inference. The Actions host has no physical NVIDIA inference validation. No APK, tag, Release or driver changes are part of this job.
''')
    expected_source(source,check_remote=True)
    print(json.dumps(manifest),flush=True)
    with open(os.environ.get('GITHUB_STEP_SUMMARY',os.devnull),'a') as summary:
        summary.write(f"\nSource: `{source}`\n\nAppImage: {asset['size']} bytes\n\nSHA-256: `{checksum}`\n\nNative files verified: {count}. Physical GPU inference remains unverified.\n")


if __name__=='__main__':main()
