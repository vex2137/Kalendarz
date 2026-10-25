// Actual inference only. A GPU-only failure is recorded as unavailable, never a CPU score.
const os=require('node:os');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{createReadStream}=require('node:fs');
const {NativeAI}=require('../electron/native-ai.cjs');
const {readGGUF}=require('../electron/model-folders.cjs');
(async()=>{
  const file=process.env.CALENDAR_MODEL_FILE;if(!file)throw Error('Set CALENDAR_MODEL_FILE to a local GGUF. No weights are downloaded.');
  const meta=await readGGUF(file);const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  const descriptor={...meta,id:'benchmark-local',name:meta.name,bytes:meta.stat.size,estimatedRamMB:Math.ceil(meta.stat.size/1048576*1.5)+512};
  const runtimeRoot=process.env.CALENDAR_NATIVE_ROOT||path.join(__dirname,'..','native',`${process.platform==='win32'?'win':process.platform==='darwin'?'mac':process.platform}-${process.arch}`);
  const ai=new NativeAI({runtimeRoot,store:{descriptor:id=>{if(id!==descriptor.id)throw Error('model-unknown');return descriptor;},verifiedPath:async()=>file}});
  const report={createdAt:new Date().toISOString(),platform:process.platform,arch:process.arch,hardware:{cpu:os.cpus()[0]?.model,availableCpuThreads:os.availableParallelism()},model:{name:meta.name,bytes:meta.stat.size,sha256:hash.digest('hex')},physicalGpuClaims:'Only rows with gpuActive=true confirm inference; device enumeration alone does not.',rows:[]};
  try{for(const mode of ['cpu','auto','gpu']){
    await ai.setMode(mode);const opened=performance.now();
    try{
      const loaded=await ai.prepare(descriptor.id),loadMs=performance.now()-opened;
      for(const [name,prompt,max_tokens] of [['short','Jak tam? Odpowiedz jednym zdaniem.',32],['long','Prepare a weekly planning checklist from these synthetic constraints. Explain five useful steps; do not claim that any events have been saved. '+Array.from({length:12},(_,i)=>`Task ${i+1}: prepare a report for day ${i%5+1}, duration ${30+i*5} minutes; reserve a 15-minute break and allow time to reach the office.`).join(' ')+' Prioritize the reports, explain how to check for conflicts, and leave time for unexpected delays.',128]]){
        for(const run of ['cold-prompt','warm-prompt']){
          const started=performance.now();const result=await ai.complete(descriptor.id,{messages:[{role:'system',content:'Be brief. Do not claim any calendar action was executed.'},{role:'user',content:prompt}],max_tokens});
          report.rows.push({mode,name,run,loadMs:name==='short'&&run==='cold-prompt'?loadMs:0,totalMs:performance.now()-started,firstTokenMs:result.firstTokenMs,finish:result.finish,usage:result.usage,timings:result.timings,backend:result.backend,outputCharacters:result.text.length});
        }
      }
    }catch(error){report.rows.push({mode,error:error.message,backend:ai.snapshot()});}
  }}finally{await ai.cancel();}
  const output=process.env.CALENDAR_BENCHMARK_REPORT||'native-backend-benchmark.json';await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
