import test from 'node:test';
import assert from 'node:assert/strict';

const token='11111111-1111-4111-8111-111111111111';
const methods=['pick','release','open','read','close'];
let next: (method:string,options:any)=>Promise<any>;
Object.assign(globalThis,{androidBridge:{},location:new URL('https://localhost'),Capacitor:{PluginHeaders:[{name:'CalendarModelImport',methods:methods.map(name=>({name,rtype:'promise'}))}],nativePromise:(_plugin:string,method:string,options:any)=>next(method,options)}});
const {nativeModelResponse,nativeModelUrl}=await import('../src/utils/nativeModelImport');

test('native import feeds bounded chunks only when requested and never fetches HTTP',async()=>{
  const bytes=new Uint8Array(256*1024).fill(71);let reads=0,closed=0;
  next=async(method,options)=>{
    assert.equal(options.token,token);
    if(method==='open')return;
    if(method==='close'){closed++;return;}
    if(method==='read'){reads++;return reads<=3?{data:Buffer.from(bytes).toString('base64'),done:false,received:reads*bytes.length}:{data:'',done:true,received:3*bytes.length};}
    throw Error('unexpected method');
  };
  const response=await nativeModelResponse(nativeModelUrl(token),new AbortController().signal,-1);
  assert.equal(reads,0,'No speculative chunk buffering');
  const reader=response!.body!.getReader();let received=0;
  while(true){const chunk=await reader.read();if(chunk.done)break;assert.equal(chunk.value.length,256*1024);received+=chunk.value.length;}
  assert.equal(received,3*256*1024);assert.equal(closed,1);
});
test('native provider errors retain precise safe error codes and close the stream',async()=>{
  for(const code of ['model-import-permission','model-import-unavailable','model-import-expired','model-gguf-invalid']){
    let closed=0;next=async method=>{if(method==='close'){closed++;return;}throw Error(code);};
    await assert.rejects(nativeModelResponse(nativeModelUrl(token),new AbortController().signal),{message:code});assert.equal(closed,1);
  }
});
test('native stream cancellation and abort close the reader without retry loops',async()=>{
  let closed=0,reads=0;next=async method=>{if(method==='close'){closed++;return;}if(method==='read'){reads++;return {data:'R0dVRgMAAAA=',done:false,received:8};}};
  const controller=new AbortController(),response=await nativeModelResponse(nativeModelUrl(token),controller.signal);
  await response!.body!.cancel();assert.equal(reads,0);assert.equal(closed,1);
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(nativeModelResponse(nativeModelUrl(token),aborted.signal),{name:'AbortError'});assert.equal(closed,1);
});
test('native read failure is observable and an oversized bridge chunk is rejected',async()=>{
  for(const malformed of [false,true]){
    let closed=0;next=async method=>{if(method==='close'){closed++;return;}if(method==='read'){if(malformed)return {data:'A'.repeat(400000),done:false,received:1};throw Error('model-import-read');}};
    const response=await nativeModelResponse(nativeModelUrl(token),new AbortController().signal);
    await assert.rejects(response!.body!.getReader().read(),{message:'model-import-read'});assert.equal(closed,1);
  }
});
test('only the local opaque SAF token route can use native document access',async()=>{
  next=async()=>{throw Error('must not call bridge');};
  for(const url of ['https://example.com/_calendar_model_import/'+token,'https://localhost/other/'+token,'https://localhost/_calendar_model_import/../../file'])assert.equal(await nativeModelResponse(url,new AbortController().signal),undefined);
});
