"""Focused artifact tests; no application builds, private signing keys or network."""
import hashlib
import importlib.util
import json
import io
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

    def test_checksum_download_uses_immutable_asset_cache_key(self):
        content=b'new checksum text'
        asset={'id':42,'name':'SHA256SUMS.txt','size':len(content),'digest':'sha256:'+hashlib.sha256(content).hexdigest(),'browser_download_url':'https://github.com/example/release/SHA256SUMS.txt'}
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(assets.urllib.request,'urlopen',return_value=io.BytesIO(content)) as request:
                assets.download(asset,Path(directory)/'sums')
                self.assertTrue(request.call_args.args[0].full_url.endswith('?asset_id=42'))
            with patch.object(assets.urllib.request,'urlopen',return_value=io.BytesIO(b'old')):
                with self.assertRaises(AssertionError):assets.download(asset,Path(directory)/'stale')

    def test_failed_checksum_verification_restores_original(self):
        old_data=b'old';new_data=b'new contents'
        old={'id':1,'name':'SHA256SUMS.txt','size':len(old_data),'digest':'sha256:'+hashlib.sha256(old_data).hexdigest()}
        stored={1:dict(old)}
        def fake_api(path,method='GET',value=None,binary=None):
            if method=='POST':
                stored[2]={'id':2,'name':'staged','size':len(binary),'digest':'sha256:'+hashlib.sha256(binary).hexdigest()}
                return dict(stored[2])
            asset_id=int(path.rsplit('/',1)[1])
            if method=='PATCH':stored[asset_id].update(value);return dict(stored[asset_id])
            if method=='DELETE':del stored[asset_id];return None
            raise AssertionError(method)
        def fake_download(asset,target):
            if asset['id']==2:raise AssertionError('stale CDN response')
            target.write_bytes(old_data)
        with tempfile.TemporaryDirectory() as directory, patch.object(assets,'api',side_effect=fake_api), patch.object(assets,'download',side_effect=fake_download):
            with self.assertRaises(AssertionError):assets.replace_text({'upload_url':'https://uploads.github.com/example{?name}'},old,'SHA256SUMS.txt',new_data,Path(directory))
        self.assertEqual(stored,{1:old})

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
