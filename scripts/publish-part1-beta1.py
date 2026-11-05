import hashlib,json,os,subprocess,tempfile,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPO='vex2137/Kalendarz';TAG='v1.5.0-part1-beta1';NAME='Kalendarz-1.5.0-Part-1-Beta-1.apk'
SHA='c5c8c4e9e47fe1ec9436d98da4f638c51ff24a58bfd64a578ba985771ac0b0f7';SIZE=24012453
SOURCE='038fcacbe7a84a58c7d5f2296594afec9d5e5a6c';CERT='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
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
pointer=f'version https://git-lfs.github.com/spec/v1\noid sha256:{SHA}\nsize {SIZE}\n'
with apk.open('wb') as f:subprocess.run(['git','lfs','smudge'],cwd=ROOT,input=pointer.encode(),stdout=f,check=True)
assert apk.stat().st_size==SIZE and digest(apk)==SHA
with zipfile.ZipFile(apk) as z:
 assert z.testzip() is None and not any(n.lower().endswith(('.gguf','.p12','.jks','.keystore')) for n in z.namelist())
 info=json.loads(z.read('assets/public/build-info.json'));assert info['commit']==SOURCE and info['version']=='1.5.0' and not info['dirty'] and info['bundledModel'] is False and info['androidNative'] is True
 assert 'lib/arm64-v8a/libcalendar_llama.so' in z.namelist()
tools=sorted((Path(os.environ['ANDROID_HOME'])/'build-tools').glob('*/apksigner'))[-1].parent
assert 'certificate SHA-256 digest: '+CERT in run(tools/'apksigner','verify','--print-certs',apk)
assert "name='com.kalendarz.offline.diagnostics' versionCode='10505' versionName='1.5.0-beta.1'" in run(tools/'aapt','dump','badging',apk)
run(tools/'zipalign','-c','-P','16','4',apk)
checksum=out/'SHA256SUMS.txt';checksum.write_text(f'{SHA}  {NAME}\n')
def release():
 pages=json.loads(run('gh','api','--paginate','--slurp',f'repos/{REPO}/releases?per_page=100'))
 matches=[r for page in pages for r in page if r['tag_name']==TAG];assert len(matches)<=1
 return matches[0] if matches else None
r=release()
if r is None:
 notes=out/'notes.md';notes.write_text('''## Polski\nAndroid beta 1 zawiera część 1/4 zmian interfejsu 1.5.0 oraz poprawki asystenta z 1.4.2. Zachowuje zgodny pakiet i podpis aktualizacji. Nie zawiera wag GGUF.\n\n## English\nAndroid beta 1 includes part 1/4 of the 1.5.0 interface changes and the 1.4.2 assistant fixes. The update identity and signing certificate are preserved. No GGUF weights are bundled.\n\nBeta: device validation of this APK is still pending. Install only over the same diagnostics package; do not uninstall or clear data. General small-model answers can be inaccurate.\n''')
 run('gh','release','create',TAG,'--repo',REPO,'--target',head,'--draft','--prerelease','--title','Kalendarz 1.5.0 Part 1 Beta 1','--notes-file',notes)
 r=release()
assert r and r['prerelease'] and r['draft'],'Never overwrite a published release'
existing={a['name'] for a in r['assets']};assert existing<= {NAME,'SHA256SUMS.txt'}
for name in [NAME,'SHA256SUMS.txt']:
 if name not in existing:run('gh','release','upload',TAG,out/name,'--repo',REPO)
with tempfile.TemporaryDirectory() as d:
 run('gh','release','download',TAG,'--repo',REPO,'--dir',d)
 assert {p.name for p in Path(d).iterdir()}=={NAME,'SHA256SUMS.txt'}
 assert digest(Path(d)/NAME)==SHA and (Path(d)/'SHA256SUMS.txt').read_text()==checksum.read_text()
run('gh','release','edit',TAG,'--repo',REPO,'--draft=false','--prerelease','--latest=false')
r=release();assert r and not r['draft'] and r['prerelease'];print(json.dumps({'published':True,'url':r['html_url'],'sha256':SHA}))
