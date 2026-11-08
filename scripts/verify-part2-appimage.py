"""Explicit Linux-only manual-test path; the paired APK/AppImage guard is unchanged."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from part2_artifact_guard import ROOT, asar_build_info, expected_source, verify_info

def appimage_name(beta=None):
    beta=os.environ.get('CALENDAR_TEST_APPIMAGE_BETA','2') if beta is None else beta
    if beta not in ('2','3','4','5'):raise ValueError('Unsupported Linux test package label')
    return f'Kalendarz-1.5.0-Part-2-Beta-{beta}-x86_64.AppImage'


NAME = appimage_name()


def appimage_manifest(manifest, source):
    files=manifest.get('files',[])
    if manifest.get('kind')!='appimage-test' or manifest.get('source')!=source or len(files)!=1:
        raise ValueError('Linux-only tests require an explicit appimage-test manifest for the exact expected commit')
    asset=files[0]
    if (asset.get('name')!=NAME or type(asset.get('size')) is not int or asset['size']<20 or
            not re.fullmatch('[a-f0-9]{64}',asset.get('sha256',''))):
        raise ValueError('Exactly one named Linux AppImage with exact size/SHA-256 is required; no APK')
    return asset


def verify_extracted(appdir, source):
    verify_info(asar_build_info(appdir/'resources/app.asar'),source,android=False)
    # Inventory the actual ASAR as well as extraResources; metadata alone is not
    # evidence that weights or signing files were omitted.
    import struct
    with (appdir/'resources/app.asar').open('rb') as stream:
        json_size=struct.unpack('<4I',stream.read(16))[3]
        if not 0<json_size<=16*1024*1024:raise ValueError('Invalid ASAR directory')
        tree=json.loads(stream.read(json_size))
    def entries(node,prefix=''):
        for name,entry in node.get('files',{}).items():
            relative=prefix+name
            if 'files' in entry:yield from entries(entry,relative+'/')
            else:yield relative
    forbidden=('.gguf','.p12','.jks','.keystore')
    if any(name.lower().endswith(forbidden) for name in entries(tree)) or any(p.name.lower().endswith(forbidden) for p in appdir.rglob('*')):
        raise ValueError('Weights or signing files must not be included')
    native=appdir/'resources/native'
    meta=json.loads((native/'runtime-manifest.json').read_text())
    pinned=json.loads((ROOT/'scripts/native-runtime-manifest.json').read_text())
    if meta.get('commit')!=pinned.get('overrides',{}).get('linux-x64',pinned)['commit']:raise ValueError('Incorrect pinned native runtime commit')
    for backend in ['cpu','cuda','vulkan']:
        if f'{backend}/llama-server' not in meta['files']:raise ValueError('Missing required native backend: '+backend)
    for name,checksum in meta['files'].items():
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Invalid native manifest path')
        with (native/relative).open('rb') as stream:
            if hashlib.file_digest(stream,'sha256').hexdigest()!=checksum:raise ValueError('Native file checksum mismatch')
    return len(meta['files'])


def main():
    source=expected_source(os.environ['GITHUB_SHA'],check_remote=True)
    manifest=json.loads(os.environ['CALENDAR_ARTIFACT_MANIFEST'])
    asset=appimage_manifest(manifest,source)
    out=ROOT/'manual-test-assets/appimage';out.mkdir(parents=True,exist_ok=True)
    target=out/asset['name']
    pointer=f"version https://git-lfs.github.com/spec/v1\noid sha256:{asset['sha256']}\nsize {asset['size']}\n"
    with target.open('wb') as stream:
        result=subprocess.run(['git','lfs','smudge'],cwd=ROOT,input=pointer.encode(),stdout=stream,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError('Transfer object unavailable or unauthorized')
    with target.open('rb') as stream:
        header=stream.read(20);stream.seek(0)
        if hashlib.file_digest(stream,'sha256').hexdigest()!=asset['sha256'] or target.stat().st_size!=asset['size']:raise ValueError('AppImage size/checksum mismatch')
    if header[:6]!=b'\x7fELF\x02\x01' or header[18:20]!=b'\x3e\x00':raise ValueError('AppImage must be Linux x86_64 ELF')
    target.chmod(0o755)
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run([str(target),'--appimage-extract'],cwd=directory,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
        count=verify_extracted(Path(directory)/'squashfs-root',source)
    expected_source(source,check_remote=True)
    (out/(NAME+'.sha256')).write_text(f"{asset['sha256']}  {NAME}\n")
    (out/'artifact-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'README.md').write_text(f'''# Linux-only manual test — not a release

Source: {source}. Includes CPU, CUDA and Vulkan, without GGUF. Verified {count} native files.

After extracting this ZIP (fish-compatible):

    sha256sum -c {NAME}.sha256
    chmod +x {NAME}
    ./{NAME}

Use an installed model or import a trusted GGUF. Check context preferences, actual applied capacity, layers and GPU diagnostics. Cloud packaging/Xvfb smoke does not establish RTX 4060 offload. Require actual generated tokens and confirmed offload on CachyOS; do not change drivers/kernel. No APK is built or included. PR #20 stays Draft; no Release.
''')
    print(json.dumps({'source':source,'name':NAME,'size':asset['size'],'sha256':asset['sha256'],'nativeFilesVerified':count,'physicalGpuVerified':False}))


if __name__=='__main__':main()
