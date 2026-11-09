import unittest,sys,json,hashlib,tempfile,importlib.util,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import part4_beta2_guard as guard
spec=importlib.util.spec_from_file_location('delivery2',guard.ROOT/'scripts/check-part4-beta2-delivery.py');delivery=importlib.util.module_from_spec(spec);spec.loader.exec_module(delivery)
class Beta2PolicyTest(unittest.TestCase):
 def test_android_monotonic_identity_and_prior_ancestry(self):
  p=guard.policy();self.assertGreater(p['versionCode'],10522);self.assertEqual(p['versionName'],'1.5.0-part4-beta.2');guard.identity("name='com.kalendarz.offline.diagnostics' versionCode='10523' versionName='1.5.0-part4-beta.2'")
  for bad in ["name='com.kalendarz.offline.diagnostics' versionCode='10522' versionName='1.5.0-part4-beta.2'","name='com.kalendarz.offline' versionCode='10523' versionName='1.5.0-part4-beta.2'"]:
   with self.assertRaises(ValueError):guard.identity(bad)
 def test_five_downloaded_packages_require_same_source_and_exact_bytes(self):
  with tempfile.TemporaryDirectory()as tmp:
   root=Path(tmp);source='a'*40;p=guard.policy()
   for platform,key in [('android','androidFile'),('linux','linuxFile'),('flatpak','flatpakFile'),('windows','setupFile'),('windows','portableFile')]:
    f=root/platform/p[key];f.parent.mkdir(exist_ok=True);f.write_bytes(b'test fixture')
    report=dict(source=source,channel=p['channel'],bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest(),versionCode=p['versionCode'],package='com.kalendarz.offline.diagnostics',certificateSha256=guard.CERT)
    f.with_name(f.name+'.json').write_text(json.dumps(report))
   self.assertEqual(len(delivery.verify(root,source)['files']),5)
   (root/'windows'/p['portableFile']).write_bytes(b'changed')
   with self.assertRaises(AssertionError):delivery.verify(root,source)
 def test_beta2_info_rejects_beta1_and_dirty_source(self):
  info=dict(workflowCommit=os.environ.get('GITHUB_SHA'),commit='a'*40,branch=guard.BRANCH,dirty=False,version='1.5.0',distribution='model-free',bundledModel=False,androidNative=False,releaseChannel='part4-beta2')
  guard.verify_candidate_info(info,'a'*40,False)
  for bad in [{**info,'releaseChannel':'part4-beta1'},{**info,'dirty':True},{**info,'commit':'b'*40}]:
   with self.assertRaises(ValueError):guard.verify_candidate_info(bad,'a'*40,False)
class FlatpakPermissionsTest(unittest.TestCase):
 def test_semantic_fallback_flags_and_minimal_grants(self):
  spec=importlib.util.spec_from_file_location('flatpak_checker',guard.ROOT/'scripts/check-part4-beta2-flatpak.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  base=dict(devices='dri;',shared='network;ipc;',sockets='wayland;x11;fallback-x11;')
  m.verify_permissions(base);m.verify_permissions({**base,'sockets':'fallback-x11;wayland;x11;'})
  for bad in [{**base,'filesystems':'home;'},{**base,'devices':'all;'},{**base,'sockets':'wayland;x11;'},{**base,'sockets':base['sockets']+'system-bus;'}]:
   with self.assertRaises(AssertionError):m.verify_permissions(bad)
if __name__=='__main__':unittest.main()
