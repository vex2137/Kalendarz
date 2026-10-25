"""Packaging state tests with small fixtures; no CUDA hardware/runtime claim."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from native_runtime_state import verified_cuda_state

class CudaPackagingState(unittest.TestCase):
    def test_preserves_verified_optional_runtime(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'cuda').mkdir();binary=root/'cuda/llama-server';binary.write_bytes(b'packaging fixture')
            files={'cuda/llama-server':hashlib.sha256(binary.read_bytes()).hexdigest()}
            (root/'runtime-manifest.json').write_text(json.dumps({'commit':'pinned','files':files,'cudaSources':[{'file':'fixture'}]}))
            self.assertEqual(verified_cuda_state(root,'pinned'),(files,[{'file':'fixture'}]))
            binary.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'checksum'):verified_cuda_state(root,'pinned')
    def test_rejects_stale_commit_and_unsafe_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);manifest=root/'runtime-manifest.json'
            manifest.write_text(json.dumps({'commit':'old','files':{'cuda/llama-server':'a'*64}}))
            with self.assertRaisesRegex(ValueError,'Restage'):verified_cuda_state(root,'new')
            manifest.write_text(json.dumps({'commit':'new','files':{'cuda/../secret':'a'*64}}))
            with self.assertRaisesRegex(ValueError,'Invalid'):verified_cuda_state(root,'new')
    def test_default_has_no_cuda(self):
        with tempfile.TemporaryDirectory() as directory:self.assertEqual(verified_cuda_state(Path(directory),'pinned'),({},None))

if __name__=='__main__':unittest.main()
