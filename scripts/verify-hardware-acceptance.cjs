// A successful CPU CI run cannot authorize the GPU claim in the 1.4.1 release.
const {existsSync,readFileSync}=require('node:fs');
const {execFileSync}=require('node:child_process');
if(require('../package.json').version==='1.4.1') {
  const file='docs/validation/v1.4.1-hardware-acceptance.json';
  if(!existsSync(file))throw Error('Publication blocked: reviewed Linux NVIDIA and Windows NVIDIA GPU inference reports are missing. Run the real hardware protocol in docs/AI-1.4.1.md; CPU CI and simulated device-loss tests are not GPU proof.');
  const acceptance=JSON.parse(readFileSync(file,'utf8'));
  const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  for(const platform of ['linux','win32']){
    const report=acceptance.reports?.find(report=>report.platform===platform);
    if(!report||report.sourceCommit!==source||report.passed!==true||report.physicalGpuProof!==true||!report.reviewedBy||!report.artifactSha256?.match(/^[a-f0-9]{64}$/)||!report.results?.length||report.results.some(row=>row.backend?.backend!=='vulkan'||row.backend.gpuActive!==true||row.backend.offloadedLayers<1||row.usage?.completion_tokens<1))throw Error('Publication blocked: missing current, reviewed real GPU evidence for '+platform);
  }
}
