const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {NativeModelStore,packagedModelId}=require('../electron/native-model-store.cjs');
const id=require('../src/utils/localModelManifest.json').id;
const data=Buffer.from('verified default fixture, not inference weights');
const descriptor={id,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
function store(root,build){return new NativeModelStore({root:path.join(root,'managed'),bundledPath:path.join(root,'package.gguf'),bundledId:packagedModelId(build,descriptor),catalogue:[descriptor]});}
test('model-free default is managed, duplicate installation and restart verify the actual bytes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-default-'));let model;
 try{model=store(root,{distribution:'model-free',bundledModel:false});assert.equal(packagedModelId({bundledModel:false},descriptor),undefined);assert.notEqual(model.file(id),path.join(root,'package.gguf'));
 const upload=await model.begin(id);await model.write(upload.token,data.subarray(0,4));await model.write(upload.token,data.subarray(4));await model.finish(upload.token);
 assert.deepEqual(await model.info(id),{installed:true,verified:true,bytes:data.length});assert.deepEqual(await model.begin(id),{exists:true});assert.equal((await fs.readdir(path.join(root,'managed'))).filter(n=>n.endsWith('.gguf')).length,1);
 await model.close();model=store(root,{distribution:'model-free',bundledModel:false});assert.equal((await model.info(id)).verified,true);await model.remove(id);assert.equal((await model.info(id)).installed,false);
 }finally{await model?.close();await fs.rm(root,{recursive:true,force:true});}
});
test('only a physical bundled variant stays read-only; default preference alone is not bundled',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-bundle-'));const model=store(root,{});
 try{await fs.writeFile(path.join(root,'package.gguf'),data);assert.equal((await model.info(id)).verified,true);await assert.rejects(model.begin(id),/model-bundled/);await assert.rejects(model.remove(id),/model-bundled/);assert.deepEqual(await fs.readFile(path.join(root,'package.gguf')),data);assert.equal(packagedModelId({distribution:'model-free'},descriptor),undefined);}finally{await model.close();await fs.rm(root,{recursive:true,force:true});}
});
test('incomplete and corrupt default uploads never become installed; a failed rename can retry safely',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-default-fail-'));const model=store(root,{bundledModel:false});
 try{let upload=await model.begin(id);await model.write(upload.token,data.subarray(0,3));await assert.rejects(model.finish(upload.token),/model-size/);assert.equal((await model.info(id)).installed,false);
 upload=await model.begin(id);await model.write(upload.token,Buffer.alloc(data.length));await assert.rejects(model.finish(upload.token),/model-checksum/);
 const rename=t.mock.method(fs,'rename',async()=>{throw Object.assign(Error('disk unavailable'),{code:'EIO'});});upload=await model.begin(id);await model.write(upload.token,data);await assert.rejects(model.finish(upload.token),/disk unavailable/);rename.mock.restore();assert.equal((await model.info(id)).installed,false);
 upload=await model.begin(id);await model.write(upload.token,data);await model.finish(upload.token);assert.equal((await model.info(id)).verified,true);assert.deepEqual((await fs.readdir(path.join(root,'managed'))).filter(n=>n.endsWith('.partial')),[]);
 }finally{await model.close();await fs.rm(root,{recursive:true,force:true});}
});
