import test from 'node:test';
import assert from 'node:assert/strict';
import type { ModelDescriptor } from '../src/utils/modelRegistry';
import { transferName } from '../src/utils/resumableModelTransfer';

type Call = {method:string; options:any};
const methods=['start','status','pause','seedBegin','seedWrite','seedFinish','seedAbort'];
let invoke:(method:string,options:any)=>Promise<any>;
Object.assign(globalThis,{
  androidBridge:{},
  Capacitor:{PluginHeaders:[{name:'CalendarModelTransfer',methods:methods.map(name=>({name,rtype:'promise'}))}],
    nativePromise:(_plugin:string,method:string,options:any)=>invoke(method,options)},
  localStorage:{getItem:(key:string)=>key==='offline_calendar_settings_v2'?JSON.stringify({language:'de'}):null},
});
const {runNativeTransfer,hasNativeTransfers,nativeTransferRunning}=await import('../src/utils/nativeModelTransfer');
const model:ModelDescriptor={id:'native-seed-fixture',name:'Synthetic native seed',file:'fixture.gguf',bytes:2*1024*1024,sha256:'a'.repeat(64),url:'https://example.com/fixture.gguf',revision:'test',license:'',licenseName:'Test',estimatedRamMB:128,architecture:'llama',quantization:'Q4_K_M',maxContext:2048};
const state=(phase:string,extra:Record<string,unknown>={})=>({modelId:model.id,phase,receivedBytes:0,totalBytes:model.bytes,resumeBytes:0,installed:phase==='installed',verified:phase==='installed',...extra});

function legacyFixture(bytes:number,journal:unknown={key:transferName(model),etag:'"stable-v1"'}) {
  const key=transferName(model),removed:string[]=[],slices:number[]=[];
  const original=new Uint8Array(bytes);for(let i=0;i<bytes;i++)original[i]=i%251;
  const blob=new Blob([original]),slice=blob.slice.bind(blob);
  blob.slice=(start?:number,end?:number,type?:string)=>{slices.push((end??bytes)-(start??0));return slice(start,end,type);};
  blob.arrayBuffer=async()=>{throw Error('Do not buffer the complete legacy model');};
  const files=new Map<string,Blob>([[key+'.gguf',blob],[key+'.json',new Blob([typeof journal==='string'?journal:JSON.stringify(journal)])]]);
  const dir={
    getFileHandle:async(name:string)=>{const file=files.get(name);if(!file)throw new DOMException('missing','NotFoundError');return {getFile:async()=>file};},
    removeEntry:async(name:string)=>{removed.push(name);files.delete(name);},
  };
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{getDirectory:async()=>({getDirectoryHandle:async(name:string)=>{assert.equal(name,'calendar-models');return dir;}})}}});
  return {files,removed,slices,original,key};
}
function noLegacy(){Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{}}});}

for(const length of [768*1024+31,model.bytes]) {
  test(`migrates ${length===model.bytes?'complete':'partial'} legacy OPFS data with bounded native chunks and retains source`,async()=>{
    const fixture=legacyFixture(length),calls:Call[]=[],copied:Buffer[]=[];let aborts=0;
    invoke=async(method,options)=>{
      calls.push({method,options});
      if(method==='seedBegin'){assert.equal(options.etag,'"stable-v1"');assert.equal(options.bytes,length);return {token:'seed-fixture'};}
      if(method==='seedWrite'){assert.equal(options.token,'seed-fixture');const chunk=Buffer.from(options.data,'base64');assert.ok(chunk.length>0&&chunk.length<=256*1024);copied.push(chunk);return {bytes:copied.reduce((n,b)=>n+b.length,0)};}
      if(method==='seedFinish')return {};
      if(method==='seedAbort'){aborts++;throw Error('model-upload');} // Finish already consumed the token.
      if(method==='start'){assert.equal(options.model.id,model.id);assert.equal(options.language,'de');return state('installed',{receivedBytes:model.bytes});}
      throw Error(`unexpected ${method}`);
    };
    await runNativeTransfer(model,new AbortController().signal,()=>{});
    assert.deepEqual(Buffer.concat(copied),Buffer.from(fixture.original));
    assert.ok(fixture.slices.every(size=>size<=256*1024));assert.equal(aborts,1);
    assert.ok(calls.findIndex(c=>c.method==='seedFinish')<calls.findIndex(c=>c.method==='start'));
    assert.equal(fixture.files.size,2);assert.deepEqual(fixture.removed,[],'Runtime removes legacy data only after independent native installation confirmation');
  });
}

