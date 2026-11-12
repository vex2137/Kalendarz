"""Reuse only the verified AppImage produced by the successful Linux job of this run."""
import os,json,subprocess,hashlib
from pathlib import Path
from part2_artifact_guard import asar_build_info
from part4_beta3_guard import verify_candidate_info
repo=os.environ['GITHUB_REPOSITORY'];assert repo=='vex2137/Kalendarz-private-builds';source=os.environ['CALENDAR_EXPECTED_COMMIT']
def api(p):return json.loads(subprocess.check_output(['gh','api','repos/'+repo+'/'+p]))
r=api('releases/424632810');assert r['draft'];jobs=api('actions/runs/'+os.environ['GITHUB_RUN_ID']+'/jobs')['jobs'];assert any(j['name']=='linux' and j['conclusion']=='success' for j in jobs)
name='Kalendarz-1.5.0-Part-4-Beta-3-Linux-x86_64-Android16-Adaptive-'+source[:12]+'.AppImage';a=next(a for a in r['assets'] if a['name']==name);m=next(a for a in r['assets'] if a['name']==name+'.json')
def download(a,p):
 with p.open('wb') as out:subprocess.run(['gh','api','repos/'+repo+'/releases/assets/'+str(a['id']),'-H','Accept: application/octet-stream'],stdout=out,check=True)
p=Path('build/reuse-metadata.json');p.parent.mkdir(exist_ok=True);download(m,p);report=json.loads(p.read_text());assert report['source']==source and report['workflowRun']==os.environ['GITHUB_RUN_ID'] and report['workflowCommit']==os.environ['GITHUB_SHA'];assert a['digest']=='sha256:'+report['sha256'] and a['size']==report['bytes']
p=Path('build/reused.AppImage');download(a,p)
with p.open('rb') as data:assert hashlib.file_digest(data,'sha256').hexdigest()==report['sha256']
p.chmod(0o755);directory=Path('build/reuse');directory.mkdir();subprocess.run([str(p.resolve()),'--appimage-extract'],cwd=directory,stdout=subprocess.DEVNULL,check=True);Path('release').mkdir(exist_ok=True);(directory/'squashfs-root').rename('release/linux-unpacked');p.unlink()
info=asar_build_info(Path('release/linux-unpacked/resources/app.asar'));verify_candidate_info(info,source,False)
print('PASS exact same-run AppImage source, SHA-256 and original build provenance; no native rebuild')
