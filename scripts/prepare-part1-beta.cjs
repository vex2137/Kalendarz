// Reuse the explicit weight-free distribution; never change installed/user models.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const beta = require('../beta-release.json');
const pkg = require('../package.json');
if (pkg.version !== beta.version || beta.channel !== 'beta' || beta.draft !== true) throw Error('Beta metadata mismatch');
execFileSync(process.execPath, ['scripts/prepare-model-free.cjs'], { cwd: root, stdio: 'inherit' });
for (const qualifier of ['values', 'values-en', 'values-pl', 'values-de', 'values-ru']) {
  const res = path.join(root, 'build/model-free-res', qualifier);
  fs.mkdirSync(res, { recursive: true });
  fs.copyFileSync(path.join(root, 'android/app/src/main/res', qualifier, 'strings.xml'), path.join(res, 'strings.xml'));
}
console.log(`Prepared ${beta.name}; existing application identifiers and signing configuration retained.`);
