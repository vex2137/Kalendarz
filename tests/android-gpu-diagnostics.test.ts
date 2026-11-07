import test from 'node:test';import assert from 'node:assert/strict';
import {vulkanInferenceState,type VulkanReport} from '../src/utils/androidGpuDiagnostics';
const device={deviceName:'Fixture device',vendorID:0,deviceID:0,deviceType:'integrated',softwareDevice:false,apiVersion:'1.1.0',driverVersionRaw:7,computeQueueAvailable:true};
test('hardware discovery and compute queue do not imply a packaged inference backend',()=>{
 const r:VulkanReport={version:1,success:true,stage:'discovered',physicalDevices:[device]};
 assert.equal(vulkanInferenceState(r,['cpu-native']),'gpu-backend-not-packaged');assert.equal(vulkanInferenceState(r,['cpu-native','vulkan']),'gpu-detected');
});
test('software Vulkan and failed/unknown discovery are not represented as physical GPU',()=>{
 assert.equal(vulkanInferenceState({version:1,success:true,stage:'discovered',physicalDevices:[{...device,deviceType:'cpu',softwareDevice:true}]}),'no-hardware-gpu');
 assert.equal(vulkanInferenceState({version:1,success:false,stage:'loader'}),'probe-failed');assert.equal(vulkanInferenceState(undefined),'unknown');
});
