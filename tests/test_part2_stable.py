import importlib.util,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import part2_stable_guard as guard
spec=importlib.util.spec_from_file_location('delivery',ROOT/'scripts/check-part2-stable-delivery.py');delivery=importlib.util.module_from_spec(spec);spec.loader.exec_module(delivery)
class StableGuardTest(unittest.TestCase):
 def test_monotonic_part2_label_keeps_base_version(self):
  p=guard.policy();self.assertEqual(p['version'],'1.5.0');self.assertEqual(p['channel'],'part2-stable');self.assertGreater(p['versionCode'],10518)
 def test_update_identity_cannot_downgrade_or_change_package(self):
  expected="name='com.kalendarz.offline.diagnostics' versionCode='10519' versionName='1.5.0-part2-stable'"
  guard.identity(expected)
  for bad in [expected.replace('10519','10518'),expected.replace('.diagnostics',''),expected.replace('part2-stable','part2-beta.7')]:
   with self.assertRaises(ValueError):guard.identity(bad)
 def test_provenance_rejects_wrong_platform_missing_channel_and_dirty_source(self):
  info=dict(commit='a'*40,branch='feat/1.5.0-part2',dirty=False,version='1.5.0',distribution='model-free',bundledModel=False,androidNative=False,releaseChannel='part2-stable')
  with patch.dict(os.environ,{},clear=True):
   guard.verify_stable_info(info,'a'*40,False)
   for change in [dict(androidNative=True),dict(releaseChannel='beta7'),dict(dirty=True),dict(commit='b'*40),dict(branch='main')]:
    with self.assertRaises(ValueError):guard.verify_stable_info({**info,**change},'a'*40,False)
 def test_downloads_require_same_source_matching_bytes_and_certificate(self):
  import hashlib
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);policy=guard.policy()
   for platform,key in [('android','androidFile'),('linux','linuxFile')]:
    folder=root/platform;folder.mkdir();f=folder/policy[key];f.write_bytes(platform.encode())
    data=dict(source='a'*40,channel='part2-stable',bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),versionCode=10519,package='com.kalendarz.offline.diagnostics',certificateSha256=guard.CERT)
    f.with_name(f.name+'.json').write_text(json.dumps(data))
   self.assertEqual(len(delivery.verify(root,'a'*40)['files']),2)
   with self.assertRaises(AssertionError):delivery.verify(root,'b'*40)
   f=root/'linux'/policy['linuxFile'];f.write_bytes(b'tampered')
   with self.assertRaises(AssertionError):delivery.verify(root,'a'*40)
if __name__=='__main__':unittest.main()
