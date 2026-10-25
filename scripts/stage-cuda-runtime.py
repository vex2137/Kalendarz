"""Optional pinned CUDA alternative to the default CPU/Vulkan desktop packages.
May download large NVIDIA runtime archives. Run only on a CUDA build host.
No model weights are downloaded. Existing CPU/Vulkan files remain untouched.
"""
import argparse, hashlib, json, os, subprocess, tarfile, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--target',choices=['linux-x64','win-x64'],required=True);args=parser.parse_args()
assets={
 'linux-x64':[
  ('llama-b11669-bin-ubuntu-cuda-12.8-x64.tar.gz','4703ed1a3cd6e8504affb6cb9866f501e96d634d68a002dc9a8251c9e2819b49'),
  ('cudart-llama-b11669-bin-ubuntu-cuda-12.8-x64.tar.gz','ab3eda89a82096bcba00b6448218c3c11eec2016b0f38d64884dc29736549f26')],
 'win-x64':[
  ('llama-b11669-bin-win-cuda-12.4-x64.zip','c2da1f73ed176ae093ac5aceb978a7b167a16113f6d74c6789eeaee2135cb8dc'),
  ('cudart-llama-bin-win-cuda-12.4-x64.zip','8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6')]}
root=ROOT/'native'/args.target;manifest=root/'runtime-manifest.json'
if not manifest.is_file():raise SystemExit('Run scripts/prepare-native.py for the target first')
meta=json.loads(manifest.read_text())
if meta.get('commit')!='620d2225cc436ab0b001e3200e590e3b286ef9ab':raise SystemExit('CUDA and CPU/Vulkan must use the same pinned llama.cpp commit')
cache=ROOT/'native/downloads';cache.mkdir(parents=True,exist_ok=True)
# Build a separate directory and update the manifest last; failed downloads cannot
# invalidate an already staged CUDA runtime or a working CPU/Vulkan installation.
stage=root/'cuda-staging';stage.mkdir(exist_ok=True)
def digest(file):
 with file.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def wanted(name):
 base=Path(name).name
 return base in ['llama-server','llama-server.exe'] or '.so' in base or base.lower().endswith('.dll') or base.upper().startswith(('LICENSE','NOTICE','COPYING'))
for name,expected in assets[args.target]:
 archive=cache/name
 if not archive.exists() or digest(archive)!=expected:
  part=cache/(name+'.partial');subprocess.run(['curl','--fail','--location','--retry','2','--max-time','600','--output',str(part),'https://github.com/ggml-org/llama.cpp/releases/download/b11669/'+name],check=True)
  if digest(part)!=expected:raise SystemExit('CUDA archive checksum mismatch: '+name)
  part.replace(archive)
 if name.endswith('.zip'):
  with zipfile.ZipFile(archive) as z:
   for item in z.infolist():
    if not item.is_dir() and wanted(item.filename):(stage/Path(item.filename).name).write_bytes(z.read(item))
 else:
  with tarfile.open(archive) as tar:
   for item in tar.getmembers():
    if wanted(item.name) and (item.isfile() or item.issym() or item.islnk()):
     with tar.extractfile(item) as source:(stage/Path(item.name).name).write_bytes(source.read())
if not (stage/('llama-server.exe' if args.target.startswith('win') else 'llama-server')).is_file():raise SystemExit('CUDA server missing')
if args.target.startswith('linux'):
 import shutil
 # Reuse already audited distribution dependencies and their notices.
 for file in (root/'cpu').iterdir():
  if file.name.startswith(('libssl.so','libcrypto.so','libgomp.so','libz.so','libzstd.so')):shutil.copyfile(file,stage/file.name)
 for file in stage.iterdir():file.chmod(0o755 if file.name=='llama-server' or '.so' in file.name else 0o644)
import shutil
out=root/'cuda';backup=root/'cuda-previous'
if backup.exists():shutil.rmtree(backup)
if out.exists():out.rename(backup)
stage.rename(out)
meta['files']={key:value for key,value in meta['files'].items() if not key.startswith('cuda/')}
for file in out.iterdir():meta['files']['cuda/'+file.name]=digest(file)
meta['cudaSources']=[{'file':name,'sha256':sha}for name,sha in assets[args.target]]
part=manifest.with_suffix('.partial');part.write_text(json.dumps(meta,indent=2)+'\n');part.replace(manifest)
print('CUDA runtime staged and checksummed; physical GPU inference remains a separate verification gate.')
