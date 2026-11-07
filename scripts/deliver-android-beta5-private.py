"""Transfer an already verified APK to private LFS and dispatch private delivery.
No binary/pointer Git commit and no Release; never print authenticated LFS URLs.
"""
import base64
import json
import os
from pathlib import Path
import urllib.request
from android_beta5_guard import NAME

REPO = 'vex2137/Kalendarz-private-builds'
token = os.environ['GH_TOKEN']


def request(url, data=None, headers=None):
    if not url.startswith('https://'):
        raise ValueError('HTTPS required')
    req = urllib.request.Request(url, data=data, headers=headers or {})
    # Do not forward authorization to a redirect target. Signed storage endpoints
    # are returned by the authenticated LFS batch API, not guessed or logged.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args):
            return None
    with urllib.request.build_opener(NoRedirect).open(req, timeout=180) as response:
        return response.read()


api = 'https://api.github.com/repos/' + REPO
headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json'}
repo = json.loads(request(api, headers=headers))
if repo.get('private') is not True or repo.get('visibility') != 'private':
    raise ValueError('Artifact destination must be private')
apk = Path('private-android') / NAME
manifest = json.loads(apk.with_suffix('.apk.json').read_text())
assert manifest['source'] == os.environ['CALENDAR_EXPECTED_COMMIT']
# The APK verifier ran immediately before this transfer; recheck bytes in transit.
import hashlib
with apk.open('rb') as stream:
    assert hashlib.file_digest(stream, 'sha256').hexdigest() == manifest['sha256']
assert apk.stat().st_size == manifest['bytes']
obj = dict(oid=manifest['sha256'], size=manifest['bytes'])
basic = base64.b64encode(('x-access-token:' + token).encode()).decode()
lfs_headers = {'Authorization': 'Basic ' + basic, 'Accept': 'application/vnd.git-lfs+json', 'Content-Type': 'application/vnd.git-lfs+json'}
batch = json.loads(request('https://github.com/' + REPO + '.git/info/lfs/objects/batch', json.dumps(dict(operation='upload', transfers=['basic'], objects=[obj])).encode(), lfs_headers))
item, = batch['objects']
assert item['oid'] == obj['oid'] and item['size'] == obj['size'] and 'error' not in item
for operation in ['upload', 'verify']:
    action = item.get('actions', {}).get(operation)
    if not action:
        continue
    action_headers = action.get('header', {}).copy()
    if operation == 'upload':
        action_headers['Content-Length'] = str(obj['size'])
        req = urllib.request.Request(action['href'], headers=action_headers, method='PUT')
        assert action['href'].startswith('https://')
        with apk.open('rb') as stream:
            req.data = stream
            with urllib.request.urlopen(req, timeout=180) as response:
                response.read()
    else:
        action_headers['Content-Type'] = 'application/vnd.git-lfs+json'
        request(action['href'], json.dumps(obj).encode(), action_headers)
headers['Content-Type'] = 'application/json'
request(api + '/dispatches', json.dumps({'event_type': 'android-beta5-delivery', 'client_payload': {'manifest': manifest}}).encode(), headers)
print('Verified APK transferred to private LFS; private artifact delivery dispatched. No Release or binary Git commit.')
