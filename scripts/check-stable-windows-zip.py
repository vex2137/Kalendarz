"""Verify the additional historical Windows ZIP against the actual unpacked payload."""
import hashlib,json,os,zipfile
from pathlib import Path
from stable_150_guard import policy,verify_candidate_info
from part2_artifact_guard import asar_build_info
p=policy();source=os.environ['CALENDAR_EXPECTED_COMMIT'];root=Path('release/win-unpacked');verify_candidate_info(asar_build_info(root/'resources/app.asar'),source,False);f=Path('part4-artifacts/windows')/p['windowsZipFile'];native=json.loads((root/'resources/native/runtime-manifest.json').read_text())
with zipfile.ZipFile(f) as z:
 assert not any('..' in n.split('/') or n.lower().endswith(('.gguf','.p12','.jks','.keystore')) for n in z.namelist())
 for name in ['Calendar.exe','resources/app.asar','resources/native/runtime-manifest.json']+['resources/native/'+n for n in native['files']]:
  assert hashlib.sha256(z.read(name)).hexdigest()==hashlib.sha256((root/name).read_bytes()).hexdigest(),name
with f.open('rb') as data:sha=hashlib.file_digest(data,'sha256').hexdigest()
r=dict(source=source,file=f.name,channel='stable',bytes=f.stat().st_size,sha256=sha,nativeFilesVerified=len(native['files']),profile='normal installed profile; not Portable');f.with_name(f.name+'.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r))
