"""Retain an explicitly staged CUDA runtime when refreshing CPU/Vulkan assets."""
import hashlib
import json
import re


def verified_cuda_state(root, expected_commit):
    manifest = root / 'runtime-manifest.json'
    if not manifest.is_file():
        return {}, None
    previous = json.loads(manifest.read_text())
    files = {name: sha for name, sha in previous.get('files', {}).items() if name.startswith('cuda/')}
    if not files:
        return {}, None
    if previous.get('commit') != expected_commit:
        raise ValueError('Restage CUDA for the current pinned llama.cpp commit before packaging')
    for name, sha in files.items():
        if not re.fullmatch(r'cuda/[a-zA-Z0-9._+-]+', name) or not re.fullmatch(r'[a-f0-9]{64}', sha):
            raise ValueError('Invalid CUDA runtime manifest entry')
        file = root / name
        if file.is_symlink() or not file.is_file():
            raise ValueError('Missing or unsafe staged CUDA runtime file')
        with file.open('rb') as stream:
            if hashlib.file_digest(stream, 'sha256').hexdigest() != sha:
                raise ValueError('CUDA runtime checksum mismatch')
    return files, previous.get('cudaSources')
