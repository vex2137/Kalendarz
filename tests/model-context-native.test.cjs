const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {NativeAI,parseContextSize}=require('../electron/native-ai.cjs');
test('applied context is taken from backend props/logs, never from the requested value',()=>{
 assert.equal(parseContextSize('n_ctx = 16384\nn_ctx_per_seq = 8192'),8192);
 assert.equal(parseContextSize('n_ctx = 8192',{default_generation_settings:{n_ctx:8448}}),8448);
 assert.equal(parseContextSize('no confirmation'),undefined);assert.equal(parseContextSize('n_ctx = 0'),undefined);
});
test('native context rejects invalid values and never changes an active generation policy',async()=>{
 const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({maxContext:2048})}});ai.mode='cpu';ai.start=async()=>ai.snapshot();
 await ai.prepare('a',8193);assert.equal(ai.contexts.get('a'),8193);
 for(const value of [0,31,1.5,NaN,2147483648])await assert.rejects(ai.prepare('a',value),/context-range/);
 ai.operation=new AbortController();await assert.rejects(ai.prepare('a',16384),/busy/);assert.equal(ai.contexts.get('a'),8193);
});
// A local fake executable verifies the real subprocess flags and health/props path.
// It contains no tensors and is not GPU or llama.cpp inference evidence.
test('native launch passes exact --ctx-size and records actual applied capacity',{skip:process.platform==='win32'},async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-context-')),binary=path.join(root,'server');
 await fs.writeFile(binary,`#!/usr/bin/env node
const http=require('node:http');const args=process.argv.slice(2);const get=name=>args[args.indexOf(name)+1];
const actual=Number(get('--ctx-size'));console.log('n_ctx_per_seq = '+actual);
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/props'?{default_generation_settings:{n_ctx:actual}}:{status:'ok'}));}).listen(Number(get('--port')),'127.0.0.1');
`,{mode:0o755});
 const ai=new NativeAI({runtimeRoot:root,store:{descriptor:()=>({name:'fixture',maxContext:2048}),verifiedPath:async()=>'/fixture.gguf'}});
 ai.binary=()=>binary;ai.verifyRuntime=async()=>{};ai.env=()=>process.env;ai.memory=async()=>{};
 try{ai.contexts.set('a',8193);const state=await ai.start('a','cpu',undefined,new AbortController().signal);assert.equal(state.contextRequested,8193);assert.equal(state.contextApplied,8193);assert.equal(state.gpuActive,false);}finally{await ai.stop();await fs.rm(root,{recursive:true,force:true});}
});
