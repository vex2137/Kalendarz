"""Verify the built Stable Part 2 AppImage with the unchanged Beta 5 runtime inventory."""
import hashlib,importlib.util,json,os,shutil,subprocess
from pathlib import Path
from part2_stable_guard import ROOT,policy,expected_android_source,verify_stable_info
from part2_artifact_guard import asar_build_info

def main():
 source=expected_android_source(os.environ['CALENDAR_EXPECTED_COMMIT'],True)
 name=policy()['linuxFile'];package=ROOT/'release'/name
 with package.open('rb') as f:
  header=f.read(20);f.seek(0);checksum=hashlib.file_digest(f,'sha256').hexdigest()
 if header[:6]!=b'\x7fELF\x02\x01' or header[18:20]!=b'\x3e\x00':raise ValueError('Not an x86_64 AppImage')
 package.chmod(0o755);extract=ROOT/'build/checked-appimage';extract.mkdir(parents=True,exist_ok=True)
 subprocess.run([str(package),'--appimage-extract'],cwd=extract,stdout=subprocess.DEVNULL,check=True)
 appdir=extract/'squashfs-root';verify_stable_info(asar_build_info(appdir/'resources/app.asar'),source,False)
 spec=importlib.util.spec_from_file_location('baseline',ROOT/'scripts/verify-part2-appimage.py');baseline=importlib.util.module_from_spec(spec);spec.loader.exec_module(baseline)
 count=baseline.verify_extracted(appdir,source)
 for path in (appdir/'resources/native').rglob('*'):
  if path.is_file():
   with path.open('rb') as f:header=f.read(20)
   if header[:4]==b'\x7fELF' and header[18:20]!=b'\x3e\x00':raise ValueError('Non-desktop native library included: '+path.name)
 out=ROOT/'stable-artifacts/linux';out.mkdir(parents=True,exist_ok=True);target=out/name
 try:os.link(package,target)
 except OSError:shutil.copy2(package,target)
 result=dict(file=name,bytes=target.stat().st_size,sha256=checksum,source=source,channel='part2-stable',nativeFilesVerified=count,desktopBaseline='e83a268f11cb50143bb599f2401384b92cf927c6',androidNativeLibrariesPackaged=False,physicalGpuVerified=False)
 (out/(name+'.sha256')).write_text(checksum+'  '+name+'\n');(out/(name+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 (ROOT/'manual-test-assets/appimage').mkdir(parents=True,exist_ok=True)
 print(json.dumps(result))
if __name__=='__main__':main()
