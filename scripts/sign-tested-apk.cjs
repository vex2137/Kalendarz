const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');
const assert = require('node:assert/strict');
const version = require('../package.json').version;
const file = `Calendar-${version}-android.apk`;
const candidates = [file, `Calendar-${version}-android-test.apk`].filter(name => existsSync(join('tested-android', name)));
assert.equal(candidates.length, 1, 'Select exactly one tested Android input; production output always uses the canonical name');
const tool = join(process.env.ANDROID_HOME, 'build-tools/35.0.0');
const directory = join(process.env.RUNNER_TEMP, 'calendar-signing');
execFileSync(process.execPath, ['scripts/with-android-signing.cjs', directory, join(tool, 'apksigner'), 'sign', '--v4-signing-enabled', 'false', '--ks', join(directory, 'calendar-release.p12'), '--ks-key-alias', 'calendar-release', '--ks-pass', 'env:CALENDAR_KEYSTORE_PASSWORD', '--key-pass', 'env:CALENDAR_KEY_PASSWORD', '--out', join('release', file), join('tested-android', candidates[0])], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-android-signature.cjs', join('release', file)], { stdio: 'inherit' });
const metadata = execFileSync(join(tool, 'aapt'), ['dump', 'badging', join('release', file)], { encoding: 'utf8' });
assert.ok(metadata.includes(`versionName='${version}'`));
assert.ok(metadata.includes("name='com.kalendarz.offline'"));
execFileSync('python3', ['-c', `import zipfile,json,hashlib,sys
model=json.load(open('src/utils/localModelManifest.json'))
with zipfile.ZipFile(sys.argv[1]) as apk:
 with apk.open('assets/public/models/'+model['file']) as weights:
  assert hashlib.file_digest(weights,'sha256').hexdigest()==model['sha256']
 assert apk.read('assets/public/models/LICENSE.txt')
print('Verified exact bundled GGUF and license inside the permanently signed APK.')`, join('release', file)], { stdio: 'inherit' });
