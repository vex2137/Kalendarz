// Read-only catalogue verification for a machine with Hugging Face access.
// Range requests inspect the header; they never download a whole model.
import { AI_MODELS } from '../src/utils/modelRegistry';
import { writeFileSync } from 'node:fs';
const rows:Record<string,unknown>[]=[];
for(const model of AI_MODELS){
  const row:Record<string,unknown>={id:model.id,url:model.url,revision:model.revision};rows.push(row);
  try{
    const pathname=new URL(model.url).pathname, [owner,repo]=pathname.split('/').filter(Boolean);
    const metadataResponse=await fetch(`https://huggingface.co/api/models/${owner}/${repo}/revision/${model.revision}?blobs=true`,{signal:AbortSignal.timeout(20000)});
    row.metadataStatus=metadataResponse.status;
    if(!metadataResponse.ok){row.cause=[401,403].includes(metadataResponse.status)?'access-denied':metadataResponse.status===404?'repository-or-revision-missing':'metadata-http-error';continue;}
    const meta=await metadataResponse.json();const entry=meta.siblings?.find((f:{rfilename:string})=>f.rfilename===model.file);
    if(!entry){row.cause='file-missing-in-pinned-revision';continue;}
    row.metadataMatches=meta.sha===model.revision&&entry.lfs?.sha256===model.sha256&&(entry.size||entry.lfs?.size)===model.bytes;
    if(!row.metadataMatches){row.cause='integrity-metadata-mismatch';continue;}
    const response=await fetch(model.url,{headers:{Range:'bytes=0-23'},signal:AbortSignal.timeout(20000)});row.downloadStatus=response.status;
    if(!response.ok){row.cause=[401,403].includes(response.status)?'download-access-denied':[404,410].includes(response.status)?'download-url-missing':'download-http-error';await response.body?.cancel();continue;}
    const reader=response.body?.getReader();if(!reader){row.cause='empty-response';continue;}
    const bytes=new Uint8Array(24);let n=0;
    try{while(n<24){const next=await reader.read();if(next.done)break;const count=Math.min(24-n,next.value.length);bytes.set(next.value.subarray(0,count),n);n+=count;}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    row.headerValid=n===24&&new TextDecoder().decode(bytes.subarray(0,4))==='GGUF';row.cause=row.headerValid?'verified-source-and-download-header':'invalid-or-incomplete-header';
  }catch(error){row.cause='network-or-policy-error';row.detail=error instanceof Error?error.message:String(error);}
}
const output=process.env.CALENDAR_MODEL_DIAGNOSTICS_REPORT||'model-download-diagnostics.json';
writeFileSync(output,JSON.stringify({checkedAt:new Date().toISOString(),rows},null,2)+'\n');console.log(JSON.stringify(rows,null,2));
if(rows.some(row=>row.cause!=='verified-source-and-download-header'))process.exitCode=1;
