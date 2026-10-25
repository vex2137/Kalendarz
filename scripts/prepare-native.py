"""Stage pinned llama.cpp CPU/Vulkan runtimes; no user-side library downloads."""
import argparse
import hashlib
import json
from pathlib import Path
import os
import platform as host_platform
import shutil
import subprocess
import sys
import tarfile
import zipfile
from native_runtime_state import verified_cuda_state

ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--platform',default=sys.platform);parser.add_argument('--arch',default={'x86_64':'x64','AMD64':'x64','aarch64':'arm64'}.get(host_platform.machine(),host_platform.machine()));parser.add_argument('--output',default=str(ROOT/'native'));args=parser.parse_args()
platform={'win32':'win','linux':'linux','darwin':'mac'}.get(args.platform,args.platform)
key=platform+'-'+args.arch;meta=json.loads((ROOT/'scripts/native-runtime-manifest.json').read_text())
if key not in meta['targets']:raise SystemExit('Unsupported native runtime target: '+key+'')
output=Path(args.output)/key;output.mkdir(parents=True,exist_ok=True)
cache=Path(os.environ.get('CALENDAR_NATIVE_ARCHIVE_DIR',str(ROOT/'native/downloads')));cache.mkdir(parents=True,exist_ok=True)
def digest(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
files,cuda_sources=verified_cuda_state(output,meta['commit'])
for backend,asset in meta['targets'][key].items():
 directory=output/backend;shutil.rmtree(directory,ignore_errors=True);directory.mkdir()
 archive=cache/asset['file']
 if not archive.exists() or archive.stat().st_size!=asset['bytes'] or digest(archive)!=asset['sha256']:
  temp=archive.with_suffix(archive.suffix+'.partial')
  subprocess.run(['curl','--fail','--location','--retry','3','--max-time','300','--output',str(temp),asset['url']],check=True)
  assert temp.stat().st_size==asset['bytes'] and digest(temp)==asset['sha256'],'Native archive checksum mismatch'
  temp.replace(archive)
 # Copy only the server, its libraries and upstream notices. Flattened names are
 # whitelisted; never extract archive paths or symlinks onto the host filesystem.
 def wanted(name):
  base=Path(name).name
  return base in ['llama-server','llama-server.exe','LICENSE'] or ('.so' in base and base.startswith(('libllama-server-impl','libllama-common','libllama.so','libmtmd','libggml'))) or base.endswith('.dylib') or base.lower().endswith('.dll') or base.upper().startswith(('LICENSE','NOTICE'))
 if archive.name.endswith('.zip'):
  with zipfile.ZipFile(archive) as z:
   for info in z.infolist():
    if not info.is_dir() and wanted(info.filename):(directory/Path(info.filename).name).write_bytes(z.read(info))
 else:
  with tarfile.open(archive) as tar:
   for member in tar.getmembers():
    if wanted(member.name) and (member.isfile() or member.issym() or member.islnk()):
     source=tar.extractfile(member)
     if source:(directory/Path(member.name).name).write_bytes(source.read())
 if platform in ['linux','mac']:
  for file in directory.iterdir():file.chmod(0o755 if file.name=='llama-server' or '.so' in file.name or file.name.endswith('.dylib') else 0o644)
 if platform=='linux':
  # Ship non-glibc system dependencies rather than rely on undocumented host
  # installations. Preserve their distribution copyright/license notices.
  dependencies={'libssl.so.3':['libssl3t64','libssl3'],'libcrypto.so.3':['libssl3t64','libssl3'],'libgomp.so.1':['libgomp1'],'libz.so.1':['zlib1g'],'libzstd.so.1':['libzstd1']}
  if backend=='vulkan':dependencies['libvulkan.so.1']=['libvulkan1']
  for soname,packages in dependencies.items():
   candidates=[Path('/usr/lib/x86_64-linux-gnu')/soname,Path('/lib/x86_64-linux-gnu')/soname]
   library=next((p for p in candidates if p.exists()),None)
   if not library:raise SystemExit('Build host is missing dependency: '+soname)
   shutil.copyfile(library,directory/soname)
   notice=next((Path('/usr/share/doc')/p/'copyright' for p in packages if (Path('/usr/share/doc')/p/'copyright').exists()),None)
   if not notice:raise SystemExit('Missing redistribution notice: '+soname)
   shutil.copyfile(notice,directory/(soname+'-LICENSE.txt'))
  if backend=='vulkan':
   candidates=[Path('/usr/lib/x86_64-linux-gnu/libvulkan.so.1'),Path('/lib/x86_64-linux-gnu/libvulkan.so.1')]
   loader=next((p for p in candidates if p.exists()),None)
   if not loader:raise SystemExit('Build host needs libvulkan1 to include the Vulkan loader')
   shutil.copyfile(loader,directory/'libvulkan.so.1')
   notice=Path('/usr/share/doc/libvulkan1/copyright')
   if notice.exists():shutil.copyfile(notice,directory/'VULKAN-LOADER-LICENSE.txt')
 for file in directory.iterdir():files[file.relative_to(output).as_posix()]=digest(file)
(output/'runtime-manifest.json').write_text(json.dumps({'version':meta['version'],'commit':meta['commit'],'files':files,**({'cudaSources':cuda_sources} if cuda_sources else {})},indent=2)+'\n')
print(json.dumps({'target':key,'version':meta['version'],'bytes':sum(p.stat().st_size for p in output.rglob('*') if p.is_file()),'files':len(files)}))
