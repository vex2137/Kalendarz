// Every production build includes verified weights; never silently publish without them.
const { mkdirSync, existsSync, createReadStream, copyFileSync, renameSync, rmSync, writeFileSync, statSync, readFileSync, readdirSync } = require('node:fs');
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
        console.log('Fetching pinned Qwen3.5 0.8B Q4_K_M weights for the application bundle…');
        const result = spawnSync('curl', ['--fail', '--location', '--retry', '3', '--connect-timeout', '30', '--max-time', '600', '--output', temporary, model.url], { stdio: 'inherit' });
        if (result.error || result.status !== 0) throw new Error('Cannot fetch bundled model; set CALENDAR_MODEL_FILE to verified local weights');
      }
      if (!await valid(temporary)) throw new Error('Bundled model checksum mismatch');
      renameSync(temporary, target);
    }
    // License and weights have separate repositories/revisions. Verify both.
    const license = join(directory, 'LICENSE.txt');
    const licenseValid = existsSync(license) && createHash('sha256').update(readFileSync(license)).digest('hex') === model.licenseSha256;
    if (!licenseValid) {
      const result = spawnSync('curl', ['--fail', '--location', '--retry', '3', '--max-time', '90', '--output', `${license}.tmp`, model.licenseDownloadUrl], { stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error('Cannot fetch the model license');
      if (createHash('sha256').update(readFileSync(`${license}.tmp`)).digest('hex') !== model.licenseSha256) throw new Error('Model license checksum mismatch');
      renameSync(`${license}.tmp`, license);
    }
    writeFileSync(join(directory, 'NOTICE.txt'), `Qwen3.5-0.8B by Qwen, distributed under Apache-2.0.\nGGUF quantization: mradermacher/Qwen3.5-0.8B-GGUF.\nWeights: ${model.url}\nSHA-256: ${model.sha256}\nOriginal license: ${model.license}\n`);
    // Staged assets contain exactly one model. Do not package a previous default.
    for (const name of readdirSync(directory)) if (name.endsWith('.gguf') && name !== model.file) rmSync(join(directory,name));
    writeFileSync(join(directory,'catalogue.json'),JSON.stringify([model,...require('../src/utils/optionalModels.json'),...require('../src/utils/fineTunedModels.json')]));
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ file: model.file, bytes: model.bytes, sha256: model.sha256 }));
    console.log(`Bundled ${model.file}: ${model.bytes} bytes, SHA-256 verified.`);
  } finally { rmSync(temporary, { force: true }); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
