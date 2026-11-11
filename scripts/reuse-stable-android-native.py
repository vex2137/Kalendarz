"""Stage accepted CPU/Vulkan executables from the verified lifecycle APK; no LLVM rebuild."""
import hashlib,json,sys,zipfile
from pathlib import Path
from part4_beta3_guard import CPU_SHA256,RUNTIME_COMMIT
p=Path(sys.argv[1])
with p.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()=='80038012c11b27557821869ea02ac1df91c23df3c3a266a3fe5c4dadca73ce47'
root=Path('build/android-jni/arm64-v8a');root.mkdir(parents=True,exist_ok=True);assets=Path('build/android-native-assets');assets.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(p) as z:
 info=json.loads(z.read('assets/public/build-info.json'));assert info['commit']=='4eb01781cfe21b5b180c1d0f501a9a006e5eee0f'
 runtime=json.loads(z.read('assets/android-native-runtime.json'));vk=json.loads(z.read('assets/android-vulkan-runtime.json'));assert runtime['llamaCommit']==vk['llamaCommit']==RUNTIME_COMMIT
 for name,expected in [('libcalendar_llama.so',CPU_SHA256),('libcalendar_llama_vulkan.so',vk['binarySha256'])]:
  binary=z.read('lib/arm64-v8a/'+name);assert hashlib.sha256(binary).hexdigest()==expected;assert binary[:6]==b'\x7fELF\x02\x01' and binary[16:20]==b'\x03\x00\xb7\x00';(root/name).write_bytes(binary)
 for name in z.namelist():
  if not name.startswith('assets/') or name.startswith('assets/public/') or name.endswith('/') or name=='assets/android-vulkan-diagnostics.json':continue
  target=assets/name.removeprefix('assets/');assert target.resolve().is_relative_to(assets.resolve());target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
print('PASS unchanged accepted Android CPU/Vulkan binaries, exact hashes, ARM64 ELF and original runtime provenance')
