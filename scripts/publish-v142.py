"""Publish exactly the four verified, model-free 1.4.2 binaries; never build or sign."""
import hashlib,json,os,re,subprocess,sys,tempfile,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEPOT=Path(sys.argv[1]).resolve()
REPO='vex2137/Kalendarz'
NAMES={'KALENDARZ-1.4.2-ANDROID.apk','KALENDARZ-1.4.2-WINDOWS-x86_64.exe','KALENDARZ-1.4.2-linux-x86_64.AppImage','KALENDARZ-1.4.2-WEB.zip'}
CERT='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
def run(*args,cwd=ROOT): return subprocess.check_output(list(map(str,args)),cwd=cwd,text=True).strip()
def sha(p):
    with p.open('rb') as f: return hashlib.file_digest(f,'sha256').hexdigest()
manifest=json.loads((DEPOT/'.github/release-142-manifest.json').read_text())
assert manifest['validated'] is True and set(manifest['files'])==NAMES
for target in ['linux','windows']:
    for check in ['typescript','unitAndIntegration','nativeUnit','actualQwenV2NativeInference','packagedApplicationStartupPersistenceQrInferenceAndClose']:
        assert manifest['checks'][target][check] is True
assert manifest['checks']['linux']['upgrade141To142'] is True
assert manifest['checks']['windows']['portableLauncherStartAndExit'] is True
assert manifest['checks']['android']['physicalPocoTest2AcceptedByUser'] is True
source=manifest['source']
assert re.fullmatch('[a-f0-9]{40}',source)
assert json.loads((ROOT/'package.json').read_text())['version']=='1.4.2'
head=run('git','rev-parse','HEAD')
tag=run('git','rev-list','-1','v1.4.2')
run('git','merge-base','--is-ancestor',tag,head)
run('git','diff','--exit-code',tag,head,'--','src','electron','android','package.json','bun.lock')
run('git','merge-base','--is-ancestor',source,head)
run('git','diff','--exit-code',source,head,'--','src','electron','android','package.json','bun.lock')
# The accepted Android binary predates packaging-only changes; application trees must match.
run('git','diff','--exit-code','663b8ba6e1debe4bde6a15c46408adb3e19239cd',head,'--','src','electron','android','package.json','bun.lock')
out=ROOT/'release';out.mkdir(exist_ok=True)
for name,meta in manifest['files'].items():
    assert re.fullmatch('[a-f0-9]{64}',meta['sha256']) and 0<meta['bytes']<1024**3
    pointer=f"version https://git-lfs.github.com/spec/v1\noid sha256:{meta['sha256']}\nsize {meta['bytes']}\n"
    with (out/name).open('wb') as f:
        subprocess.run(['git','lfs','smudge'],cwd=DEPOT,input=pointer.encode(),stdout=f,check=True)
    assert (out/name).stat().st_size==meta['bytes'] and sha(out/name)==meta['sha256']
for name in NAMES:
    p=out/name
    if p.suffix in ['.apk','.zip']:
        with zipfile.ZipFile(p) as z:
            assert z.testzip() is None
            assert not any(n.lower().endswith(('.gguf','.p12','.jks','.keystore')) for n in z.namelist())
            info=json.loads(z.read('assets/public/build-info.json' if p.suffix=='.apk' else 'build-info.json'))
            assert info['version']=='1.4.2' and info['bundledModel'] is False and info['distribution']=='model-free'
    elif p.suffix=='.AppImage': assert p.read_bytes()[:4]==b'\x7fELF'
    else:
        with p.open('rb') as f: assert f.read(2)==b'MZ'
tools=sorted((Path(os.environ['ANDROID_HOME'])/'build-tools').glob('*/apksigner'))[-1].parent
apk=out/'KALENDARZ-1.4.2-ANDROID.apk'
assert 'certificate SHA-256 digest: '+CERT in run(tools/'apksigner','verify','--print-certs',apk)
badging=run(tools/'aapt','dump','badging',apk)
assert "name='com.kalendarz.offline.diagnostics' versionCode='10407' versionName='1.4.2'" in badging
run(tools/'zipalign','-c','-P','16','4',apk)
(out/'SHA256SUMS.txt').write_text(''.join(f"{manifest['files'][n]['sha256']}  {n}\n" for n in sorted(NAMES)))
files=sorted(NAMES|{'SHA256SUMS.txt'})
result=subprocess.run(['gh','api',f'repos/{REPO}/releases/tags/v1.4.2'],capture_output=True,text=True)
if result.returncode:
    assert '404' in result.stderr,'Release lookup must fail only for a missing tag'
    run('gh','release','create','v1.4.2','--repo',REPO,'--verify-tag','--draft','--title','Kalendarz 1.4.2','--notes-file','.github/release-notes/v1.4.2.md')
release=json.loads(run('gh','api',f'repos/{REPO}/releases/tags/v1.4.2'))
assert not release['prerelease']
existing={asset['name']:asset for asset in release['assets']}
assert set(existing)<=set(files),'Unexpected release asset; preserve and stop'
for name in files:
    if name not in existing:
        assert release['draft'],'Never mutate an already-published release'
        run('gh','release','upload','v1.4.2',out/name,'--repo',REPO)
with tempfile.TemporaryDirectory() as folder:
    run('gh','release','download','v1.4.2','--repo',REPO,'--dir',folder)
    assert set(p.name for p in Path(folder).iterdir())==set(files)
    for name in files: assert sha(Path(folder)/name)==sha(out/name),'Uploaded bytes differ'
if release['draft']: run('gh','release','edit','v1.4.2','--repo',REPO,'--draft=false','--prerelease=false','--latest')
release=json.loads(run('gh','api',f'repos/{REPO}/releases/tags/v1.4.2'))
assert not release['draft'] and not release['prerelease']
evidence={'published':True,'url':release['html_url'],'tagCommit':tag,'publisherCommit':head,'testedSource':source,'files':manifest['files'],'checks':manifest['checks']}
(out/'evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence))
