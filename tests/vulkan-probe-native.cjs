// Real Vulkan execution on the Actions host's software ICD, not Android hardware.
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve('build/vulkan-probe'),base=path.join(root,'probe-host'),bad=path.join(root,'probe-corrupt');
function run(binary,arg,env={}){const r=spawnSync(binary,[arg],{encoding:'utf8',timeout:8000,maxBuffer:256*1024,env:{...process.env,...env}});assert.ifError(r.error);const data=JSON.parse(r.stdout);return {code:r.status,data};}
test('real software Vulkan loader/device discovery is independent of llama and GGUF',()=>{
 const {code,data:d}=run(base,'--discover');assert.equal(code,0);assert.equal(d.success,true);assert.equal(d.loader.available,true);assert.ok(d.physicalDevices.length);assert.equal(d.hardwareGpuDetected,false);assert.equal(d.selectedDevice.softwareDevice,true);assert.equal(d.computeQueueAvailable,true);assert.equal(d.compute,undefined);assert.match(d.selectedDevice.memory.interpretation,/not confirmed dedicated VRAM/);
});
test('actual shader result verifies all 64 uint additions and bounds its buffer',()=>{
 const {code,data:d}=run(base,'--compute');assert.equal(code,0);assert.equal(d.success,true);assert.equal(d.compute.verified,true);assert.equal(d.compute.elements,64);assert.equal(d.compute.bufferBytes,768);assert.ok(d.compute.allocationBytes<=1024*1024);
});
test('tampered host-test output fails verification despite a successful Vulkan submission',()=>{
 const {code,data:d}=run(bad,'--compute');assert.notEqual(code,0);assert.equal(d.success,false);assert.equal(d.stage,'result-verify');assert.equal(d.errorCode,'vulkan-result-mismatch');
});
test('missing ICD/invalid arguments return structured failure and never success',()=>{
 const missing=run(base,'--discover',{VK_ICD_FILENAMES:'/nonexistent-calendar-icd.json'});assert.notEqual(missing.code,0);assert.equal(missing.data.success,false);assert.ok(missing.data.stage);assert.ok(missing.data.errorCode);
 const invalid=run(base,'--benchmark');assert.notEqual(invalid.code,0);assert.equal(invalid.data.errorCode,'vulkan-invalid-arguments');
});
