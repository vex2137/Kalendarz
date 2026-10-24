"""Verify and rename published APK metadata; never rebuild, re-sign or delete APKs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request

REPO = 'vex2137/Kalendarz'
API = f'https://api.github.com/repos/{REPO}'
ROOT = Path(__file__).resolve().parent.parent
SUFFIXES = ('.apk', '.exe', '.zip', '.AppImage', '.flatpak')


def api(path, method='GET', value=None, binary=None):
    url = path if path.startswith('https://uploads.github.com/') else API + '/' + path
    headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28'}
    token = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = binary if binary is not None else json.dumps(value).encode() if value is not None else None
    headers['Content-Type'] = 'application/octet-stream' if binary is not None else 'application/json'
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=120) as response:
        content = response.read()
    return json.loads(content) if content else None


def download(asset, target):
    # Public download URL: never forward the Actions token to a redirect host.
    digest = hashlib.sha256()
    count = 0
    # Names can be reused for checksum text; bind the public download cache key
    # to the immutable asset ID so an old name-based CDN response cannot pass.
    url = asset['browser_download_url'] + '?asset_id=' + str(asset['id'])
    request = urllib.request.Request(url, headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=120) as response, target.open('wb') as output:
        while chunk := response.read(1024 * 1024):
            count += len(chunk)
            if count > asset['size']:
                raise ValueError('Unexpected download size: ' + asset['name'])
            output.write(chunk)
            digest.update(chunk)
    assert count == asset['size'], asset['name']
    result = digest.hexdigest()
    assert asset['digest'] == 'sha256:' + result, asset['name']
    return result


def inspect_apk(asset, target, signer):
    digest = download(asset, target)
    result = subprocess.run([signer, 'verify', '--print-certs', str(target)], capture_output=True, text=True, check=True)
    certificate = re.search(r'Signer #1 certificate SHA-256 digest: ([a-f0-9]{64})', result.stdout).group(1)
    subject = re.search(r'Signer #1 certificate DN: (.+)', result.stdout).group(1)
    return {'id': asset['id'], 'name': asset['name'], 'sha256': digest, 'certificate': certificate, 'subject': subject}


def rename(asset, name):
    # Metadata-only PATCH keeps asset ID and uploaded bytes; never upload an APK.
    updated = api(f"releases/assets/{asset['id']}", 'PATCH', {'name': name})
    assert updated['id'] == asset['id'] and updated['size'] == asset['size'] and updated['digest'] == asset['digest']
    return updated


def replace_text(release, old, name, content, output):
    assert name == 'SHA256SUMS.txt' or name.endswith('.apk.sha256')
    assert len(content) < 1024 * 1024
    if old:
        backup = output / f"before-{old['id']}-{old['name']}"
        download(old, backup)
        if old['name'] == name and backup.read_bytes() == content:
            return old
    stage = name + '.staged-' + os.environ.get('GITHUB_RUN_ID', 'local')
    url = release['upload_url'].split('{')[0] + '?name=' + urllib.parse.quote(stage)
    uploaded = api(url, 'POST', binary=content)
    assert uploaded['digest'] == 'sha256:' + hashlib.sha256(content).hexdigest()
    moved_old = False
    promoted = False
    try:
        if old and old['name'] == name:
            rename(old, old['name'] + '.before-naming-' + str(old['id']))
            moved_old = True
        uploaded = rename(uploaded, name)
        promoted = True
        check = output / ('after-' + name)
        download(uploaded, check)
        assert check.read_bytes() == content
    except Exception:
        if promoted:
            rename(uploaded, stage)
        if moved_old:
            rename(old, old['name'])
        api(f"releases/assets/{uploaded['id']}", 'DELETE')
        raise
    # Only superseded checksum text is deleted, after its replacement is verified.
    if old:
        assert old['name'] == 'SHA256SUMS.txt' or old['name'].endswith('.apk.sha256')
        api(f"releases/assets/{old['id']}", 'DELETE')
    return uploaded


def checksum_content(assets):
    payloads = sorted((a for a in assets if a['name'].endswith(SUFFIXES)), key=lambda a: a['name'])
    assert payloads
    rows = []
    for asset in payloads:
        assert re.fullmatch(r'sha256:[0-9a-f]{64}', asset['digest'] or '')
        rows.append(asset['digest'][7:] + '  ' + asset['name'])
    return ('\n'.join(rows) + '\n').encode()


def refresh_checksums(tag, output):
    release = api('releases/tags/' + urllib.parse.quote(tag, safe=''))
    assets = api(f"releases/{release['id']}/assets?per_page=100")
    assert len(assets) < 100, 'Paginate before modifying a larger release'
    current = next((a for a in assets if a['name'] == 'SHA256SUMS.txt'), None)
    return replace_text(release, current, 'SHA256SUMS.txt', checksum_content(assets), output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--refresh-checksums')
    parser.add_argument('--output', default='artifact-naming-audit')
    parser.add_argument('--apksigner', default=os.environ.get('APKSIGNER', 'apksigner'))
    args = parser.parse_args()
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    if args.refresh_checksums:
        refresh_checksums(args.refresh_checksums, output)
        return
    assert os.environ.get('GITHUB_REPOSITORY', REPO) == REPO
    pin = (ROOT / 'android/release-certificate.sha256').read_text().strip()
    plan = json.loads((ROOT / 'scripts/android-artifact-renames.json').read_text())
    releases = api('releases?per_page=100')
    assert len(releases) < 100, 'Paginate before auditing a larger repository'
    report = {'renames': [], 'apks': [], 'releases': [], 'checksumsBefore': []}
    # Verify every APK and every planned hash/certificate before any mutation.
    verified = {}
    for release in releases:
        if release['draft']:
            continue
        sums = next((a for a in release['assets'] if a['name'] == 'SHA256SUMS.txt'), None)
        if sums:
            text_file = output / f"checked-{release['tag_name']}-SHA256SUMS.txt"
            download(sums, text_file)
            indexed = {a['name']:a for a in release['assets']}
            checked = 0
            for line in text_file.read_text().splitlines():
                digest, name = line.split('  ', 1)
                # Resume safely if an earlier checksum swap rolled back after
                # APK metadata renames had already completed.
                aliases = {p['old']:p['new'] for p in plan if p['tag'] == release['tag_name']}
                current_name = name if name in indexed else aliases.get(name, name)
                assert indexed[current_name]['digest'] == 'sha256:' + digest, release['tag_name'] + ': ' + name
                checked += 1
            report['checksumsBefore'].append({'tag':release['tag_name'],'rows':checked})
        for asset in release['assets']:
            if not asset['name'].endswith('.apk'):
                continue
            item = inspect_apk(asset, output / f"{asset['id']}.apk", args.apksigner)
            item['tag'] = release['tag_name']
            item['kind'] = 'production' if item['certificate'] == pin else 'debug' if 'Android Debug' in item['subject'] else 'unclassified'
            report['apks'].append(item); verified[asset['id']] = item
    for change in plan:
        item = verified[change['id']]
        assert item['tag'] == change['tag'] and item['sha256'] == change['sha256'] and item['certificate'] == pin
        assert item['name'] in [change['old'], change['new']]
        release = next(r for r in releases if r['tag_name'] == change['tag'])
        assert not any(a['name'] == change['new'] and a['id'] != change['id'] for a in release['assets']), 'Destination collision'
    (output / 'audit-before.json').write_text(json.dumps(report, indent=2))
    if not args.apply:
        print(json.dumps(report, indent=2)); return
    changed_tags = sorted({change['tag'] for change in plan})
    for tag in changed_tags:
        release = next(r for r in releases if r['tag_name'] == tag)
        (output / f'release-before-{tag}.json').write_text(json.dumps(release, indent=2))
        mappings = [p for p in plan if p['tag'] == tag]
        for change in mappings:
            asset = next(a for a in release['assets'] if a['id'] == change['id'])
            if asset['name'] != change['new']:
                asset = rename(asset, change['new'])
            after = inspect_apk(asset, output / f"{asset['id']}-after.apk", args.apksigner)
            assert after['sha256'] == change['sha256'] and after['certificate'] == pin
            report['renames'].append({'tag': tag, **change, 'verifiedAfter': True})
        # Rebuild complete checksums, including both historical production 1.3.1 variants.
        refresh_checksums(tag, output)
        assets = api(f"releases/{release['id']}/assets?per_page=100")
        for sidecar in [a for a in assets if a['name'].endswith('.apk.sha256')]:
            for change in mappings:
                if sidecar['name'] in [change['old'] + '.sha256', change['new'] + '.sha256']:
                    content = (change['sha256'] + '  ' + change['new'] + '\n').encode()
                    replace_text(release, sidecar, change['new'] + '.sha256', content, output)
        body = release['body'] or ''
        for change in mappings:
            body = body.replace(change['old'], change['new'])
        marker = '\n\n## Android artifact names\n'
        body = body.split(marker)[0]
        canonical = f"Calendar-{tag[1:]}-android.apk"
        body += marker + f"Production APK: [{canonical}](https://github.com/{REPO}/releases/download/{tag}/{canonical}). Names were corrected after checking the permanent certificate; APK contents and signatures are unchanged. Use `SHA256SUMS.txt` to verify downloads."
        if tag == 'v1.3.1':
            body += '\n\n`Calendar-1.3.1-android-original.apk` preserves the original production build for archival use; the canonical APK is the later assistant fix. Both have the permanent signature and different hashes.'
        api(f"releases/{release['id']}", 'PATCH', {'body': body})
        updated = api(f"releases/{release['id']}/assets?per_page=100")
        # No non-Android installer may change identity, name, size or digest.
        for before in release['assets']:
            if before['name'].endswith(SUFFIXES) and not before['name'].endswith('.apk'):
                after = next(a for a in updated if a['id'] == before['id'])
                assert all(before[k] == after[k] for k in ['name', 'size', 'digest'])
        report['releases'].append({'tag': tag, 'assets': [{k:a[k] for k in ['id','name','size','digest']} for a in updated]})
    # Publish only compact audit data; APKs remain downloaded temporary inputs.
    (output / 'audit-after.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'renames': report['renames'], 'preserved': [a for a in report['apks'] if a['kind'] != 'production']}, indent=2))


if __name__ == '__main__':
    main()
