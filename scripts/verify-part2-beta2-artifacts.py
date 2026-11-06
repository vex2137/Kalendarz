"""Verify prebuilt manual-test assets; never builds, signs or publishes a release."""
import hashlib,json,os,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE='9c7ac0d7c940ccb851c2fd9d2db9d9ae0dd39f68'
CERT='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
FILES=[{'name': 'Kalendarz-1.5.0-Part-2-Beta-2-SAF-10512.apk', 'size': 24345246, 'sha256': '424a81f647702add5e3321b15847047acef29c1fa30c5995499a9ad2a28bc1bc'}]
def run(*args):return subprocess.check_output(list(map(str,args)),cwd=ROOT,text=True).strip()
head=run('git','rev-parse','HEAD');assert head==os.environ['GITHUB_SHA']
run('git','merge-base','--is-ancestor',SOURCE,head)
run('git','diff','--exit-code',SOURCE,head,'--','src','electron','android','package.json','bun.lock')
out=ROOT/'manual-test-assets';out.mkdir(exist_ok=True)
notes=(ROOT/'docs/PART2-BETA2-MANUAL-TESTS.md').read_text()
for asset in FILES:
 directory=out/('android' if asset['name'].endswith('.apk') else 'linux');directory.mkdir(exist_ok=True)
 target=directory/asset['name']
 pointer=f"version https://git-lfs.github.com/spec/v1\noid sha256:{asset['sha256']}\nsize {asset['size']}\n"
 with target.open('wb') as f:result=subprocess.run(['git','lfs','smudge'],cwd=ROOT,input=pointer.encode(),stdout=f,stderr=subprocess.PIPE)
 if result.returncode:raise RuntimeError('Verified transfer object is unavailable or unauthorized')
 with target.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==asset['sha256']
 assert target.stat().st_size==asset['size']
 (directory/(asset['name']+'.sha256')).write_text(f"{asset['sha256']}  {asset['name']}\n")
 (directory/'README.md').write_text(notes)
 if target.suffix=='.apk':
  tools=sorted((Path(os.environ['ANDROID_HOME'])/'build-tools').glob('*/apksigner'))[-1].parent
  assert 'certificate SHA-256 digest: '+CERT in run(tools/'apksigner','verify','--print-certs',target)
  assert "name='com.kalendarz.offline.diagnostics' versionCode='10512' versionName='1.5.0-part2-beta.2'" in run(tools/'aapt','dump','badging',target)
  run(tools/'zipalign','-c','-P','16','4',target)
  with zipfile.ZipFile(target) as archive:
   assert archive.testzip() is None
   assert not any(n.lower().endswith(('.gguf','.jks','.p12','.keystore')) for n in archive.namelist())
   info=json.loads(archive.read('assets/public/build-info.json'));assert info['commit']==SOURCE and info['bundledModel'] is False and info['androidNative'] is True and not info['dirty']
 else:
  with target.open('rb') as f:header=f.read(20)
  assert header[:4]==b'\x7fELF' and header[18:20]==b'\x3e\x00'
  target.chmod(0o755)
 print('Verified manual-test asset:',asset['name'])
