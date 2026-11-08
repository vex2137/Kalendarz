"""Offline guard tests. Synthetic APK/ASAR fixtures do not build applications."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import part2_artifact_guard as guard
spec = importlib.util.spec_from_file_location('candidate', ROOT / 'scripts/verify-part2-beta2-candidate.py')
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)
SOURCE = 'a' * 40
OTHER = 'b' * 40


def info(android=True, source=SOURCE):
    return dict(commit=source, dirty=False, version='1.5.0', distribution='model-free', bundledModel=False, androidNative=android)


def manifest():
    return dict(source=SOURCE, versionCode=10515, files=[dict(name=name, size=100, sha256='a' * 64) for name in
        ('Kalendarz-1.5.0-Part-2-Beta-2.apk', 'Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage')])


def write_asar(path, build):
    body = json.dumps(build).encode()
    header = json.dumps({'files': {'dist': {'files': {'build-info.json': {'offset': '0', 'size': len(body)}}}}}).encode()
    header_pickle = struct.pack('<I', len(header)) + header
    header_pickle += b'\0' * (-len(header_pickle) % 4)
    header_pickle = struct.pack('<I', len(header_pickle)) + header_pickle
    path.write_bytes(struct.pack('<II', 4, len(header_pickle)) + header_pickle + body)


class ArtifactGuards(unittest.TestCase):
    def test_committed_version_is_10515(self):
        self.assertEqual(guard.version_policy(), 10515)

    def test_version_cannot_downgrade_or_reuse_last_tested_code(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'scripts').mkdir()
            for previous, code in [(10514, 10509), (10514, 10514), (10515, 10515), (10513, 10515), (10514, True)]:
                (root / 'scripts/part2-beta2-version.json').write_text(json.dumps(dict(lastTestedVersionCode=previous, versionCode=code)))
                with self.subTest(previous=previous, code=code), patch.object(guard, 'ROOT', root), self.assertRaises(ValueError):
                    guard.version_policy()

    def test_exact_clean_head_and_remote_are_accepted(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(guard, 'run', side_effect=[SOURCE, '', SOURCE + '\trefs/heads/' + guard.BRANCH]):
            self.assertEqual(guard.expected_source(SOURCE, True), SOURCE)

    def test_arbitrary_ancestor_is_not_current_head(self):
        with patch.object(guard, 'run', return_value=OTHER), self.assertRaisesRegex(ValueError, 'checkout HEAD'):
            guard.expected_source(SOURCE)

    def test_dirty_checkout_is_rejected(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(guard, 'run', side_effect=[SOURCE, ' M android/app/build.gradle']), self.assertRaisesRegex(ValueError, 'Tracked'):
            guard.expected_source(SOURCE)

    def test_workflow_commit_must_match(self):
        with patch.dict(os.environ, {'GITHUB_SHA': OTHER}), patch.object(guard, 'run', return_value=SOURCE), self.assertRaisesRegex(ValueError, 'Workflow commit'):
            guard.expected_source(SOURCE)

    def test_branch_advancing_rejects_old_build(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(guard, 'run', side_effect=[SOURCE, '', OTHER + '\trefs/heads/' + guard.BRANCH]), self.assertRaisesRegex(ValueError, 'remote branch HEAD'):
            guard.expected_source(SOURCE, True)

    def test_both_platforms_require_same_exact_source(self):
        for android in (True, False):
            guard.verify_info(info(android), SOURCE, android)
            with self.subTest(android=android), self.assertRaisesRegex(ValueError, 'build-info'):
                guard.verify_info(info(android, OTHER), SOURCE, android)

    def test_incomplete_or_dirty_build_info_is_rejected(self):
        for values in ({'dirty': True}, {'dirty': None}, {'bundledModel': True}, {'androidNative': False}, {'version': '1.4.2'}):
            with self.subTest(values=values), self.assertRaises(ValueError):
                guard.verify_info({**info(), **values}, SOURCE, True)

    def test_manifest_requires_both_files_and_current_version_source(self):
        self.assertEqual(len(guard.verify_manifest(manifest(), SOURCE)), 2)
        for key, value in [('source', OTHER), ('versionCode', 10514), ('files', manifest()['files'][:1])]:
            bad = manifest(); bad[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                guard.verify_manifest(bad, SOURCE)
        bad = manifest(); bad['files'][0]['name'] = '../old.apk'
        with self.assertRaises(ValueError): guard.verify_manifest(bad, SOURCE)

    def test_appimage_actual_asar_metadata_detects_mixed_pair(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'app.asar'
            write_asar(archive, info(False))
            guard.verify_info(guard.asar_build_info(archive), SOURCE, False)
            write_asar(archive, info(False, OTHER))
            guard.verify_info(info(True), SOURCE, True)
            with self.assertRaises(ValueError):
                guard.verify_info(guard.asar_build_info(archive), SOURCE, False)

    def test_corrupt_asar_header_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = Path(directory) / 'app.asar'; archive.write_bytes(b'\0' * 16)
            with self.assertRaises(ValueError): guard.asar_build_info(archive)

    def test_apk_internal_source_identity_signature_and_runtime(self):
        binary = b'\x7fELF\x02\x01' + bytes(12) + b'\xb7\x00' + bytes(44)
        cert = 'Signer #1 certificate SHA-256 digest: ' + candidate.CERT
        badging = "package: name='com.kalendarz.offline.diagnostics' versionCode='10515' versionName='1.5.0-part2-beta.2'"
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'test.apk'
            for build, identity, certificate, valid in [(info(), badging, cert, True), (info(source=OTHER), badging, cert, False),
                    (info(), badging.replace('10515', '10514'), cert, False), (info(), badging, 'wrong certificate', False)]:
                with zipfile.ZipFile(apk, 'w') as archive:
                    archive.writestr('assets/public/build-info.json', json.dumps(build))
                    archive.writestr('lib/arm64-v8a/libcalendar_llama.so', binary)
                with self.subTest(source=build['commit'], identity=identity, cert=certificate), patch.object(candidate, 'RUNTIME_SHA256', hashlib.sha256(binary).hexdigest()), patch.object(candidate.subprocess, 'check_output', side_effect=[certificate, identity, '']):
                    if valid:
                        self.assertEqual(candidate.verify_apk(apk, SOURCE, Path('/tools'))['versionCode'], 10515)
                    else:
                        with self.assertRaises((ValueError, SystemExit)): candidate.verify_apk(apk, SOURCE, Path('/tools'))

    def test_gradle_and_packaging_use_shared_guards(self):
        gradle = (ROOT / 'android/app/build.gradle').read_text()
        self.assertIn('calendarPart2Beta ? calendarPart2VersionCode', gradle)
        self.assertIn("System.getenv('CALENDAR_EXPECTED_COMMIT')", gradle)
        self.assertIn("'scripts/part2_artifact_guard.py'", gradle)
        hook = (ROOT / 'scripts/verify-packaged-model.cjs').read_text()
        self.assertLess(hook.index('scripts/part2_artifact_guard.py'), hook.index('scripts/prepare-native.py'))
        workflow = (ROOT / '.github/workflows/publish-142.yml').read_text()
        self.assertIn('ref: ${{ github.sha }}', workflow)
        self.assertIn('CALENDAR_ARTIFACT_MANIFEST:', workflow)
        self.assertNotIn("hashFiles('manual-test-assets/linux", workflow)


if __name__ == '__main__':
    unittest.main()
