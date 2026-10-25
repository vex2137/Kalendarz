// Stage a separate test bundle. Production assets and signing are unchanged.
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..'),target=path.join(root,'build/beta-public');
  await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});
  for(const entry of await fs.readdir(path.join(root,'public'))){
    if(entry==='models')continue;
    await fs.cp(path.join(root,'public',entry),path.join(target,entry),{recursive:true});
  }
  const label='KALENDARZ 1.4.1 BETA 3';
  const names=['app_name','title_activity_main','launcher_name_en','launcher_name_pl','launcher_name_ru','launcher_name_de'];
  const xml='<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'+names.map(name=>`    <string name="${name}" translatable="false">${label}</string>`).join('\n')+'\n</resources>\n';
  for(const qualifier of ['values','values-en','values-pl','values-de','values-ru']){
    const res=path.join(root,'build/beta-res',qualifier);await fs.mkdir(res,{recursive:true});await fs.writeFile(path.join(res,'strings.xml'),xml);
  }
  console.log('Prepared beta APK resources without bundled weights; download/import remains available.');
})().catch(error=>{console.error(error);process.exitCode=1;});
