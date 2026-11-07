"""Inspect actual extracted Linux runtimes; no model download or GPU inference."""
import json
import os
import re
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
def validate_version(output,pin):
    match=re.search(r'build\s+(\d+),\s*commit\s+([a-f0-9]{7,40})\b',output)
    if not match or match[1]!=pin['version'][1:] or not pin['commit'].startswith(match[2]):
        raise ValueError('Wrong native binary version: '+output.strip())


def main():
    native=ROOT/'build/checked-appimage/squashfs-root/resources/native'
    pin=json.loads((ROOT/'scripts/native-runtime-manifest.json').read_text())['overrides']['linux-x64']
    manifest=json.loads((native/'runtime-manifest.json').read_text())
    if manifest['commit']!=pin['commit'] or manifest['version']!=pin['version']:
        raise ValueError('Stale or mixed native runtime')
    result={'commit':pin['commit'],'version':pin['version'],'physicalGpuVerified':False,'backends':{}}
    for backend in ['cpu','cuda','vulkan']:
        directory=native/backend
        env={**os.environ,'LD_LIBRARY_PATH':str(directory)}
        version=subprocess.run([str(directory/'llama-server'),'--version'],env=env,text=True,capture_output=True,timeout=20,check=True)
        output=version.stdout+version.stderr
        validate_version(output,pin)
        libraries={}
        for file in directory.iterdir():
            if file.name!='llama-server' and '.so' not in file.name:continue
            if file.name.endswith('.txt'):continue
            check=subprocess.run(['ldd',str(file)],env=env,text=True,capture_output=True,timeout=20)
            dependencies=check.stdout+check.stderr
            if check.returncode or 'not found' in dependencies:
                # The NVIDIA driver belongs to the user's OS, not the package.
                # CUDA runtime/cuBLAS must be bundled; do not require a driver here.
                missing=[line.strip() for line in dependencies.splitlines() if 'not found' in line]
                if check.returncode or not missing or any(not line.startswith('libcuda.so.1 ') for line in missing):
                    raise ValueError('Unresolved dependency: '+backend+'/'+file.name+' '+dependencies)
            libraries[file.name]='checked'
        result['backends'][backend]={'versionOutput':output.strip(),'librariesChecked':len(libraries)}
    out=ROOT/'manual-test-assets/appimage/native-runtime-check.json'
    out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result),flush=True)


if __name__=='__main__':main()
