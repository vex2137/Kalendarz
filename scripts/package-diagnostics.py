"""Verify the assembled diagnostic APK before publishing an Actions artifact."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
os.chdir(root)
source = root / 'android/app/build/outputs/apk/diagnostics/app-diagnostics.apk'
model = json.loads((root / 'src/utils/localModelManifest.json').read_text())
version = json.loads((root / 'package.json').read_text())['version'] + '-diagnostics'
tools = Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0'
subprocess.run([str(tools / 'apksigner'), 'verify', '--verbose', str(source)], check=True)
metadata = subprocess.check_output([str(tools / 'aapt'), 'dump', 'badging', str(source)], text=True)
package_line = next(line for line in metadata.splitlines() if line.startswith('package:'))
assert "name='com.kalendarz.offline.diagnostics'" in package_line, package_line
assert f"versionName='{version}'" in package_line, package_line
with zipfile.ZipFile(source) as apk:
    weights_path = 'assets/public/models/' + model['file']
    assert apk.getinfo(weights_path).file_size == model['bytes'], 'Wrong model size'
    with apk.open(weights_path) as weights:
        assert hashlib.file_digest(weights, 'sha256').hexdigest() == model['sha256'], 'Wrong model hash'
    assert apk.read('assets/public/models/LICENSE.txt').strip(), 'Missing model license'

destination = root / 'diagnostics-artifact'
destination.mkdir(exist_ok=True)
target = destination / 'Calendar-AI-diagnostics.apk'
shutil.copyfile(source, target)
with target.open('rb') as stream:
    digest = hashlib.file_digest(stream, 'sha256').hexdigest()
(destination / 'SHA256SUMS.txt').write_text(f'{digest}  {target.name}\n')
(destination / 'BUILD-INFO.json').write_text(json.dumps({
    'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'branch': os.environ.get('GITHUB_REF_NAME', subprocess.check_output(
        ['git', 'branch', '--show-current'], text=True).strip()),
    'run': os.environ.get('GITHUB_RUN_ID'),
    'applicationId': 'com.kalendarz.offline.diagnostics',
    'version': version,
    'apkBytes': target.stat().st_size,
    'apkSha256': digest,
    'model': model,
}, indent=2) + '\n')
shutil.copyfile(root / 'docs/android-diagnostics-download.md', destination / 'README.md')
print(f'Verified signature, diagnostic package/version, embedded GGUF and license: {target.stat().st_size} bytes')
