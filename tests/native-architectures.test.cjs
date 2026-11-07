const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFileSync,spawnSync}=require('node:child_process');
const pin=require('../scripts/native-runtime-manifest.json');
test('Linux CPU/Vulkan/CUDA are pinned together to the LFM3 and Qwen3.5 capable upstream build',()=>{
 const linux=pin.overrides['linux-x64'];assert.equal(linux.version,'b12189');assert.equal(linux.commit,'80d2c0c2c56e4a1bbf74be98f64b99927bf230bc');
 assert.deepEqual(linux.architectures,['lfm3','qwen35','qwen35moe']);
 for(const a of [...Object.values(pin.targets['linux-x64']),...pin.cuda['linux-x64']]){
  assert.match(a.file,/b12189/);assert.match(a.url,/releases\/download\/b12189\//);assert.match(a.sha256,/^[a-f0-9]{64}$/);assert.ok(a.bytes>0);
 }
 // Other platforms retain their own audited pin, not silently relabelled assets.
 assert.equal(pin.version,'b11669');assert.match(pin.targets['win-x64'].cpu.file,/b11669/);
});
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
// Optional actual upstream binary check. A header-only fixture verifies loader
// architecture dispatch, NOT tensor loading, generation or physical GPU support.
test('actual pinned CPU binary recognizes LFM3 and Qwen3.5 architecture dispatch',{skip:!process.env.CALENDAR_TEST_LLAMA_SERVER},async()=>{
 const binary=process.env.CALENDAR_TEST_LLAMA_SERVER;
 const options={encoding:'utf8',env:{...process.env,LD_LIBRARY_PATH:path.dirname(binary)},timeout:20000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']};
 const result=spawnSync(binary,['--version'],options);assert.equal(result.status,0);assert.match(result.stdout+result.stderr,/12189.*80d2c0c2c/);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-arch-'));
 try{for(const arch of ['lfm3','qwen35']){
  const file=path.join(root,arch+'.gguf');await fs.writeFile(file,Buffer.concat([Buffer.from('GGUF'),u32(3),u64(0),u64(1),str('general.architecture'),u32(8),str(arch),Buffer.alloc(64)]));
  let log='';try{execFileSync(binary,['--model',file,'--device','none','--n-gpu-layers','0','--ctx-size','32','--log-verbosity','4','--no-webui'],options);assert.fail('Header-only fixture must not load');}catch(error){if(error.code==='ETIMEDOUT')throw error;log=String(error.stdout||'')+String(error.stderr||'');}
  assert.doesNotMatch(log,/unknown model architecture|unsupported.*architecture/i);
  assert.match(log,new RegExp('key not found in model: '+arch+'\\.context_length'));
 }}finally{await fs.rm(root,{recursive:true,force:true});}
});
