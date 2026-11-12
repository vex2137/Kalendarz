import json, os, sys, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import part4_beta3_guard as guard

class LifecycleDiagnosticPolicy(unittest.TestCase):
    def test_previous_beta_identity_stays_unchanged(self):
        with patch.dict(os.environ, {'CALENDAR_ANDROID_LIFECYCLE_DIAGNOSTIC':'false'}):
            self.assertEqual(guard.policy()['versionCode'],10524)
            guard.identity("name='com.kalendarz.offline.diagnostics' versionCode='10524' versionName='1.5.0-part4-beta.3'")

    def test_diagnostic_has_distinct_monotonic_identity_and_no_other_packages(self):
        with patch.dict(os.environ, {'CALENDAR_ANDROID_LIFECYCLE_DIAGNOSTIC':'true'}):
            p=guard.policy();self.assertGreater(p['versionCode'],10524)
            self.assertEqual(p['versionName'],'1.5.0-part4-beta.3-diag.1')
            guard.identity("name='com.kalendarz.offline.diagnostics' versionCode='10525' versionName='1.5.0-part4-beta.3-diag.1'")
            self.assertNotIn('linuxFile',p)
            for bad in ["name='com.kalendarz.offline' versionCode='10525' versionName='1.5.0-part4-beta.3-diag.1'", "name='com.kalendarz.offline.diagnostics' versionCode='10524' versionName='1.5.0-part4-beta.3'"]:
                with self.assertRaises(ValueError):guard.identity(bad)

    def test_diagnostic_keeps_source_and_distribution_guards(self):
        with patch.dict(os.environ, {'CALENDAR_ANDROID_LIFECYCLE_DIAGNOSTIC':'true'}):
            info=dict(workflowCommit=os.environ.get('GITHUB_SHA'),commit='a'*40,branch=guard.BRANCH,dirty=False,version='1.5.0',distribution='model-free',bundledModel=False,androidNative=True,releaseChannel=guard.policy()['channel'])
            guard.verify_candidate_info(info,'a'*40,True)
            for bad in [{**info,'dirty':True},{**info,'commit':'b'*40},{**info,'releaseChannel':'part4-beta3'},{**info,'androidNative':False},{**info,'bundledModel':True}]:
                with self.assertRaises(ValueError):guard.verify_candidate_info(bad,'a'*40,True)

if __name__=='__main__':unittest.main()
