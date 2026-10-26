"""Transfer release inputs/outputs only through an existing private draft release.

Uses gh authentication from GH_TOKEN; never includes credentials in command lines.
No repository or release is created, published, overwritten or deleted here.
"""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess

spec = importlib.util.spec_from_file_location('verify_v142', Path(__file__).with_name('verify-android-v142.py'))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def api(path):
    result = subprocess.run(['gh', 'api', '--hostname', 'github.com', path], capture_output=True, check=False)
    if result.returncode:
        raise ValueError('Private depot API access failed; check the repository and scoped token')
    return json.loads(result.stdout)


def private_draft(repository, release_id):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository) or not re.fullmatch(r'[1-9][0-9]*', release_id):
        raise ValueError('Invalid private depot repository/release ID')
    repo = api('repos/' + repository)
    if repo.get('private') is not True or repo.get('visibility') != 'private':
        raise ValueError('Model depot must be private; public/internal repositories are forbidden')
    draft = api(f'repos/{repository}/releases/{release_id}')
    if draft.get('draft') is not True:
        raise ValueError('Model depot release must remain a draft')
    return draft


def verify_weights(path):
    if path.stat().st_size != release.MODEL_BYTES:
        raise ValueError('Private GGUF size mismatch')
    with path.open('rb') as stream:
        if hashlib.file_digest(stream, 'sha256').hexdigest() != release.MODEL_SHA256:
            raise ValueError('Private GGUF SHA-256 mismatch')


def fetch(repository, release_id, target):
    draft = private_draft(repository, release_id)
    assets = [asset for asset in draft['assets'] if asset['name'] == release.MODEL_FILE]
    if len(assets) != 1 or assets[0]['size'] != release.MODEL_BYTES:
        raise ValueError('Private draft must contain exactly one matching model asset of the expected size')
    if target.exists():
        verify_weights(target)
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix('.partial')
    try:
        with partial.open('xb') as stream:
            result = subprocess.run(['gh', 'api', '--hostname', 'github.com', '-H', 'Accept: application/octet-stream',
                                     f'repos/{repository}/releases/assets/{int(assets[0]["id"])}'],
                                    stdout=stream, stderr=subprocess.PIPE, check=False)
        if result.returncode:
            raise ValueError('Private GGUF download failed')
        verify_weights(partial)
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)


def upload(repository, release_id, files):
    draft = private_draft(repository, release_id)
    # Never replace an earlier build. The workflow uses commit/run/attempt in names.
    existing = {asset['name'] for asset in draft['assets']}
    if any(path.name in existing or not path.is_file() for path in files):
        raise ValueError('Output asset already exists or is missing')
    result = subprocess.run(['gh', 'release', 'upload', '--repo', repository, '--', draft['tag_name'],
                             *[str(path.resolve()) for path in files]], capture_output=True, check=False)
    if result.returncode:
        raise ValueError('Private output upload failed; no assets were overwritten')
    private_draft(repository, release_id)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as stream:
            stream.write(f'Verified APK and SHA-256: [private draft release]({draft["html_url"]}). '
                         'Download requires access to the private depot. No public artifact was uploaded.\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['fetch', 'upload', 'check'])
    parser.add_argument('--repository', required=True)
    parser.add_argument('--release-id', required=True)
    parser.add_argument('files', type=Path, nargs='*')
    args = parser.parse_args()
    if args.operation == 'fetch':
        if len(args.files) != 1:
            parser.error('fetch requires one target path')
        fetch(args.repository, args.release_id, args.files[0])
    elif args.operation == 'upload':
        if not args.files:
            parser.error('upload requires output files')
        upload(args.repository, args.release_id, args.files)
    else:
        private_draft(args.repository, args.release_id)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError):
        raise SystemExit('Private depot operation failed. Check private visibility, draft status, access, asset size and SHA-256.')
