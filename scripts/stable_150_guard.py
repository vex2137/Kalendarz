"""Fail-closed final 1.5.0 stable candidate; no tag, merge or public publication."""
import argparse,json,os,re,subprocess
from pathlib import Path
from part2_artifact_guard import ROOT,run,verify_info
from part4_beta3_guard import expected_android_source,verify_apk,CERT
BASE='13cf46aa020afff1d76e0bdf4fe8fc90601069b8'
def policy():
 p=json.loads((ROOT/'scripts/stable-150-version.json').read_text())
 if p['version']!='1.5.0' or p['versionName']!='1.5.0' or p['channel']!='stable' or p['lastTestedVersionCode']<10525 or p['versionCode']<=p['lastTestedVersionCode']:raise ValueError('Stable must update the accepted 10525 installation')
 if any(re.search(r'beta|diagnostic|part|\brc\b',p[k],re.I) for k in ['androidFile','linuxFile','flatpakFile','setupFile','portableFile','webFile','windowsZipFile']):raise ValueError('Final package names must be stable')
 return p
def verify_candidate_info(info,source,android):
 verify_info(info,source,android)
 if info.get('releaseChannel')!='stable' or info.get('branch')!='feat/1.5.0-part4' or info.get('versionName')!='1.5.0' or info.get('versionCode')!=policy()['versionCode']:raise ValueError('Stable version/channel/branch mismatch')
 if os.environ.get('GITHUB_REPOSITORY')=='vex2137/Kalendarz-private-builds' and info.get('workflowCommit')!=os.environ.get('GITHUB_SHA'):raise ValueError('Stable workflow provenance mismatch')
def reject_debuggable(tree):
 for key in ['debuggable','testOnly']:
  m=re.search(r'android:'+key+r'[^\n]*\(type 0x12\)(0x[0-9a-f]+)',tree,re.I)
  if m and int(m[1],16):raise ValueError('Stable APK must not be '+key)
def verify_runtime_scope(source):
 subprocess.run(['git','merge-base','--is-ancestor',BASE,source],cwd=ROOT,check=True)
 if run('git','diff','--name-only',BASE,source,'--','src','electron','android/app/src','android/native','scripts/native-runtime-manifest.json','bun.lock'):raise ValueError('Stable candidate unexpectedly changed accepted application/runtime/data code')
def main():
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--check-remote',action='store_true');p.add_argument('--info',type=Path);p.add_argument('--platform',choices=['android','desktop']);p.add_argument('--apk',type=Path);a=p.parse_args();expected_android_source(a.source,a.check_remote);verify_runtime_scope(a.source);value=policy();report=dict(source=a.source,**value)
 if a.info:verify_candidate_info(json.loads(a.info.read_text()),a.source,a.platform=='android')
 if a.apk:
  if a.apk.name!=value['androidFile']:raise ValueError('Unexpected stable APK name')
  tools=Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0';report=verify_apk(a.apk,a.source,tools,release_policy=value,info_verifier=verify_candidate_info);reject_debuggable(run(tools/'aapt','dump','xmltree',a.apk,'AndroidManifest.xml'));report['debuggable']=False;a.apk.with_suffix('.apk.json').write_text(json.dumps(report,indent=2)+'\n');a.apk.with_suffix('.apk.sha256').write_text(report['sha256']+'  '+a.apk.name+'\n')
 print(json.dumps(report))
if __name__=='__main__':main()
