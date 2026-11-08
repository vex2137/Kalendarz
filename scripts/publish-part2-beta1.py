import hashlib,json,os,subprocess,tempfile,time,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPO='vex2137/Kalendarz';TAG='v1.5.0-part2-beta1';NAME='Kalendarz-1.5.0-Part-2-Beta-1.apk'
FILES=[{'name': 'Kalendarz-1.5.0-Part-2-Beta-1.apk', 'size': 24313597, 'sha256': '0a059435240e99b45b2aa48b3e89c097f3eff5699d8eea3ae57aa358d019bc5d'}, {'name': 'Kalendarz-1.5.0-Part-2-Beta-1-x86_64.AppImage', 'size': 164961589, 'sha256': '3f350fb4815fe39cf14988466bd792890006e12105af48733090a30ac9c4932c'}]
SHA=FILES[0]['sha256'];SIZE=FILES[0]['size']
SOURCE='555d8b3649a32efa2ce9c0ac845a4b458ec9a00f';CERT='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
def run(*args):return subprocess.check_output(list(map(str,args)),cwd=ROOT,text=True).strip()
def digest(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
head=run('git','rev-parse','HEAD');assert head==os.environ['GITHUB_SHA']
run('git','merge-base','--is-ancestor',SOURCE,head)
run('git','diff','--exit-code',SOURCE,head,'--','src','electron','android','package.json','bun.lock')
old=subprocess.run(['gh','api',f'repos/{REPO}/git/ref/tags/{TAG}'],capture_output=True,text=True)
if old.returncode==0:assert json.loads(old.stdout)['object']['sha']==head,'Existing tag points to another commit'
else:assert '404' in old.stderr
out=ROOT/'release';out.mkdir(exist_ok=True);apk=out/NAME
for asset in FILES:
 target=out/asset['name']
 pointer=f"version https://git-lfs.github.com/spec/v1\noid sha256:{asset['sha256']}\nsize {asset['size']}\n"
 with target.open('wb') as f:subprocess.run(['git','lfs','smudge'],cwd=ROOT,input=pointer.encode(),stdout=f,check=True)
 assert target.stat().st_size==asset['size'] and digest(target)==asset['sha256']
appimage=out/FILES[1]['name']
with appimage.open('rb') as f:
 header=f.read(20)
 assert header[:4]==b'\x7fELF' and header[18:20]==b'\x3e\x00'

with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None and not any(n.lower().endswith(('.gguf','.p12','.jks','.keystore')) for n in z.namelist())
 info=json.loads(z.read('assets/public/build-info.json'));assert info['commit']==SOURCE and info['version']=='1.5.0' and not info['dirty'] and info['bundledModel'] is False and info['androidNative'] is True
 assert 'lib/arm64-v8a/libcalendar_llama.so' in z.namelist()
tools=sorted((Path(os.environ['ANDROID_HOME'])/'build-tools').glob('*/apksigner'))[-1].parent
assert 'certificate SHA-256 digest: '+CERT in run(tools/'apksigner','verify','--print-certs',apk)
assert "name='com.kalendarz.offline.diagnostics' versionCode='10508' versionName='1.5.0-part2-beta.1'" in run(tools/'aapt','dump','badging',apk)
run(tools/'zipalign','-c','-P','16','4',apk)
checksum=out/'SHA256SUMS.txt';checksum.write_text(''.join(f"{a['sha256']}  {a['name']}\n" for a in FILES))
def release():
 pages=json.loads(run('gh','api','--paginate','--slurp',f'repos/{REPO}/releases?per_page=100'))
 matches=[r for page in pages for r in page if r['tag_name']==TAG];assert len(matches)<=1
 return matches[0] if matches else None
assert json.loads(run('gh','api',f'repos/{REPO}/releases/latest'))['tag_name']=='v1.4.2'
r=release()
if r is None:
 notes=ROOT/'.github/release-notes/v1.5.0-part2-beta1.md'
 run('gh','release','create',TAG,'--repo',REPO,'--target',head,'--draft','--prerelease','--title','Kalendarz 1.5.0 Part 2 Beta 1','--notes-file',notes)
 for _ in range(10):
  r=release()
  if r:break
  time.sleep(2)
assert r and r['prerelease'] and r['draft'],'Never overwrite a published release'
existing={a['name'] for a in r['assets']};assert existing<= {a['name'] for a in FILES}|{'SHA256SUMS.txt'}
for name in [a['name'] for a in FILES]+['SHA256SUMS.txt']:
 if name not in existing:run('gh','release','upload',TAG,out/name,'--repo',REPO)
with tempfile.TemporaryDirectory() as d:
 run('gh','release','download',TAG,'--repo',REPO,'--dir',d)
 assert {p.name for p in Path(d).iterdir()}=={a['name'] for a in FILES}|{'SHA256SUMS.txt'}
 for asset in FILES:assert digest(Path(d)/asset['name'])==asset['sha256']
 assert (Path(d)/'SHA256SUMS.txt').read_text()==checksum.read_text()
run('gh','release','edit',TAG,'--repo',REPO,'--draft=false','--prerelease','--latest=false')
r=release();assert r and not r['draft'] and r['prerelease'];print(json.dumps({'published':True,'url':r['html_url'],'sha256':SHA}))
