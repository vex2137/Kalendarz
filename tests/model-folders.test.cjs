const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {ModelFolders,readGGUF}=require('../electron/model-folders.cjs');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
function fixture(name='Local test'){
  const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
  const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const string=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
  return Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(3),string('general.architecture'),u32(8),string('llama'),string('llama.context_length'),u32(4),u32(4096),string('general.name'),u32(8),string(name)]);
}
async function workspace(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-folders-'));try{await fn(root);}finally{await fs.rm(root,{recursive:true,force:true});}}
const configFile=root=>path.join(root,'settings','model-folders-v1.json');
test('folder scans recursively find valid GGUF and survive restart without copying model bytes',()=>workspace(async root=>{
  const directory=path.join(root,'LM Studio','publisher','model');await fs.mkdir(directory,{recursive:true});
  const file=path.join(directory,'weights.GGUF');await fs.writeFile(file,fixture());
  const folders=new ModelFolders({configFile:configFile(root)});assert.deepEqual((await folders.list()).folders,[]);
  const added=await folders.add(path.join(root,'LM Studio'));assert.equal(added.models.length,1);assert.equal(added.models[0].name,'Local test');assert.equal(added.models[0].file,'weights.GGUF');
  assert.equal(added.models[0].maxContext,2048);assert.equal(added.models[0].external,true);assert.equal(JSON.stringify(added.models).includes(directory),false);
  assert.equal((await folders.add(path.join(root,'LM Studio'))).folders.length,1);
  const reopened=new ModelFolders({configFile:configFile(root)});assert.deepEqual(await reopened.list(),added);
  assert.equal(await reopened.verifiedPath(added.models[0].id),file);assert.deepEqual(await fs.readdir(directory),['weights.GGUF']);
}));
test('several folders deduplicate hardlinks and overlapping roots; removal never deletes model files',()=>workspace(async root=>{
  const first=path.join(root,'one'),second=path.join(root,'two');await fs.mkdir(first);await fs.mkdir(second);
  const file=path.join(first,'a.gguf');const data=fixture();await fs.writeFile(file,data);await fs.link(file,path.join(second,'b.gguf'));
  const folders=new ModelFolders({configFile:configFile(root)});await folders.add(first);let snapshot=await folders.add(second);
  assert.equal(snapshot.models.length,1);assert.equal(snapshot.models[0].folderIds.length,2);
  snapshot=await folders.add(root);assert.equal(snapshot.models.length,1);assert.equal(snapshot.models[0].folderIds.length,3);
  for(const folder of snapshot.folders)await folders.remove(folder.id);
  assert.deepEqual((await folders.list()).models,[]);assert.deepEqual(await fs.readFile(file),data);assert.deepEqual(await fs.readFile(path.join(second,'b.gguf')),data);
}));
test('empty, missing, unreadable and malformed model directories report bounded errors',()=>workspace(async root=>{
  const directory=path.join(root,'models');await fs.mkdir(directory);
  const folders=new ModelFolders({configFile:configFile(root)});assert.equal((await folders.add(directory)).models.length,0);
  await fs.writeFile(path.join(directory,'invalid.gguf'),'GGUF');await fs.writeFile(path.join(directory,'ignored.txt'),'ignored');
  let snapshot=await folders.refresh();assert.equal(snapshot.models.length,0);assert.equal(snapshot.warnings[0].code,'model-gguf-invalid');
  const opendir=fs.opendir;fs.opendir=async target=>{if(target===directory){const error=Error('denied');error.code='EACCES';throw error;}return opendir(target);};
  try{assert.equal((await folders.refresh()).warnings[0].code,'model-folder-permission');}finally{fs.opendir=opendir;}
  await fs.rename(directory,directory+'-moved');snapshot=await folders.refresh();assert.equal(snapshot.warnings[0].code,'model-folder-missing');
  assert.equal((await new ModelFolders({configFile:configFile(root)}).list()).folders.length,1);
}));
test('changed or replaced models require an explicit refresh; external deletion/upload are rejected',()=>workspace(async root=>{
  const directory=path.join(root,'models');await fs.mkdir(directory);const file=path.join(directory,'a.gguf');await fs.writeFile(file,fixture());
  const folders=new ModelFolders({configFile:configFile(root)});const snapshot=await folders.add(directory);const id=snapshot.models[0].id;
  const store=new NativeModelStore({root:path.join(root,'private'),catalogue:[],external:folders});assert.equal((await store.info(id)).installed,true);
  await assert.rejects(store.remove(id),/model-external-readonly/);await assert.rejects(store.begin(id),/model-external-readonly/);assert.equal(await store.verifiedPath(id),file);
  await fs.writeFile(file,fixture('Changed model name'));await assert.rejects(folders.verifiedPath(id),/model-folder-changed/);assert.equal((await store.info(id)).installed,false);
  assert.equal((await folders.refresh()).models[0].name,'Changed model name');assert.equal(await store.verifiedPath(id),file);
  await folders.remove(snapshot.folders[0].id);await assert.rejects(store.verifiedPath(id),/model-unknown/);assert.ok((await fs.stat(file)).size>0);
}));
test('GGUF metadata rejects unsafe counts, versions and tensorless documents',()=>workspace(async root=>{
  const file=path.join(root,'bad.gguf');
  for(const mutate of [b=>b.writeUInt32LE(100,4),b=>b.writeBigUInt64LE(0n,8),b=>b.writeBigUInt64LE(99999999999999n,16)]){
    const data=fixture();mutate(data);await fs.writeFile(file,data);await assert.rejects(readGGUF(file),/model-gguf-invalid/);
  }
}));
test('bounded scanning yields and reports its limit instead of walking indefinitely',()=>workspace(async root=>{
  const directory=path.join(root,'models');await fs.mkdir(directory);await Promise.all(Array.from({length:30},(_,i)=>fs.writeFile(path.join(directory,`${i}.txt`),'')));
  const folders=new ModelFolders({configFile:configFile(root),maxEntries:10});let yielded=false;setImmediate(()=>{yielded=true;});
  const snapshot=await folders.add(directory);assert.equal(yielded,true);assert.ok(snapshot.warnings.some(w=>w.code==='model-folder-limit'));
}));
test('corrupt configuration is preserved and never replaced by an empty list',()=>workspace(async root=>{
  const file=configFile(root);await fs.mkdir(path.dirname(file));const corrupt='{invalid config';await fs.writeFile(file,corrupt);
  const folders=new ModelFolders({configFile:file});await assert.rejects(folders.list(),/model-folder-config/);await assert.rejects(folders.add(root),/model-folder-config/);assert.equal(await fs.readFile(file,'utf8'),corrupt);
}));
test('concurrent folder edits cannot overwrite each other',()=>workspace(async root=>{
  const a=path.join(root,'a'),b=path.join(root,'b');await fs.mkdir(a);await fs.mkdir(b);const folders=new ModelFolders({configFile:configFile(root)});await folders.ready;
  const results=await Promise.allSettled([folders.add(a),folders.add(b)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.message==='model-busy').length,1);assert.equal((await folders.list()).folders.length,1);
}));
