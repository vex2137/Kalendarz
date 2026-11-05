"""Verify prebuilt manual-test assets; never builds, signs or publishes a release."""
import hashlib,json,os,subprocess,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE='b25d7e7f54e47e4d74185651048769038dd89ccc'
CERT='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
FILES=[{'name': 'Kalendarz-1.5.0-Part-2-Beta-2.apk', 'size': 24023506, 'sha256': '9ce239d51d3703aad2d69cb5773bdef7e79f6f3dc32b1bb0eea97d2f75756605'}, {'name': 'Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage', 'size': 935366111, 'sha256': '3f4a4df2b87b0e389aa3648528ef57dda06b81ce9e60adc6e4004587880ada19'}]
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
  assert "name='com.kalendarz.offline.diagnostics' versionCode='10509' versionName='1.5.0-part2-beta.2'" in run(tools/'aapt','dump','badging',target)
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
