import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('native_check',Path(__file__).resolve().parents[1]/'scripts/check-built-native-runtime.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
pin={'version':'b12189','commit':'80d2c0c2c56e4a1bbf74be98f64b99927bf230bc'}

class RuntimeVersionTests(unittest.TestCase):
    def test_upstream_short_and_full_commit_banners(self):
        for sha in [pin['commit'][:9],pin['commit'][:10],pin['commit']]:
            check.validate_version(f'version: 0.9.0-dev (build 12189, commit {sha})\nbuilt with GNU',pin)

    def test_stale_or_unparseable_binary_is_rejected(self):
        for output in ['version: (build 11669, commit 620d2225c)','version: (build 12189, commit 123456789)','12189 80d2c0c2c','version: (build 12189, commit 80d)']:
            with self.subTest(output=output),self.assertRaises(ValueError):check.validate_version(output,pin)

if __name__=='__main__':unittest.main()
