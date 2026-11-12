"""Optional pinned CUDA alternative to the default CPU/Vulkan desktop packages.
May download large NVIDIA runtime archives. Run only on a CUDA build host.
No model weights are downloaded. Existing CPU/Vulkan files remain untouched.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, tarfile, zipfile
from pathlib import Path
from release_download import download_pinned_release
ROOT=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser();parser.add_argument('--target',choices=['linux-x64','win-x64'],required=True);args=parser.parse_args()
assets={
 'win-x64':[
  ('llama-b11669-bin-win-cuda-12.4-x64.zip','c2da1f73ed176ae093ac5aceb978a7b167a16113f6d74c6789eeaee2135cb8dc'),
  ('cudart-llama-bin-win-cuda-12.4-x64.zip','8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6')]}
root=ROOT/'native'/args.target;manifest=root/'runtime-manifest.json'
if not manifest.is_file():raise SystemExit('Run scripts/prepare-native.py for the target first')
meta=json.loads(manifest.read_text())
pins=json.loads((ROOT/'scripts/native-runtime-manifest.json').read_text())
pin={**pins,**pins.get('overrides',{}).get(args.target,{})}
if args.target in pins.get('cuda',{}):assets[args.target]=[(a['file'],a['sha256']) for a in pins['cuda'][args.target]]
if meta.get('commit')!=pin['commit']:raise SystemExit('CUDA and CPU/Vulkan must use the same pinned llama.cpp commit')
cache=ROOT/'native/downloads';cache.mkdir(parents=True,exist_ok=True)
# Build a separate directory and update the manifest last; failed downloads cannot
# invalidate an already staged CUDA runtime or a working CPU/Vulkan installation.
stage=ROOT/'native'/('.cuda-staging-'+args.target)
if stage.exists():shutil.rmtree(stage)
stage.mkdir()
def digest(file):
 with file.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def wanted(name):
 base=Path(name).name
 return base in ['llama-server','llama-server.exe'] or '.so' in base or base.lower().endswith('.dll') or base.upper().startswith(('LICENSE','NOTICE','COPYING','EULA')) or base.lower().endswith('.txt')
def target_name(name,archive):
 base=Path(name).name
 if base.upper().startswith(('LICENSE','NOTICE','COPYING','EULA')) or base.lower().endswith('.txt'):
  return re.sub('[^a-zA-Z0-9._+-]','_',archive+'-'+base)
 return base
for name,expected in assets[args.target]:
 archive=cache/name
 if not archive.exists() or digest(archive)!=expected:
  pinned=next((item for item in pins.get('cuda',{}).get(args.target,[]) if item['file']==name),None)
  if pinned and type(pinned.get('bytes')) is int:
   download_pinned_release(pinned['url'],archive,pinned['bytes'],expected)
  else:
   part=cache/(name+'.partial');subprocess.run(['curl','--fail','--location','--retry','2','--max-time','600','--output',str(part),'https://github.com/ggml-org/llama.cpp/releases/download/'+pin['version']+'/'+name],check=True)
   if digest(part)!=expected:raise SystemExit('CUDA archive checksum mismatch: '+name)
   part.replace(archive)
 if name.endswith('.zip'):
  with zipfile.ZipFile(archive) as z:
   for item in z.infolist():
    if not item.is_dir() and wanted(item.filename):(stage/target_name(item.filename,name)).write_bytes(z.read(item))
 else:
  with tarfile.open(archive) as tar:
   for item in tar.getmembers():
    if wanted(item.name) and (item.isfile() or item.issym() or item.islnk()):
     with tar.extractfile(item) as source:(stage/target_name(item.name,name)).write_bytes(source.read())
if not (stage/('llama-server.exe' if args.target.startswith('win') else 'llama-server')).is_file():raise SystemExit('CUDA server missing')
if args.target.startswith('linux'):
 import shutil
 # Reuse already audited distribution dependencies and their notices.
 for file in (root/'cpu').iterdir():
  if file.name.startswith(('libssl.so','libcrypto.so','libgomp.so','libz.so','libzstd.so')):shutil.copyfile(file,stage/file.name)
 for file in stage.iterdir():file.chmod(0o755 if file.name=='llama-server' or '.so' in file.name else 0o644)
import shutil
out=root/'cuda';backup=ROOT/'native'/('.cuda-previous-'+args.target)
if backup.exists():shutil.rmtree(backup)
if out.exists():out.rename(backup)
stage.rename(out)
meta['files']={key:value for key,value in meta['files'].items() if not key.startswith('cuda/')}
for file in out.iterdir():meta['files']['cuda/'+file.name]=digest(file)
meta['cudaSources']=[{'file':name,'sha256':sha}for name,sha in assets[args.target]]
try:
 part=manifest.with_suffix('.partial');part.write_text(json.dumps(meta,indent=2)+'\n');part.replace(manifest)
except Exception:
 shutil.rmtree(out)
 if backup.exists():backup.rename(out)
 raise
if backup.exists():shutil.rmtree(backup)
print('CUDA runtime staged and checksummed; physical GPU inference remains a separate verification gate.')
