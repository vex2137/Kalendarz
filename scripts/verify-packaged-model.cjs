const { createReadStream, statSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const model = require('../src/utils/localModelManifest.json');
// electron-builder hook: direct packaging must not silently omit the bundled model.
module.exports = async function(context) {
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['scripts/prepare-native.py','--platform',context.electronPlatformName,'--arch',({1:'x64',3:'arm64'})[context.arch]||String(context.arch)], {cwd:context.packager.info.appDir,stdio:'inherit'});
  const root=context.packager.info.appDir;
  const info=require('node:fs').readFileSync(join(root,'dist/build-info.json'),'utf8');
  const build=JSON.parse(info);
  if(process.env.CALENDAR_MODEL_FREE==='true'){
    if(build.distribution!=='model-free'||build.bundledModel!==false||build.version!==require('../package.json').version)throw Error('Rebuild the explicit model-free distribution');
    const catalogue=JSON.parse(require('node:fs').readFileSync(join(root,'dist/models/catalogue.json'),'utf8'));
    if(JSON.stringify(catalogue)!==JSON.stringify([model,...require('../src/utils/optionalModels.json')]))throw Error('Incorrect model catalogue');
    console.log('Explicit model-free package: existing models retained; import/download required on new installations.');
    return;
  }
  const file = join(root, 'dist/models', model.file);
  if (statSync(file).size !== model.bytes) throw new Error('Missing/incorrect bundled model');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== model.sha256) throw new Error('Bundled model checksum mismatch');
};
