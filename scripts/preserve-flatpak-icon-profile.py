import os,sys,json,hashlib
from pathlib import Path
assert os.environ.get('GITHUB_ACTIONS')=='true' and os.environ.get('RUNNER_ENVIRONMENT')=='github-hosted'
assert os.environ.get('GITHUB_REPOSITORY')=='vex2137/Kalendarz-private-builds'
p=Path.home()/'.var/app/com.vex2137.kalendarz'; assert p.is_dir()
def snapshot():
 result={}
 for f in sorted(p.rglob('*')):
  if not f.is_file() or f.is_symlink():continue
  with f.open('rb') as data:result[str(f.relative_to(p))]=hashlib.file_digest(data,'sha256').hexdigest()
 assert result
 return result
state=Path('build/flatpak-profile-checksum.json')
if sys.argv[1]=='snapshot':state.write_text(json.dumps(snapshot(),sort_keys=True))
else:assert snapshot()==json.loads(state.read_text()),'Flatpak profile bytes changed during bundle reinstallation'
print('PASS isolated runner profile checksums:',sys.argv[1])
