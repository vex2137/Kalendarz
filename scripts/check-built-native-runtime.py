"""Inspect actual extracted Linux runtimes; no model download or GPU inference."""
import json
import os
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
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
    if pin['version'][1:] not in output or pin['commit'][:10] not in output:
        raise ValueError('Wrong native binary version: '+backend)
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
