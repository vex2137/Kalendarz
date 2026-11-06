// Explicit distribution without weights. The ordinary bundled build still verifies
// its pinned GGUF. Never delete/copy models from an installed application's data.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),target=path.join(root,'build/model-free-public');
 await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});
 for(const entry of await fs.readdir(path.join(root,'public'))){if(entry!=='models')await fs.cp(path.join(root,'public',entry),path.join(target,entry),{recursive:true});}
 const model={...require('../src/utils/localModelManifest.json'),...require('../src/utils/defaultModelSource.json')};
 await fs.mkdir(path.join(target,'models'));
 await fs.writeFile(path.join(target,'models/catalogue.json'),JSON.stringify([model,...require('../src/utils/optionalModels.json'),...require('../src/utils/fineTunedModels.json')]));
 await fs.writeFile(path.join(target,'models/manifest.json'),JSON.stringify({file:model.file,bytes:model.bytes,sha256:model.sha256}));
 // Inherit localized application and launcher labels from main resources.
 for(const qualifier of ['values','values-en','values-pl','values-de','values-ru']){
  const res=path.join(root,'build/model-free-res',qualifier);await fs.mkdir(res,{recursive:true});
  await fs.writeFile(path.join(res,'strings.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<resources/>\n');
 }
 console.log('Prepared explicit model-free distribution. Installed models are retained; new users import/download a model.');
})().catch(error=>{console.error(error);process.exitCode=1;});
