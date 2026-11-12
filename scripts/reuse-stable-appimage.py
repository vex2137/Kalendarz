"""Flatpak consumes the same-run stable AppImage, without rebuilding native backends."""
import os,json,subprocess,hashlib
from pathlib import Path
from stable_150_guard import policy,verify_candidate_info
from part2_artifact_guard import asar_build_info
repo=os.environ['GITHUB_REPOSITORY'];assert repo=='vex2137/Kalendarz-private-builds';source=os.environ['CALENDAR_EXPECTED_COMMIT']
def api(p):return json.loads(subprocess.check_output(['gh','api','repos/'+repo+'/'+p]))
assert any(j['name']=='linux' and j['conclusion']=='success' for j in api('actions/runs/'+os.environ['GITHUB_RUN_ID']+'/jobs')['jobs'])
r=next(r for r in api('releases') if r['tag_name']=='stable-1.5.0-'+source[:12]);assert r['draft'];name=policy()['linuxFile'];asset=next(a for a in r['assets'] if a['name']==name);meta=next(a for a in r['assets'] if a['name']==name+'.json');report=json.loads(subprocess.check_output(['gh','api','repos/'+repo+'/releases/assets/'+str(meta['id']),'-H','Accept: application/octet-stream']));assert report['source']==source and report['workflowRun']==os.environ['GITHUB_RUN_ID'] and report['workflowCommit']==os.environ['GITHUB_SHA'];assert asset['digest']=='sha256:'+report['sha256']
p=Path('build/reused.AppImage');p.parent.mkdir(exist_ok=True)
with p.open('wb') as f:subprocess.run(['gh','api','repos/'+repo+'/releases/assets/'+str(asset['id']),'-H','Accept: application/octet-stream'],stdout=f,check=True)
with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==report['sha256']
p.chmod(0o755);d=Path('build/reuse');d.mkdir();subprocess.run([str(p.resolve()),'--appimage-extract'],cwd=d,stdout=subprocess.DEVNULL,check=True);Path('release').mkdir(exist_ok=True);(d/'squashfs-root').rename('release/linux-unpacked');p.unlink();verify_candidate_info(asar_build_info(Path('release/linux-unpacked/resources/app.asar')),source,False);print('PASS same-run stable AppImage source/provenance/hash reused for Flatpak')
