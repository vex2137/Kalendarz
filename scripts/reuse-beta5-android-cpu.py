"""Recover only the unchanged, signed Beta 5 native CPU runtime and notices."""
import argparse,hashlib,json,os,shutil,zipfile
from pathlib import Path
from android_beta5_guard import ROOT,verify_apk
p=argparse.ArgumentParser();p.add_argument('apk',type=Path);a=p.parse_args()
expected='3ea82cde035b920a1b5cbc9f9815b74b93f0b41fdada3409cead2d14a82f2dd2'
with a.apk.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==expected,'Wrong base APK'
report=verify_apk(a.apk,'7c4785c10cbcabd64a545754d3cfb184870ba2ba',Path(os.environ['ANDROID_HOME'])/'build-tools/35.0.0')
assert report['runtime']['binarySha256']=='83949aeb80b5f899e3b6297df2b547379e63570bffe8eb5276bc44516e034ed5'
with zipfile.ZipFile(a.apk) as z:
 out=ROOT/'build/android-jni/arm64-v8a';out.mkdir(parents=True,exist_ok=True)
 (out/'libcalendar_llama.so').write_bytes(z.read('lib/arm64-v8a/libcalendar_llama.so'))
 notices=ROOT/'build/android-native-assets';notices.mkdir(parents=True,exist_ok=True)
 for name in z.namelist():
  if name.endswith('/'):continue
  if name=='assets/android-native-runtime.json' or name.startswith(('assets/llama-cpp-LICENSE','assets/llama-third-party/','assets/upstream-')):
   target=notices/name.removeprefix('assets/');assert target.resolve().is_relative_to(notices.resolve())
   target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(name))
print('Recovered verified b12189 CPU executable and native licenses only; no web assets, model files or application source reused.')
