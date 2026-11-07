"""Offline negative package tests: synthetic ZIPs never imply device execution."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import android_beta5_guard as guard


class AndroidBeta5GuardTest(unittest.TestCase):
    def test_identity_keeps_update_package_and_increases_code(self):
        p = guard.policy()
        self.assertGreater(p['versionCode'], 10515)
        guard.identity("package: name='com.kalendarz.offline.diagnostics' versionCode='10516' versionName='1.5.0-part2-beta.5'")
        for bad in ["name='com.kalendarz.offline'", "name='com.kalendarz.offline.diagnostics' versionCode='10515' versionName='1.5.0-part2-beta.5'"]:
            with self.assertRaises(ValueError): guard.identity(bad)

    def test_old_paired_guard_is_unchanged(self):
        import part2_artifact_guard as old
        self.assertEqual(old.version_policy(), 10515)
        with self.assertRaises(ValueError): old.verify_android_identity("name='com.kalendarz.offline.diagnostics' versionCode='10516' versionName='1.5.0-part2-beta.5'")

    def package(self, path, **overrides):
        binary = b'\x7fELF\x02\x01' + bytes(10) + b'\x03\x00\xb7\x00'
        runtime = dict(llamaCommit=guard.RUNTIME_COMMIT, llamaVersion='b12189', abi='arm64-v8a', backends=['cpu-native'], architectures=['lfm3','qwen35'], binarySha256=hashlib.sha256(binary).hexdigest(), sources=[dict(url='https://codeload.github.com/ggml-org/llama.cpp/tar.gz/'+guard.RUNTIME_COMMIT, sha256=guard.SOURCE_SHA256)])
        runtime.update(overrides.get('runtime', {}))
        info=dict(commit=overrides.get('source','a'*40),dirty=False,version='1.5.0',distribution='model-free',bundledModel=False,androidNative=True)
        with zipfile.ZipFile(path, 'w') as z:
            z.writestr('lib/arm64-v8a/libcalendar_llama.so', overrides.get('binary', binary))
            z.writestr('assets/android-native-runtime.json', json.dumps(runtime))
            z.writestr('assets/public/build-info.json',json.dumps(info))
            if 'extra' in overrides:z.writestr(overrides['extra'],b'forbidden')

    def verify(self, path):
        outputs=['certificate SHA-256 digest: '+guard.CERT,"name='com.kalendarz.offline.diagnostics' versionCode='10516' versionName='1.5.0-part2-beta.5'",'']
        with patch.object(guard.subprocess,'check_output',side_effect=outputs):
            return guard.verify_apk(path,'a'*40,Path('/fake-sdk'))

    def test_verified_package_has_independent_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME;self.package(p)
            result=self.verify(p)
            self.assertEqual(result['sha256'],hashlib.sha256(p.read_bytes()).hexdigest())

    def test_rejects_stale_source_runtime_tamper_wrong_abi_and_forbidden_payloads(self):
        mutations=[dict(source='b'*40),dict(runtime={'llamaCommit':'620d2225cc436ab0b001e3200e590e3b286ef9ab'}),dict(runtime={'binarySha256':'0'*64}),dict(binary=b'Linux x86_64'),dict(extra='assets/private.gguf'),dict(extra='assets/signing.p12'),dict(extra='lib/x86_64/runtime.so')]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME
            for values in mutations:
                with self.subTest(values=values):
                    self.package(p,**values)
                    with self.assertRaises(ValueError): self.verify(p)

    def test_rejects_new_signing_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME;self.package(p)
            with patch.object(guard.subprocess,'check_output',return_value='certificate SHA-256 digest: '+'0'*64):
                with self.assertRaises(ValueError):guard.verify_apk(p,'a'*40,Path('/fake-sdk'))


if __name__=='__main__':unittest.main()