test('torn journals, wrong identity, weak or malformed ETags cannot seed a native Range',async()=>{
  for(const journal of ['{',{}, {key:'other-model',etag:'"stable-v1"'}, {key:transferName(model),etag:'W/"stable-v1"'}, {key:transferName(model),etag:'"injected\r\nvalue"'}]) {
    const fixture=legacyFixture(1000,journal),calls:string[]=[];
    invoke=async method=>{calls.push(method);if(method==='start')return state('paused',{resumeBytes:1000});throw Error('Unsafe seed should not be attempted');};
    await assert.rejects(runNativeTransfer(model,new AbortController().signal,()=>{}),{message:'model-cancelled'});
    assert.deepEqual(calls,['start']);assert.equal(fixture.files.size,2);assert.deepEqual(fixture.removed,[]);
  }
});

test('native checkpoint takes precedence without copying or deleting the legacy checkpoint',async()=>{
  const fixture=legacyFixture(1024),calls:string[]=[];
  invoke=async method=>{calls.push(method);if(method==='seedBegin')return {exists:true};if(method==='start')return state('installed');throw Error(`unexpected ${method}`);};
  await runNativeTransfer(model,new AbortController().signal,()=>{});
  assert.deepEqual(calls,['seedBegin','start']);assert.deepEqual(fixture.slices,[]);assert.deepEqual(fixture.removed,[]);
});

test('seed write failure aborts staging, retains original OPFS bytes and never starts the service',async()=>{
  const fixture=legacyFixture(700*1024),calls:string[]=[];
  invoke=async method=>{calls.push(method);if(method==='seedBegin')return {token:'seed-fixture'};if(method==='seedWrite')throw Error('model-storage-space');if(method==='seedAbort')return {};throw Error(`unexpected ${method}`);};
  await assert.rejects(runNativeTransfer(model,new AbortController().signal,()=>{}),{message:'model-storage-space'});
  assert.deepEqual(calls,['seedBegin','seedWrite','seedAbort']);assert.equal(fixture.files.size,2);assert.deepEqual(fixture.removed,[]);
});

test('cancellation during seed migration releases staging and leaves resumable OPFS data',async()=>{
  const fixture=legacyFixture(700*1024),controller=new AbortController(),calls:string[]=[];
  invoke=async method=>{calls.push(method);if(method==='seedBegin')return {token:'seed-fixture'};if(method==='seedWrite'){controller.abort();return {};}if(method==='seedAbort')return {};throw Error(`unexpected ${method}`);};
  await assert.rejects(runNativeTransfer(model,controller.signal,()=>{}),{name:'AbortError'});
  assert.deepEqual(calls,['seedBegin','seedWrite','seedAbort']);assert.equal(fixture.files.size,2);assert.deepEqual(fixture.removed,[]);
});

test('recreated WebView joins terminal native state without seeding, starting or deleting OPFS',async()=>{
  const fixture=legacyFixture(1024),calls:string[]=[],progress:string[]=[];
  invoke=async method=>{calls.push(method);if(method==='status')return state('installed',{receivedBytes:model.bytes});throw Error(`unexpected ${method}`);};
  await runNativeTransfer(model,new AbortController().signal,s=>progress.push(s.phase),true);
  assert.deepEqual(calls,['status']);assert.deepEqual(progress,['installed']);assert.deepEqual(fixture.removed,[]);
});

test('joined terminal errors and paused state propagate exact results without restarting',async()=>{
  noLegacy();
  for(const [phase,error] of [['error','model-checksum'],['error',undefined],['missing',undefined],['paused',undefined]] as const) {
    const calls:string[]=[];invoke=async method=>{calls.push(method);return state(phase,{error});};
    await assert.rejects(runNativeTransfer(model,new AbortController().signal,()=>{},true),{message:phase==='paused'?'model-cancelled':error||'model-download'});
    assert.deepEqual(calls,['status']);
  }
});

test('native transfer capability and running state distinguish active I/O from terminal states',()=>{
  assert.equal(hasNativeTransfers(),true);
  for(const phase of ['downloading','verifying','installed','error','paused','missing'] as const)assert.equal(nativeTransferRunning(state(phase) as any),phase==='downloading'||phase==='verifying');
});
