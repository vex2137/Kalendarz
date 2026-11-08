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
import android_beta7_guard as guard


class AndroidBeta6GuardTest(unittest.TestCase):
    def test_identity_keeps_update_package_and_increases_code(self):
        p = guard.policy()
        self.assertGreater(p['versionCode'], 10517)
        guard.identity("package: name='com.kalendarz.offline.diagnostics' versionCode='10518' versionName='1.5.0-part2-beta.7'")
        for bad in ["name='com.kalendarz.offline'", "name='com.kalendarz.offline.diagnostics' versionCode='10515' versionName='1.5.0-part2-beta.5'"]:
            with self.assertRaises(ValueError): guard.identity(bad)

    def test_old_paired_guard_is_unchanged(self):
        import part2_artifact_guard as old
        self.assertEqual(old.version_policy(), 10515)
        with self.assertRaises(ValueError): old.verify_android_identity("name='com.kalendarz.offline.diagnostics' versionCode='10518' versionName='1.5.0-part2-beta.7'")

    def package(self, path, **overrides):
        binary = b'\x7fELF\x02\x01' + bytes(10) + b'\x03\x00\xb7\x00'
        runtime = dict(llamaCommit=guard.RUNTIME_COMMIT, llamaVersion='b12189', abi='arm64-v8a', backends=['cpu-native','vulkan'], architectures=['lfm3','qwen35'], binarySha256=hashlib.sha256(binary).hexdigest(), sources=[dict(url='https://codeload.github.com/ggml-org/llama.cpp/tar.gz/'+guard.RUNTIME_COMMIT, sha256=guard.SOURCE_SHA256)])
        gpu=binary+b'vulkan'
        vk=dict(llamaCommit=guard.RUNTIME_COMMIT,llamaVersion='b12189',abi='arm64-v8a',binarySha256=hashlib.sha256(gpu).hexdigest())
        runtime['vulkan']=vk
        runtime.update(overrides.get('runtime', {}))
        info=dict(workflowCommit=overrides.get('workflowCommit',guard.os.environ.get('GITHUB_SHA')),branch='feat/1.5.0-part2',commit=overrides.get('source','a'*40),dirty=False,version='1.5.0',distribution='model-free',bundledModel=False,androidNative=True)
        with zipfile.ZipFile(path, 'w') as z:
            z.writestr('lib/arm64-v8a/libcalendar_llama.so', overrides.get('binary', binary))
            z.writestr('lib/arm64-v8a/libcalendar_llama_vulkan.so',overrides.get('gpu',gpu))
            z.writestr('assets/android-vulkan-runtime.json',json.dumps(vk))
            probe=binary+b'probe'
            z.writestr('lib/arm64-v8a/libcalendar_gpu_probe.so', probe)
            z.writestr('assets/android-vulkan-diagnostics.json',json.dumps(dict(version=1,probeVersion='beta6-v1',sourceCommit='a'*40,shaderSourceSha256=hashlib.sha256((guard.ROOT/'android/native/vector-add.comp').read_bytes()).hexdigest(),probeSourceSha256=hashlib.sha256((guard.ROOT/'android/native/vulkan-probe.cpp').read_bytes()).hexdigest(),binarySha256=hashlib.sha256(probe).hexdigest(),computeElements=64,processTimeoutMs=6000,fenceTimeoutMs=2000,cpuInferenceUnchanged=True)))
            z.writestr('assets/android-native-runtime.json', json.dumps(runtime))
            z.writestr('assets/public/build-info.json',json.dumps(info))
            if 'extra' in overrides:z.writestr(overrides['extra'],b'forbidden')

    def verify(self, path):
        outputs=['certificate SHA-256 digest: '+guard.CERT,"name='com.kalendarz.offline.diagnostics' versionCode='10518' versionName='1.5.0-part2-beta.7'",'']
        binary=b'\x7fELF\x02\x01'+bytes(10)+b'\x03\x00\xb7\x00'
        with patch.object(guard,'CPU_SHA256',hashlib.sha256(binary).hexdigest()),patch.object(guard.subprocess,'check_output',side_effect=outputs):
            return guard.verify_apk(path,'a'*40,Path('/fake-sdk'))

    def test_verified_package_has_independent_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME;self.package(p)
            result=self.verify(p)
            self.assertEqual(result['sha256'],hashlib.sha256(p.read_bytes()).hexdigest())

    def test_rejects_stale_source_runtime_tamper_wrong_abi_and_forbidden_payloads(self):
        mutations=[dict(gpu=b'bad ARM64 GPU'),dict(runtime={'backends':['cpu-native']}),dict(source='b'*40),dict(runtime={'llamaCommit':'620d2225cc436ab0b001e3200e590e3b286ef9ab'}),dict(runtime={'binarySha256':'0'*64}),dict(binary=b'Linux x86_64'),dict(extra='assets/private.gguf'),dict(extra='assets/signing.p12'),dict(extra='lib/x86_64/runtime.so')]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME
            for values in mutations:
                with self.subTest(values=values):
                    self.package(p,**values)
                    with self.assertRaises(ValueError): self.verify(p)

    def test_rejects_incorrect_private_workflow_commit(self):
        with tempfile.TemporaryDirectory() as tmp,patch.dict(guard.os.environ,{'GITHUB_REPOSITORY':'vex2137/Kalendarz-private-builds','GITHUB_SHA':'c'*40}):
            p=Path(tmp)/guard.NAME;self.package(p,workflowCommit='b'*40)
            with self.assertRaisesRegex(ValueError,'Private workflow provenance mismatch'):self.verify(p)

    def test_rejects_new_signing_key(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/guard.NAME;self.package(p)
            with patch.object(guard.subprocess,'check_output',return_value='certificate SHA-256 digest: '+'0'*64):
                with self.assertRaises(ValueError):guard.verify_apk(p,'a'*40,Path('/fake-sdk'))


if __name__=='__main__':unittest.main()
