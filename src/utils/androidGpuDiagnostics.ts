import { Capacitor, registerPlugin } from '@capacitor/core';
export interface VulkanDevice {
  deviceName:string; vendorID:number; deviceID:number; deviceType:string; softwareDevice:boolean;
  apiVersion:string; driverVersionRaw:number; computeQueueAvailable:boolean;
  driverProperties?:{driverName:string;driverInfo:string;driverID:number};
  queueFamilies?:unknown[]; memory?:unknown; features?:unknown; relevantExtensions?:Record<string,boolean>;
}
export interface VulkanReport {
  version:number;success:boolean;stage:string;errorCode?:string;vkResult?:number;exitCode?:number;
  durationMs?:number;processDurationMs?:number;probeVersion?:string;
  loader?:{available:boolean;apiVersion?:string;apiVersionRaw?:number};
  physicalDevices?:VulkanDevice[];hardwareGpuDetected?:boolean;computeQueueAvailable?:boolean;selectedDevice?:VulkanDevice;
  compute?:{verified:boolean;elements:number;bufferBytes:number;allocationBytes:number;queueFamily:number};
}
const plugin=registerPlugin<{discover():Promise<VulkanReport>;testCompute(options:{confirmed:true}):Promise<VulkanReport>}>('CalendarGpuDiagnostics');
const listeners=new Set<()=>void>();let state:{discovery?:VulkanReport;computeTest?:VulkanReport;pending?:'discovery'|'compute'}={};
export const gpuDiagnosticsAvailable=()=>Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('CalendarGpuDiagnostics');
export const gpuDiagnosticsSnapshot=()=>state;
export const subscribeGpuDiagnostics=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
function update(next:typeof state){state=next;listeners.forEach(fn=>fn());}
export async function runGpuDiagnostic(compute=false){
  if(state.pending||!gpuDiagnosticsAvailable())return;
  update({...state,pending:compute?'compute':'discovery'});
  let report:VulkanReport;
  try{report=compute?await plugin.testCompute({confirmed:true}):await plugin.discover();}
  catch{report={version:1,success:false,stage:'bridge',errorCode:'vulkan-probe-bridge'};}
  // Never promote device discovery/queue availability to verified compute success.
  if(compute&&report.success&&report.compute?.verified!==true)report={...report,success:false,stage:'result-verify',errorCode:'vulkan-result-unverified'};
  update({...state,pending:undefined,...(compute?{computeTest:report}:{discovery:report})});
}
export function vulkanInferenceState(report:VulkanReport|undefined,packaged:string[]=[]){
  const gpu=report?.physicalDevices?.some(d=>!d.softwareDevice&&['integrated','discrete','virtual'].includes(d.deviceType));
  return gpu&&!packaged.includes('vulkan')?'gpu-backend-not-packaged':gpu?'gpu-detected':report?.success?'no-hardware-gpu':report?'probe-failed':'unknown';
}
