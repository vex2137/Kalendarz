"""Only the private stable draft; immutable filenames and authenticated re-download."""
import argparse,os,json,subprocess,hashlib
from pathlib import Path
from stable_150_guard import policy
p=argparse.ArgumentParser();p.add_argument('kind',choices=['android','linux','windows','flatpak','web']);a=p.parse_args();source=os.environ['CALENDAR_EXPECTED_COMMIT'];repo=os.environ['GITHUB_REPOSITORY'];assert repo=='vex2137/Kalendarz-private-builds'
def api(path):return json.loads(subprocess.check_output(['gh','api','repos/'+repo+('/'+path if path else '')]))
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
assert api('')['private'];release=next(r for r in api('releases') if r['tag_name']=='stable-1.5.0-'+source[:12]);assert release['draft'];root=Path('part4-artifacts')/a.kind;value=policy();keys={'android':['androidFile'],'linux':['linuxFile'],'windows':['setupFile','portableFile','windowsZipFile'],'flatpak':['flatpakFile'],'web':['webFile']}[a.kind];files=[]
for key in keys:
 package=root/value[key];meta=package.with_name(package.name+'.json');r=json.loads(meta.read_text());assert r['source']==source
 if a.kind!='web':assert r['sha256']==sha(package)
 r.update(source=source,version='1.5.0',channel='stable',file=package.name,bytes=package.stat().st_size,sha256=sha(package),workflowRun=os.environ['GITHUB_RUN_ID'],workflowCommit=os.environ['GITHUB_SHA']);meta.write_text(json.dumps(r,indent=2)+'\n');s=package.with_name(package.name+'.sha256');s.write_text(r['sha256']+'  '+package.name+'\n');files +=[package,meta,s]
assert not {p.name for p in files}&{x['name'] for x in release['assets']}
subprocess.run(['gh','release','upload',release['tag_name'],*[str(p) for p in files],'--repo',repo],check=True);release=api('releases/'+str(release['id']));assert release['draft'];assets={x['name']:x for x in release['assets']}
for p in files:
 asset=assets[p.name];target=Path(os.environ['RUNNER_TEMP'])/('verify-'+p.name)
 with target.open('wb') as f:subprocess.run(['gh','api','repos/'+repo+'/releases/assets/'+str(asset['id']),'-H','Accept: application/octet-stream'],stdout=f,check=True)
 assert target.stat().st_size==p.stat().st_size and sha(target)==sha(p);target.unlink()
print(json.dumps(dict(private=True,draft=True,source=source,files=[dict(name=p.name,url=assets[p.name]['browser_download_url'],bytes=p.stat().st_size,sha256=sha(p)) for p in files if p.suffix not in ['.json','.sha256']])))
