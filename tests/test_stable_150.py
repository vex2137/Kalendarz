import unittest,sys,os,json,copy
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
import stable_150_guard as stable
import part4_beta3_guard as historical
class Stable150(unittest.TestCase):
 def info(self):return dict(commit='a'*40,dirty=False,version='1.5.0',versionName='1.5.0',versionCode=10526,releaseChannel='stable',branch='feat/1.5.0-part4',distribution='model-free',bundledModel=False,androidNative=True,workflowCommit=os.environ.get('GITHUB_SHA'))
 def test_version_code_monotonic_and_final_names(self):
  p=stable.policy();self.assertGreater(p['versionCode'],10525);self.assertEqual(p['versionName'],'1.5.0');self.assertEqual(p['channel'],'stable');self.assertEqual(len([k for k in p if k.endswith('File')]),7)
 def test_stable_metadata_and_reject_wrong_identity_channel_distribution(self):
  stable.verify_candidate_info(self.info(),'a'*40,True)
  for key,value in [('versionCode',10525),('releaseChannel','part4-beta3'),('versionName','1.5.0-part4-beta.3'),('bundledModel',True),('distribution','bundled'),('dirty',True),('commit','b'*40)]:
   bad=self.info();bad[key]=value
   with self.subTest(key=key),self.assertRaises(ValueError):stable.verify_candidate_info(bad,'a'*40,True)
 def test_historical_beta_checks_remain_strict(self):
  with patch.dict(os.environ,{'CALENDAR_ANDROID_LIFECYCLE_DIAGNOSTIC':'false'}):
   self.assertEqual(historical.policy()['versionCode'],10524)
   with self.assertRaises(ValueError):historical.verify_candidate_info(self.info(),'a'*40,True)
 def test_stable_android_identity_is_explicit(self):
  p=stable.policy();historical.identity("name='com.kalendarz.offline.diagnostics' versionCode='10526' versionName='1.5.0'",p)
  for value in ["name='com.kalendarz.offline' versionCode='10526' versionName='1.5.0'","name='com.kalendarz.offline.diagnostics' versionCode='10525' versionName='1.5.0'","name='com.kalendarz.offline.diagnostics' versionCode='10526' versionName='1.5.0-part4-beta.3'"]:
   with self.assertRaises(ValueError):historical.identity(value,p)
 def test_debuggable_apk_is_rejected(self):
  stable.reject_debuggable('A: android:debuggable(0x0101000f)=(type 0x12)0x0')
  with self.assertRaises(ValueError):stable.reject_debuggable('A: android:debuggable(0x0101000f)=(type 0x12)0xffffffff')
 def test_gradle_has_stable_only_update_identity_and_release_signature(self):
  s=(ROOT/'android/app/build.gradle').read_text();self.assertIn("calendarFinalStable ? 'scripts/stable_150_guard.py'",s);self.assertIn('if (calendarFinalStable) { debuggable false; jniDebuggable false }',s);self.assertIn("if (calendarQwenV2Update || calendarPart2Beta || calendarFinalStable) signingConfig signingConfigs.stableRelease",s);self.assertIn("applicationIdSuffix '.diagnostics'",s);self.assertIn(historical.CERT,s)
if __name__=='__main__':unittest.main()
