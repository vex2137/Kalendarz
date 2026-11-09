"""Check the actual unsigned Windows PE packages and their source/native payload."""
import hashlib,json,os,subprocess
from pathlib import Path
from part4_beta3_guard import ROOT,policy,expected_android_source,verify_candidate_info
from part2_artifact_guard import asar_build_info

def main():
 source=expected_android_source(os.environ['CALENDAR_EXPECTED_COMMIT'],True);p=policy();app=ROOT/'release/win-unpacked'
 verify_candidate_info(asar_build_info(app/'resources/app.asar'),source,False)
 runtime=app/'resources/native';meta=json.loads((runtime/'runtime-manifest.json').read_text())
 expected=json.loads((ROOT/'scripts/native-runtime-manifest.json').read_text())
 assert meta['commit']==expected.get('overrides',{}).get('win-x64',expected)['commit']
 assert {'cpu','vulkan'}<={Path(n).parts[0] for n in meta['files']}
 for n,sha in meta['files'].items():
  f=runtime/n;assert f.is_file() and hashlib.sha256(f.read_bytes()).hexdigest()==sha
 for name in ['cpu/llama-server.exe','vulkan/llama-server.exe']:
  binary=(runtime/name).read_bytes();offset=int.from_bytes(binary[60:64],'little');assert binary[offset:offset+6]==b'PE\0\0d\x86'
 out=ROOT/'part4-artifacts/windows';out.mkdir(parents=True,exist_ok=True)
 for key in ['setupFile','portableFile']:
  f=out/p[key];assert f.read_bytes()[:2]==b'MZ'
  # Windows resource editing must not be disabled merely because signing is unavailable.
  quoted=str(f).replace("'","''")
  script=f"$p='{quoted}'; $s=Get-AuthenticodeSignature -FilePath $p; if ($s.Status -ne 'NotSigned') {{ throw 'Unexpected signing identity' }}; Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Icon]::ExtractAssociatedIcon($p); if ($null -eq $i) {{ throw 'Missing PE icon' }}; $i.Dispose()"
  subprocess.run(['powershell','-NoProfile','-Command',script],check=True)
  with f.open('rb')as stream:sha=hashlib.file_digest(stream,'sha256').hexdigest()
  result=dict(file=f.name,source=source,channel=p['channel'],bytes=f.stat().st_size,sha256=sha,authenticode='NotSigned',nativeCommit=meta['commit'],nativeFilesVerified=len(meta['files']))
  f.with_name(f.name+'.sha256').write_text(sha+'  '+f.name+'\n');f.with_name(f.name+'.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':main()
