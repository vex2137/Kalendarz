const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, statSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { version, productName } = require('../package.json');

if (process.env.GITHUB_REF_TYPE === 'tag') {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    `v${version}`,
    'Release tag must match application version',
  );
}
const androidKind = process.argv.includes('--android-kind=test') ? 'test' : 'production';
const prefix = `${productName}-${version}`;
const files = [
  `${prefix}-android${androidKind === 'test' ? '-test' : ''}.apk`,
  `${prefix}-windows-x64-setup.exe`,
  `${prefix}-windows-x64-portable.exe`,
  `${prefix}-windows-x64.zip`,
  `${prefix}-linux-x86_64.AppImage`,
  `${prefix}-linux-x86_64.flatpak`,
  `${prefix}-web.zip`,
];
assert.deepEqual(readdirSync('release').filter(name => name.endsWith('.apk')).sort(), [files[0]], 'Publish exactly the intended Android APK; test or unsigned APKs must not accompany production output');
const lines = files.map((name) => {
  const file = join('release', name);
  assert.ok(statSync(file).size > 0, `Empty release asset: ${name}`);
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  console.log(`Verified ${name} (${statSync(file).size} bytes)`);
  return `${hash}  ${name}`;
});
writeFileSync(join('release', 'SHA256SUMS.txt'), `${lines.join('\n')}\n`);
