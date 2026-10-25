import test from 'node:test';
import assert from 'node:assert/strict';
import { ggufMetadata } from '../src/utils/ggufMetadata';
import { modelChecksum, verifyModel, saveModel, savedModel } from '../src/utils/localModelStore';
import { registerImportedModel, modelChoices, findModel, persistModelSelection, activeModel, type ModelDescriptor } from '../src/utils/modelRegistry';
import 'fake-indexeddb/auto';
const u32=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const u64=(n:number)=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const str=(s:string)=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function fixture(type:number,split=1) {
  const fields=[['general.architecture','qwen35'],['general.name','Qwen test'],['general.file_type',type],['qwen35.context_length',32768],['split.count',split]] as const;
  return new Blob([Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(64)])]);
}
test('GGUF imports identify Qwen3.5 Q4_K_M and IQ4_XS from metadata, not catalogue size',async()=>{
  for(const [type,quantization] of [[15,'Q4_K_M'],[30,'IQ4_XS']] as const){
    const meta=await ggufMetadata(fixture(type));
    assert.equal(meta.architecture,'qwen35');assert.equal(meta.quantization,quantization);assert.equal(meta.maxContext,2048);
  }
});
test('GGUF metadata rejects invalid, truncated, hostile and multipart files',async()=>{
  for(const blob of [new Blob(['not GGUF']),fixture(15).slice(0,40),fixture(15,2),new Blob([Buffer.from('GGUF'),u32(3),u64(1),u64(1),u64(Number.MAX_SAFE_INTEGER)])]) await assert.rejects(ggufMetadata(blob),/model-gguf/);
});
test('content-addressed import is persisted independently and checksum catches changed bytes',async()=>{
  const values=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v)}});
  const blob=fixture(30),checksum=await modelChecksum(blob);
  const descriptor:ModelDescriptor={...await ggufMetadata(blob),id:'imported-'+checksum,file:'custom.gguf',bytes:blob.size,sha256:checksum,url:'',revision:'local',license:'',licenseName:'Local file',estimatedRamMB:512,imported:true};
  registerImportedModel(descriptor);persistModelSelection(descriptor);
  assert.equal(activeModel().id,descriptor.id);assert.equal(findModel(descriptor.id).quantization,'IQ4_XS');
  assert.ok(modelChoices().some(m=>m.id===descriptor.id));
  assert.match(values.get('calendar_imported_ai_models_v1')!,/IQ4_XS/);
  await verifyModel(blob,undefined,undefined,descriptor);
  await saveModel(blob,new AbortController().signal,descriptor);
  assert.equal(await modelChecksum((await savedModel(descriptor))!),checksum);
  await assert.rejects(verifyModel(new Blob([new Uint8Array(blob.size)]),undefined,undefined,descriptor),/model-checksum/);
  assert.throws(()=>registerImportedModel({...descriptor,id:'../../bad'}),/model-input/);
});
