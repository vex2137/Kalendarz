// Reuse the explicit weight-free distribution; never change installed/user models.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const beta = require('../beta-release.json');
const pkg = require('../package.json');
if (pkg.version !== beta.version || beta.channel !== 'beta' || beta.draft !== true) throw Error('Beta metadata mismatch');
execFileSync(process.execPath, ['scripts/prepare-model-free.cjs'], { cwd: root, stdio: 'inherit' });
const names = ['app_name', 'title_activity_main', 'launcher_name_en', 'launcher_name_pl', 'launcher_name_ru', 'launcher_name_de'];
const label = beta.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n' + names.map(name => `    <string name="${name}" translatable="false">${label}</string>`).join('\n') + '\n</resources>\n';
for (const qualifier of ['values', 'values-en', 'values-pl', 'values-de', 'values-ru']) {
  const res = path.join(root, 'build/model-free-res', qualifier);
  fs.mkdirSync(res, { recursive: true });
  fs.writeFileSync(path.join(res, 'strings.xml'), xml);
}
console.log(`Prepared ${beta.name}; existing application identifiers and signing configuration retained.`);
