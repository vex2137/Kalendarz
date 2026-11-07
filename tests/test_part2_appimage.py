"""Only validate the new explicit Linux path. No build, transfer or inference."""
import importlib.util
from pathlib import Path
import sys
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('linux_guard',ROOT/'scripts/verify-part2-appimage.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
from part2_artifact_guard import verify_manifest
class AppImageGuardTests(unittest.TestCase):
    def manifest(self):return {'kind':'appimage-test','source':'a'*40,'files':[{'name':guard.NAME,'size':100,'sha256':'b'*64}]}
    def test_explicit_linux_manifest(self):self.assertEqual(guard.appimage_manifest(self.manifest(),'a'*40)['name'],guard.NAME)
    def test_stale_source_is_rejected(self):
        with self.assertRaises(ValueError):guard.appimage_manifest(self.manifest(),'c'*40)
    def test_apk_and_invalid_hashes_are_rejected(self):
        for changes in [{'name':'old.apk'},{'sha256':'invalid'},{'size':True}]:
            m=self.manifest();m['files'][0].update(changes)
            with self.subTest(changes=changes),self.assertRaises(ValueError):guard.appimage_manifest(m,'a'*40)
        m=self.manifest();m['kind']='pair'
        with self.assertRaises(ValueError):guard.appimage_manifest(m,'a'*40)
    def test_original_pair_guard_still_requires_apk_and_appimage(self):
        m=self.manifest();m['versionCode']=10515
        with self.assertRaises(ValueError):verify_manifest(m,'a'*40)
        workflow=(ROOT/'.github/workflows/publish-142.yml').read_text()
        self.assertIn("inputs.target == 'appimage-test'",workflow);self.assertIn("inputs.target == 'pair'",workflow)
if __name__=='__main__':unittest.main()
