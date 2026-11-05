"""Reject a beta APK that cannot update the published diagnostics identity."""
import argparse, hashlib, json, subprocess, zipfile
from pathlib import Path

p=argparse.ArgumentParser();p.add_argument('apk',type=Path);p.add_argument('--tools',type=Path,required=True);p.add_argument('--commit',required=True);args=p.parse_args()
m=json.loads(Path('beta-release.json').read_text())
def run(tool,*values): return subprocess.check_output([str(args.tools/tool),*map(str,values)],text=True)
signature=run('apksigner','verify','--verbose','--print-certs',args.apk)
assert 'certificate SHA-256 digest: '+m['androidCertificateSha256'] in signature,'Wrong signing certificate; publication forbidden'
badging=run('aapt','dump','badging',args.apk)
for value in ("name='com.kalendarz.offline.diagnostics'",f"versionName='{m['version']}'",f"versionCode='{m['androidVersionCode']}'","application-label:'Calendar'"):
    assert value in badging,value
run('zipalign','-c','-P','16','4',args.apk)
with zipfile.ZipFile(args.apk) as z:
    assert z.testzip() is None
    info=json.loads(z.read('assets/public/build-info.json'))
    assert info['commit']==args.commit and info['version']==m['version'] and not info['dirty']
    assert info['androidNative'] and info['bundledModel'] is False and info['distribution']=='model-free'
    model=json.loads(z.read('assets/public/models/manifest.json'))
    assert model['sha256']=='fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5'
    assert 'lib/arm64-v8a/libcalendar_llama.so' in z.namelist()
    assert not any(n.endswith(('.gguf','.keystore','.p12','.jks')) for n in z.namelist())
with args.apk.open('rb') as f: digest=hashlib.file_digest(f,'sha256').hexdigest()
args.apk.with_suffix('.apk.sha256').write_text(digest+'  '+args.apk.name+'\n')
print(json.dumps({'file':args.apk.name,'bytes':args.apk.stat().st_size,'sha256':digest,'certificate':m['androidCertificateSha256'],'versionCode':m['androidVersionCode']}))
