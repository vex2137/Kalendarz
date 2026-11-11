"""Deliver checked icon packages to the existing private draft; never publish/overwrite."""
import argparse,hashlib,json,os,subprocess
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('kind',choices=['linux','flatpak','windows','web']);a=p.parse_args()
repo=os.environ['GITHUB_REPOSITORY'];source=os.environ['CALENDAR_EXPECTED_COMMIT'];assert repo=='vex2137/Kalendarz-private-builds'
def api(path):return json.loads(subprocess.check_output(['gh','api',path]))
def sha(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
r=api('repos/'+repo);assert r['private'] and r['visibility']=='private'
release=api('repos/'+repo+'/releases/424632810');assert release['draft'] is True and release['tag_name']=='model-v142-v2'
root=Path('part4-artifacts')/a.kind
extensions={'linux':['*.AppImage'],'flatpak':['*.flatpak'],'windows':['*-Setup.exe','*-Portable.exe'],'web':['*.zip']}[a.kind]
packages=[f for pattern in extensions for f in root.glob(pattern)];assert len(packages)==(2 if a.kind=='windows' else 1)
manifest=json.loads(Path('packaging/icons/manifest.json').read_text());files=[];reports=[]
for package in packages:
 report_path=package.with_name(package.name+'.json');report=json.loads(report_path.read_text()) if report_path.exists() else {}
 if a.kind!='web':assert report['source']==source and report['sha256']==sha(package)
 name=package.stem+'-Android16-Adaptive-'+source[:12]+package.suffix
 renamed=package.with_name(name);package.rename(renamed)
 report.update(file=name,source=source,bytes=renamed.stat().st_size,sha256=sha(renamed),androidIconSource=manifest['source'],androidAdaptiveComposition=manifest['composition'],androidIconSourceSha256=manifest['sourceSha256'],diagnosticOnly=True,applicationCodeUnchangedFrom='aa90a317c9e89ae8ef984de6e435df6f4604eb28',priorRealQwenRun=42894252025,workflowCommit=os.environ['GITHUB_SHA'],workflowRun=os.environ['GITHUB_RUN_ID'])
 meta=renamed.with_name(name+'.json');meta.write_text(json.dumps(report,indent=2)+'\n');checksum=renamed.with_name(name+'.sha256');checksum.write_text(report['sha256']+'  '+name+'\n');files.extend([renamed,meta,checksum]);reports.append(report)
names={f.name for f in files};assert not names.intersection(asset['name'] for asset in release['assets'])
subprocess.run(['gh','release','upload','model-v142-v2',*[str(f) for f in files],'--repo',repo],check=True)
release=api('repos/'+repo+'/releases/424632810');assert release['draft'] is True
assets=[asset for asset in release['assets'] if asset['name'] in names];assert len(assets)==len(files)
for asset in assets:
 file=root/asset['name'];target=Path(os.environ['RUNNER_TEMP'])/('redownload-'+asset['name'])
 with target.open('wb') as out:subprocess.run(['gh','api','repos/'+repo+'/releases/assets/'+str(asset['id']),'-H','Accept: application/octet-stream'],stdout=out,check=True)
 assert target.stat().st_size==file.stat().st_size and sha(target)==sha(file)
 target.unlink()
print(json.dumps(dict(private=True,draft=True,published=False,source=source,kind=a.kind,reports=reports,assets=[dict(id=asset['id'],name=asset['name'],url=asset['browser_download_url']) for asset in assets])))
