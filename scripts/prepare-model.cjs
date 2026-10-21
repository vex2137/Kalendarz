// Every production build includes verified weights; never silently publish without them.
const { mkdirSync, existsSync, createReadStream, copyFileSync, renameSync, rmSync, writeFileSync, statSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const model = require('../src/utils/localModelManifest.json');
async function valid(file) {
  if (!existsSync(file) || statSync(file).size !== model.bytes) return false;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex') === model.sha256;
}
(async () => {
  const directory = resolve(__dirname, '../public/models');
  mkdirSync(directory, { recursive: true });
  const target = join(directory, model.file), temporary = `${target}.${process.pid}.tmp`;
  try {
    if (!await valid(target)) {
      if (process.env.CALENDAR_MODEL_FILE) {
        if (!await valid(process.env.CALENDAR_MODEL_FILE)) throw new Error('CALENDAR_MODEL_FILE has an invalid size/checksum');
        copyFileSync(process.env.CALENDAR_MODEL_FILE, temporary);
      } else {
        console.log('Fetching pinned LFM2.5 weights for the application bundle…');
        const result = spawnSync('curl', ['--fail', '--location', '--retry', '3', '--connect-timeout', '30', '--max-time', '600', '--output', temporary, model.url], { stdio: 'inherit' });
        if (result.error || result.status !== 0) throw new Error('Cannot fetch bundled model; set CALENDAR_MODEL_FILE to verified local weights');
      }
      if (!await valid(temporary)) throw new Error('Bundled model checksum mismatch');
      renameSync(temporary, target);
    }
    // Ship the upstream license text, pinned to the same revision as the weights.
    const license = join(directory, 'LICENSE.txt');
    if (!existsSync(license)) {
      const result = spawnSync('curl', ['--fail', '--location', '--retry', '3', '--max-time', '90', '--output', `${license}.tmp`, model.license.replace('/blob/main/', `/resolve/${model.revision}/`)], { stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error('Cannot fetch the model license');
      renameSync(`${license}.tmp`, license);
    }
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ file: model.file, bytes: model.bytes, sha256: model.sha256 }));
    console.log(`Bundled ${model.file}: ${model.bytes} bytes, SHA-256 verified.`);
  } finally { rmSync(temporary, { force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
