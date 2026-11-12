import io,json,hashlib,subprocess,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from release_download import download_pinned_release
class ReleaseDownloadTest(unittest.TestCase):
 def run_case(self,data=b'payload',url='https://api.github.com/repos/owner/repo/releases/assets/123'):
  payload=b'payload';metadata={'assets':[{'name':'runtime.tar.gz','size':len(payload),'url':url}]}
  return payload,[io.BytesIO(json.dumps(metadata).encode()),io.BytesIO(data)]
 def test_gateway_failure_uses_pinned_public_api_without_credentials(self):
  payload,responses=self.run_case()
  with tempfile.TemporaryDirectory() as d,patch('release_download.subprocess.run',side_effect=subprocess.CalledProcessError(22,['curl'])),patch('release_download.urllib.request.urlopen',side_effect=responses) as request:
   target=Path(d)/'archive';self.assertEqual(download_pinned_release('https://github.com/owner/repo/releases/download/b123/runtime.tar.gz',target,len(payload),hashlib.sha256(payload).hexdigest()),'github-rest');self.assertEqual(target.read_bytes(),payload);self.assertNotIn('Authorization',request.call_args.args[0].headers)
 def test_hash_mismatch_retains_existing_archive_and_cleans_partial(self):
  payload,responses=self.run_case(b'changed')
  with tempfile.TemporaryDirectory() as d,patch('release_download.subprocess.run',side_effect=subprocess.CalledProcessError(22,['curl'])),patch('release_download.urllib.request.urlopen',side_effect=responses):
   target=Path(d)/'archive';target.write_bytes(b'previous')
   with self.assertRaises(ValueError):download_pinned_release('https://github.com/owner/repo/releases/download/b123/runtime.tar.gz',target,len(payload),hashlib.sha256(payload).hexdigest())
   self.assertEqual(target.read_bytes(),b'previous');self.assertFalse(target.with_name('archive.partial').exists())
 def test_foreign_asset_api_cannot_redirect_the_metadata_selection(self):
  payload,responses=self.run_case(url='https://attacker.invalid/asset')
  with tempfile.TemporaryDirectory() as d,patch('release_download.subprocess.run',side_effect=subprocess.CalledProcessError(22,['curl'])),patch('release_download.urllib.request.urlopen',side_effect=responses):
   with self.assertRaises(ValueError):download_pinned_release('https://github.com/owner/repo/releases/download/b123/runtime.tar.gz',Path(d)/'archive',len(payload),hashlib.sha256(payload).hexdigest())
 def test_successful_original_transport_still_checks_pinned_identity(self):
  payload=b'payload'
  def curl(args,**kwargs):Path(args[args.index('--output')+1]).write_bytes(payload)
  with tempfile.TemporaryDirectory() as d,patch('release_download.subprocess.run',side_effect=curl),patch('release_download.urllib.request.urlopen') as request:
   self.assertEqual(download_pinned_release('https://github.com/owner/repo/releases/download/b123/runtime.tar.gz',Path(d)/'archive',len(payload),hashlib.sha256(payload).hexdigest()),'release-url');request.assert_not_called()
