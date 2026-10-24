"""Focused artifact tests; no application builds, private signing keys or network."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('assets', ROOT / 'scripts/maintain-android-assets.py')
assets = importlib.util.module_from_spec(spec); spec.loader.exec_module(assets)


class NamingTests(unittest.TestCase):
    def test_checksum_names_preserve_hashes_and_ignore_sidecars(self):
        rows = [{'name':'Calendar-1.4.0-android.apk','digest':'sha256:'+'a'*64},
                {'name':'Calendar-1.4.0-web.zip','digest':'sha256:'+'b'*64},
                {'name':'SHA256SUMS.txt','digest':'sha256:'+'c'*64}]
        self.assertEqual(assets.checksum_content(rows), ('a'*64+'  Calendar-1.4.0-android.apk\n'+'b'*64+'  Calendar-1.4.0-web.zip\n').encode())
        with self.assertRaises(AssertionError): assets.checksum_content([{'name':'broken.apk','digest':None}])

    def test_metadata_patch_cannot_change_apk_bytes(self):
        original={'id':1,'name':'old.apk','size':7,'digest':'sha256:'+'a'*64}
        with patch.object(assets,'api',return_value={**original,'name':'new.apk'}) as call:
            assets.rename(original,'new.apk')
            call.assert_called_once_with('releases/assets/1','PATCH',{'name':'new.apk'})
        with patch.object(assets,'api',return_value={**original,'digest':'sha256:'+'b'*64}):
            with self.assertRaises(AssertionError): assets.rename(original,'new.apk')

    def test_text_replace_refuses_apk_upload_or_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(AssertionError): assets.replace_text({},None,'app.apk',b'x',Path(directory))

    def test_production_manifest_rejects_test_and_mixed_apks(self):
        package=json.loads((ROOT/'package.json').read_text());version=package['version'];prefix=package['productName']+'-'+version
        other=[prefix+'-windows-x64-setup.exe',prefix+'-windows-x64-portable.exe',prefix+'-windows-x64.zip',prefix+'-linux-x86_64.AppImage',prefix+'-linux-x86_64.flatpak',prefix+'-web.zip']
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/'release';output.mkdir()
            for name in other:(output/name).write_bytes(b'fixture')
            test=output/(prefix+'-android-test.apk');test.write_bytes(b'test-fixture')
            command=['node',str(ROOT/'scripts/verify-release.cjs')]
            self.assertNotEqual(subprocess.run(command,cwd=directory,capture_output=True).returncode,0)
            self.assertEqual(subprocess.run(command+['--android-kind=test'],cwd=directory,capture_output=True).returncode,0)
            production=output/(prefix+'-android.apk');production.write_bytes(b'production-fixture')
            self.assertNotEqual(subprocess.run(command,cwd=directory,capture_output=True).returncode,0)
            test.unlink()
            self.assertEqual(subprocess.run(command,cwd=directory,capture_output=True).returncode,0)
            lines=(output/'SHA256SUMS.txt').read_text().splitlines()
            self.assertIn(hashlib.sha256(production.read_bytes()).hexdigest()+'  '+production.name,lines)


if __name__ == '__main__': unittest.main()
