"""Offline release guard tests. Synthetic GGUF/ELF fixtures are not inference evidence."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


verify = load('verify_v142_test', 'scripts/verify-android-v142.py')
depot = load('depot_v142_test', 'scripts/private-model-depot.py')
installer = load('installer_v142_test', 'scripts/install-android-v142.py')


class ReleaseTests(unittest.TestCase):
    def test_pinned_release_manifest(self):
        self.assertEqual(verify.release_model()['id'], verify.MODEL_ID)

    def test_update_identity_and_certificate(self):
        badging = "package: name='com.kalendarz.offline.diagnostics' versionCode='10407' versionName='1.4.2'"
        certificate = 'Signer #1 certificate SHA-256 digest: ' + verify.CERTIFICATE
        verify.verify_identity(badging, certificate)
        for wrong in [badging.replace('10407', '10402'), badging.replace('1.4.2', '1.4.1'),
                      badging.replace('.diagnostics', ''), badging.replace('1.4.2', '1.4.2-diagnostics')]:
            with self.assertRaises(ValueError): verify.verify_identity(wrong, certificate)
        for wrong in [certificate.replace(verify.CERTIFICATE, '21dad049ec04cb5c4f269f17b56f11123a07abcb7f7fa595cb77c9943f7e02b3'),
                      certificate + '\nSigner #2 certificate SHA-256 digest: ' + verify.CERTIFICATE, '']:
            with self.assertRaises(ValueError): verify.verify_identity(badging, wrong)

    def fixture(self):
        weights = b'GGUF' + b'fixture' * 16
        license_data = b'fixture-license'
        model = {**verify.release_model(), 'bytes': len(weights), 'sha256': hashlib.sha256(weights).hexdigest(),
                 'licenseSha256': hashlib.sha256(license_data).hexdigest()}
        binary = bytearray(64); binary[:6] = b'\x7fELF\x02\x01'; struct.pack_into('<H', binary, 18, 183)
        data = {
            'assets/public/build-info.json': json.dumps({'version': '1.4.2', 'dirty': False, 'androidNative': True, 'commit': 'a' * 40}),
            'assets/public/models/manifest.json': json.dumps({key: model[key] for key in ('file', 'bytes', 'sha256')}),
            'assets/public/models/catalogue.json': json.dumps([model]),
            'assets/public/models/' + model['file']: weights,
            'assets/public/models/LICENSE.txt': license_data,
            'assets/public/models/NOTICE.txt': model['revision'],
            'lib/arm64-v8a/libcalendar_llama.so': binary,
            'assets/android-native-runtime.json': json.dumps({'abi': 'arm64-v8a', 'llamaCommit': verify.LLAMA_COMMIT,
                                                              'binarySha256': hashlib.sha256(binary).hexdigest()}),
        }
        return model, data

    def check_fixture(self, model, data, compression=zipfile.ZIP_STORED):
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / 'fixture.apk'
            with zipfile.ZipFile(apk, 'w', compression=compression) as archive:
                for name, value in data.items(): archive.writestr(name, value)
            verify.verify_contents(apk, 'a' * 40, model)

    def test_contents_reject_tampering_missing_or_additional_weights_and_wrong_engine(self):
        model, data = self.fixture()
        self.check_fixture(model, data)
        weight_key = 'assets/public/models/' + model['file']
        for name, value in [(weight_key, b'GGUF' + b'x' * (model['bytes'] - 4)),
                            (weight_key, b'short'), ('assets/public/models/old.gguf', b'GGUF'),
                            ('assets/public/models/manifest.json', '{}'),
                            ('assets/public/models/catalogue.json', '[{}]'),
                            ('assets/public/models/LICENSE.txt', 'wrong'),
                            ('assets/public/models/NOTICE.txt', 'wrong'),
                            ('lib/arm64-v8a/libcalendar_llama.so', b'not an ELF'),
                            ('assets/android-native-runtime.json', '{}')]:
            changed = {**data, name: value}
            with self.subTest(name=name), self.assertRaises((ValueError, KeyError)):
                self.check_fixture(model, changed)
        with self.assertRaises(ValueError):
            self.check_fixture(model, {name: value for name, value in data.items() if name != weight_key})
        with self.assertRaises(ValueError): self.check_fixture(model, data, zipfile.ZIP_DEFLATED)

    def test_build_provenance_and_distribution_guards(self):
        model, data = self.fixture()
        name = 'assets/public/build-info.json'
        for key, value in [('version', '1.4.1'), ('dirty', True), ('commit', 'b' * 40),
                           ('androidNative', False), ('bundledModel', False), ('distribution', 'model-free')]:
            changed = {**json.loads(data[name]), key: value}
            with self.subTest(key=key), self.assertRaises(ValueError):
                self.check_fixture(model, {**data, name: json.dumps(changed)})

    def test_depot_refuses_public_internal_and_published_sources(self):
        for repo in [{'private': False, 'visibility': 'public'}, {'private': True, 'visibility': 'internal'}]:
            with patch.object(depot, 'api', return_value=repo), self.assertRaises(ValueError):
                depot.private_draft('owner/depot', '123')
        with patch.object(depot, 'api', side_effect=[{'private': True, 'visibility': 'private'}, {'draft': False}]), self.assertRaises(ValueError):
            depot.private_draft('owner/depot', '123')
        with patch.object(depot, 'api') as api, self.assertRaises(ValueError):
            depot.private_draft('https://elsewhere/depot', '123')
        api.assert_not_called()

    def test_depot_download_is_verified_before_commit_and_cleans_failures(self):
        draft = {'assets': [{'id': 42, 'name': verify.MODEL_FILE, 'size': verify.MODEL_BYTES}]}
        class Result: returncode = 0
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / verify.MODEL_FILE
            with patch.object(depot, 'private_draft', return_value=draft), patch.object(depot.subprocess, 'run', return_value=Result()), self.assertRaises(ValueError):
                depot.fetch('owner/depot', '123', target)
            self.assertFalse(target.exists())
            self.assertFalse(target.with_suffix('.partial').exists())

    def test_depot_does_not_overwrite_assets(self):
        draft = {'assets': [{'name': 'already.apk'}]}
        with patch.object(depot, 'private_draft', return_value=draft), patch.object(depot.subprocess, 'run') as run, self.assertRaises(ValueError):
            depot.upload('owner/depot', '123', [Path('already.apk')])
        run.assert_not_called()

    def test_prepare_model_requires_private_input_and_verifies_local_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for path in ['scripts', 'src/utils', 'public/models']: (root / path).mkdir(parents=True)
            shutil.copyfile(ROOT / 'scripts/prepare-model.cjs', root / 'scripts/prepare-model.cjs')
            model, data = self.fixture()
            for name, value in [('localModelManifest.json', model), ('optionalModels.json', []), ('fineTunedModels.json', [])]:
                (root / 'src/utils' / name).write_text(json.dumps(value))
            env = {key: value for key, value in os.environ.items() if key != 'CALENDAR_MODEL_FILE'}
            run = lambda: subprocess.run(['node', 'scripts/prepare-model.cjs'], cwd=root, env=env, capture_output=True, text=True)
            result = run(); self.assertNotEqual(result.returncode, 0); self.assertIn('CALENDAR_MODEL_FILE', result.stderr)
            source = root / 'private.gguf'; source.write_bytes(b'GGUF' + b'x' * (model['bytes'] - 4))
            env['CALENDAR_MODEL_FILE'] = str(source)
            self.assertNotEqual(run().returncode, 0)
            source.write_bytes(data['assets/public/models/' + model['file']])
            (root / 'public/models/LICENSE.txt').write_bytes(data['assets/public/models/LICENSE.txt'])
            result = run(); self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((root / 'public/models' / model['file']).read_bytes(), source.read_bytes())
            # Existing bundled bytes are adopted without a network transfer or source file.
            source.unlink(); self.assertEqual(run().returncode, 0)

    def test_installer_uses_only_replace_after_checking_both_apks(self):
        certificate = 'Signer #1 certificate SHA-256 digest: ' + verify.CERTIFICATE
        badging = "package: name='com.kalendarz.offline.diagnostics' versionCode='10406' versionName='1.4.1'"
        replies = ['device', 'package:/data/app/calendar/base.apk', certificate, badging,
                   'versionCode=10407 minSdk=28\nversionName=1.4.2\n']
        args = ['install-android-v142.py', '/tmp/update.apk', '--sdk', '/tmp/sdk', '--commit', 'a' * 40]
        with patch('sys.argv', args), patch.object(installer.subprocess, 'check_output', side_effect=replies), patch.object(installer.subprocess, 'run') as run, patch('builtins.print'):
            installer.main()
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(commands[0][0], 'python3', 'Verify the incoming APK before contacting the phone')
        self.assertEqual(commands[-1], ['/tmp/sdk/platform-tools/adb', 'install', '-r', '/tmp/update.apk'])
        self.assertFalse(any(token in ['uninstall', 'clear', '-d'] for command in commands for token in command))

    def test_installer_refuses_an_installed_certificate_or_version_mismatch(self):
        certificate = 'Signer #1 certificate SHA-256 digest: ' + verify.CERTIFICATE
        badging = "package: name='com.kalendarz.offline.diagnostics' versionCode='10406' versionName='1.4.1'"
        args = ['install-android-v142.py', '/tmp/update.apk', '--sdk', '/tmp/sdk', '--commit', 'a' * 40]
        for cert, badge in [(certificate.replace(verify.CERTIFICATE, '0' * 64), badging),
                            (certificate, badging.replace('10406', '10408'))]:
            replies = ['device', 'package:/data/app/calendar/base.apk', cert, badge]
            with patch('sys.argv', args), patch.object(installer.subprocess, 'check_output', side_effect=replies), patch.object(installer.subprocess, 'run') as run, self.assertRaises(ValueError):
                installer.main()
            self.assertFalse(any('install' in call.args[0] for call in run.call_args_list))


if __name__ == '__main__':
    unittest.main()
