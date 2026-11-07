import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODEL } from '../src/utils/modelRegistry';
import { cacheModelMetadata, modelContextKey } from '../src/utils/modelContext';
import { gpuLayerBounds, gpuLayerLimit, gpuLayerPreference, gpuLayerStorageKey, saveGpuLayerPreference } from '../src/utils/modelGpuLayers';
const values=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)}});
const a={...DEFAULT_MODEL,id:'a',sha256:'a'.repeat(64)},b={...a,id:'b',sha256:'b'.repeat(64)};
function setup(){values.clear();cacheModelMetadata(a,{architecture:'qwen35',blockCount:32});cacheModelMetadata(b,{architecture:'lfm3',blockCount:16});}
test('GPU preferences use content identity, survive reads/restarts and remain separate per model',()=>{
 setup();saveGpuLayerPreference(a,5);saveGpuLayerPreference(b,8);
 const persisted=[...values];values.clear();for(const [k,v]of persisted)values.set(k,v);
 assert.equal(gpuLayerLimit({...a,id:'reimported'}),5);assert.equal(gpuLayerLimit(b),8);
 saveGpuLayerPreference(a,'auto');assert.equal(gpuLayerLimit(a),33);assert.equal(gpuLayerLimit(b),8);
});
test('legacy all-layers sentinel migrates to Auto; oversized saved manual values are safely clamped',()=>{
 setup();values.set('calendar_ai_gpu_layers_v1','999');assert.deepEqual(gpuLayerPreference(a),{mode:'auto'});assert.equal(gpuLayerLimit(a),33);
 values.set(gpuLayerStorageKey,JSON.stringify({legacyAdopted:true,models:{[modelContextKey(a)]:{mode:'manual',layers:999}}}));
 assert.deepEqual(gpuLayerPreference(a),{mode:'manual',layers:33});assert.equal(JSON.parse(values.get(gpuLayerStorageKey)!).models[modelContextKey(a)].layers,33);
 setup();values.set('calendar_ai_gpu_layers_v1','8');assert.equal(gpuLayerLimit(a),8);assert.equal(gpuLayerPreference(b).mode,'auto','Global legacy value migrates only once');
});
test('invalid manual layers cannot overwrite a preference; unknown block count stays explicit',()=>{
 setup();saveGpuLayerPreference(a,5);
 for(const n of [0,-1,34,999,1.5,NaN,Infinity])assert.throws(()=>saveGpuLayerPreference(a,n),/model-input/);
 assert.equal(gpuLayerLimit(a),5);
 const unknown={...a,sha256:'c'.repeat(64)};assert.deepEqual(gpuLayerBounds(unknown),{blocks:undefined,max:1});assert.equal(gpuLayerLimit(unknown),1);
 assert.throws(()=>saveGpuLayerPreference(unknown,2),/model-input/);
});
