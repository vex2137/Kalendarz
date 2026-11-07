const {hybridKvBytes}=require('./gguf-memory.cjs');
const MiB=1048576;
const blocksOf=model=>Number.isInteger(model.blockCount)&&model.blockCount>0&&model.blockCount<=1000000?model.blockCount:undefined;
function layerLimit(model,requested){
  const blocks=blocksOf(model),max=blocks===undefined?1:blocks+1;
  return Math.min(max,Number.isInteger(requested)&&requested>0?requested:max);
}
function memoryEstimate(model,layers,context){
  layers=layerLimit(model,layers);
  const blocks=blocksOf(model),maximum=blocks===undefined?undefined:blocks+1;
  // GGUF bytes approximate tensor weights, not the host RAM recommendation.
  // Partial placement is approximate: embedding/output tensors are not uniform.
  const weights=Number.isSafeInteger(model.bytes)&&model.bytes>0?Math.ceil(model.bytes*(maximum?layers/maximum:1)):undefined;
  const kvKnown=Number.isSafeInteger(model.kvBytesPerToken)&&model.kvBytesPerToken>0;
  const hybrid=Array.isArray(model.kvLayout)&&model.kvLayout.length===blocks;
  const kv=hybrid?hybridKvBytes(model.kvLayout,layers,context):kvKnown?Math.ceil(model.kvBytesPerToken*context*(blocks?Math.min(layers,blocks)/blocks:1)):Math.ceil(256*MiB*Math.max(1,context/2048));
  const overhead=384*MiB,reserve=256*MiB;
  return {estimatedVramBytes:weights===undefined?undefined:weights+kv+overhead,kvCacheBytes:kv,backendOverheadBytes:overhead,reserveBytes:reserve,estimateKind:hybrid?'hybrid-metadata':kvKnown&&maximum?'metadata':'approximate'};
}
function gpuPlan(model,requested,context,device,automatic){
  const maximum=layerLimit(model,automatic?undefined:requested),availableVramBytes=device?.freeBytes;
  const fits=n=>{const e=memoryEstimate(model,n,context);return availableVramBytes===undefined?true:availableVramBytes>=(e.estimatedVramBytes??e.kvCacheBytes+e.backendOverheadBytes)+e.reserveBytes;};
  let layers=maximum;
  if(automatic&&blocksOf(model)&&!fits(layers)){
    let lo=0,hi=layers;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(fits(mid))lo=mid;else hi=mid-1;}layers=lo;
  }
  const estimate=memoryEstimate(model,layers||1,context);
  return {requestedLayers:automatic?maximum:layerLimit(model,requested),effectiveLayers:layers,...estimate,availableVramBytes,rejected:!layers||!fits(layers),layerMetadataKnown:blocksOf(model)!==undefined};
}
// Counts must come from the engine's explicit allocation report, not /health,
// the requested -ngl argument or a mere CUDA device/buffer discovery message.
function offloadEvidence(log){
  const matches=[...log.matchAll(/offloaded\s+(\d+)\s*\/\s*(\d+)\s+layers to GPU/gi)];
  const m=matches.at(-1);if(!m||Number(m[1])>Number(m[2]))return undefined;
  return {layers:Number(m[1]),total:Number(m[2])};
}
module.exports={layerLimit,memoryEstimate,gpuPlan,offloadEvidence};
