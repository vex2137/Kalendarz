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
    build = json.loads(apk.read('assets/public/build-info.json'))
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    assert build['commit'] == head, 'APK contains a different source commit'
    if os.environ.get('CI'):
        assert not build['dirty'], 'CI APK was built from modified sources'
    # The compiled JS and the metadata must describe the same source revision.
    assert any(build['commit'].encode() in apk.read(name) for name in apk.namelist()
               if name.startswith('assets/public/assets/') and name.endswith('.js')), 'Missing commit in compiled JavaScript'
    weights_path = 'assets/public/models/' + model['file']
    assert apk.getinfo(weights_path).file_size == model['bytes'], 'Wrong model size'
    with apk.open(weights_path) as weights:
        assert hashlib.file_digest(weights, 'sha256').hexdigest() == model['sha256'], 'Wrong model hash'
    assert apk.read('assets/public/models/LICENSE.txt').strip(), 'Missing model license'
    if os.environ.get('DIAGNOSTICS_WEB_DIR'):
        web = Path(os.environ['DIAGNOSTICS_WEB_DIR'])
        for name in apk.namelist():
            if not name.startswith('assets/public/') or name.endswith('/'):
                continue
            relative = Path(name.removeprefix('assets/public/'))
            assert not relative.is_absolute() and '..' not in relative.parts
            target = web / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            with apk.open(name) as stream, target.open('wb') as extracted:
                shutil.copyfileobj(stream, extracted)

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
    'webBuild': build,
    'model': model,
}, indent=2) + '\n')
shutil.copyfile(root / 'docs/android-diagnostics-download.md', destination / 'README.md')
shutil.copyfile(root / 'docs/assistant-device-investigation.md', destination / 'assistant-device-investigation.md')
for document in ['multimodel-progress.md', 'model-candidate-smoke.json', 'model-source-verification.json']:
    path = root / 'docs' / document
    if path.exists():
        shutil.copyfile(path, destination / document)
print(f'Verified signature, diagnostic package/version, embedded GGUF and license: {target.stat().st_size} bytes')
print(f'Embedded JavaScript source commit: {build["commit"]}')
