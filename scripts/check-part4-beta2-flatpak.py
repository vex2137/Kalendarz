"""Inspect the built OSTree bundle and installed payload, not just the manifest."""
import hashlib,json,os,subprocess,configparser
from pathlib import Path
from part4_beta2_guard import ROOT,policy,expected_android_source,verify_candidate_info
from part2_artifact_guard import asar_build_info
APP='com.vex2137.kalendarz'
def main():
 source=expected_android_source(os.environ['CALENDAR_EXPECTED_COMMIT'],True)
 location=Path(subprocess.check_output(['flatpak','info','--user','--show-location',APP],text=True).strip());app=location/'files/lib'/APP
 verify_candidate_info(asar_build_info(app/'resources/app.asar'),source,False)
 installed=configparser.ConfigParser(interpolation=None);installed.read(location/'metadata');permissions=installed['Context'];assert 'filesystems' not in permissions,dict(permissions)
 assert 'dri' in permissions['devices'] and permissions.get('sockets') in ('wayland;fallback-x11;','fallback-x11;wayland;')
 assert (location/'files/share/icons/hicolor/512x512/apps'/f'{APP}.png').read_bytes()==(ROOT/'packaging/icons/png/512x512.png').read_bytes()
 native=app/'resources/native';meta=json.loads((native/'runtime-manifest.json').read_text())
 assert meta['commit']=='80d2c0c2c56e4a1bbf74be98f64b99927bf230bc'
 assert {'cpu','cuda','vulkan'}<={Path(n).parts[0] for n in meta['files']}
 for n,sha in meta['files'].items():
  with (native/n).open('rb')as f:assert hashlib.file_digest(f,'sha256').hexdigest()==sha,n
 assert not any(f.suffix.lower() in ['.gguf','.p12','.jks','.keystore'] for f in (location/'files').rglob('*'))
 p=policy();bundle=ROOT/'part4-artifacts/flatpak'/p['flatpakFile']
 with bundle.open('rb')as f:sha=hashlib.file_digest(f,'sha256').hexdigest()
 report=dict(file=bundle.name,source=source,channel=p['channel'],bytes=bundle.stat().st_size,sha256=sha,appId=APP,nativeFilesVerified=len(meta['files']),permissions=dict(permissions),physicalGpuVerified=False)
 bundle.with_name(bundle.name+'.sha256').write_text(sha+'  '+bundle.name+'\n');bundle.with_name(bundle.name+'.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
