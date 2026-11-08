import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheModelMetadata, contextPlan, contextSliderTokens, contextSliderValue, modelContextPreference, modelMetadata, previousContextPreference, saveContextPreference } from '../src/utils/modelContext';
import { DEFAULT_MODEL, type ModelDescriptor } from '../src/utils/modelRegistry';
import { ggufMetadata, ggufStreamMetadata } from '../src/utils/ggufMetadata';
const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)}});
const a:ModelDescriptor={...DEFAULT_MODEL,id:'a',sha256:'a'.repeat(64)},b={...a,id:'b',sha256:'b'.repeat(64)};
const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=(n:number)=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=(s:string)=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function fixture(arch:string,blocks:unknown=24,padding=0){
 const fields:[string,number,Buffer][]=[['general.architecture',8,str(arch)],['padding',8,Buffer.concat([u64(padding),Buffer.alloc(padding)])],[arch+'.context_length',4,u32(262144)]];
 if(blocks!==null)fields.push([arch+'.block_count',typeof blocks==='string'?8:5,typeof blocks==='string'?str(blocks):(()=>{const b=Buffer.alloc(4);b.writeInt32LE(blocks as number);return b;})()]);
 fields.push(['wrong_arch.block_count',4,u32(999)]);
 return Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,t,v])=>[str(k),u32(t),v]),Buffer.alloc(128*1024)]);
}
test('GGUF uses architecture-specific block count and preserves declared context above 2048/131072',async()=>{
 for(const arch of ['qwen35','llama','lfm2','lfm3','mamba']){const meta=await ggufMetadata(new Blob([fixture(arch)]));assert.equal(meta.blockCount,24);assert.equal(meta.contextLength,262144);assert.equal(meta.maxContext,2048);}
});
test('missing, negative and nonnumeric block metadata is unknown, never inferred from another architecture',async()=>{
 for(const blocks of [undefined,-1,'24']){const bytes=blocks===undefined?fixture('llama',null):fixture('llama',blocks);const meta=await ggufMetadata(new Blob([bytes]));assert.equal(meta.blockCount,undefined);}
});
test('native metadata streaming handles crossed windows, discards tensors and cancels the source',async()=>{
 const bytes=fixture('qwen35',24,65510);let received=0,cancelled=false;
 const body=new ReadableStream<Uint8Array>({pull(controller){const next=bytes.subarray(received,received+7001);if(next.length){received+=next.length;controller.enqueue(next);}else controller.close();},cancel(){cancelled=true;}});
 const meta=await ggufStreamMetadata(new Response(body),bytes.length);
 assert.equal(meta.blockCount,24);assert.equal(meta.contextLength,262144);assert.ok(received<bytes.length);assert.ok(cancelled);
});
const setup=()=>{values.clear();cacheModelMetadata(a,{architecture:'qwen35',contextLength:262144,blockCount:24});cacheModelMetadata(b,{architecture:'llama',contextLength:32768});};
test('per-model context persists, survives fresh reads and uses content identity on reimport',()=>{
 setup();
 saveContextPreference(a,{mode:'manual',tokens:8193});saveContextPreference(b,{mode:'manual',tokens:16384});
 saveContextPreference(a,{mode:'manual',tokens:8193});assert.deepEqual(previousContextPreference(a),{mode:'auto'});
 assert.deepEqual(modelContextPreference({...a,id:'reimported'}),{mode:'manual',tokens:8193});assert.deepEqual(modelContextPreference(b),{mode:'manual',tokens:16384});
 const persisted=[...values];values.clear();for(const [k,v] of persisted)values.set(k,v);
 assert.equal(contextPlan(a).requested,8193);assert.equal(modelMetadata(a).blockCount,24);assert.deepEqual(previousContextPreference(a),{mode:'auto'});
});
test('exact manual values and model/backend bounds reject invalid writes without changing preferences',()=>{
 setup();saveContextPreference(b,{mode:'manual',tokens:16384});
 for(const n of [0,-1,31,32769,NaN,1.5,Infinity])assert.throws(()=>saveContextPreference(b,{mode:'manual',tokens:n}),/context-range/);
 assert.equal(contextPlan(a,{mode:'manual',tokens:131073}).requested,131073);
 assert.throws(()=>contextPlan(a,{mode:'manual',tokens:8193},undefined,8192),/context-range/);
 assert.equal(modelContextPreference(b).mode,'manual');assert.equal(contextPlan(b).requested,16384);
});
test('automatic context is conservative, memory-pressure aware and does not mutate a manual preference',()=>{
 setup();saveContextPreference(a,{mode:'manual',tokens:8193});
 assert.equal(contextPlan(a,{mode:'auto'}).requested,2048);assert.equal(contextPlan(a,{mode:'auto'},a.bytes+1048576).requested,512);
 assert.equal(contextPlan(a,{mode:'auto'},Number.MAX_SAFE_INTEGER).requested,2048);assert.equal(contextPlan(a).requested,8193);
 const unknown={...a,sha256:'c'.repeat(64)};assert.equal(modelMetadata(unknown).contextLength,undefined);assert.equal(contextPlan(unknown).requested,2048);assert.equal(contextPlan({...unknown,maxContext:1024}).requested,1024);
});
test('logarithmic slider covers the model range and exact numeric values retain their value',()=>{
 setup();
 assert.equal(contextSliderTokens(0,32,262144),32);assert.equal(contextSliderTokens(1000,32,262144),262144);
 assert.ok(contextSliderTokens(500,32,262144)>2048);assert.ok(Math.abs(contextSliderTokens(contextSliderValue(8193,32,262144),32,262144)-8193)/8193<0.01);
 assert.equal(contextPlan(a,{mode:'manual',tokens:8193}).requested,8193);
});
