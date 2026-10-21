const { createReadStream, statSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const model = require('../src/utils/localModelManifest.json');
// electron-builder hook: direct packaging must not silently omit the bundled model.
module.exports = async function(context) {
  const file = join(context.packager.info.appDir, 'dist/models', model.file);
  if (statSync(file).size !== model.bytes) throw new Error('Missing/incorrect bundled model');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== model.sha256) throw new Error('Bundled model checksum mismatch');
};
