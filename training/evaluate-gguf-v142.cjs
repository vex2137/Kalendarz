// Real GGUF through the application's native engine; synthetic inputs only.
const fs=require('node:fs/promises'),{createReadStream}=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {NativeAI}=require('../electron/native-ai.cjs');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
(async()=>{
 const file=process.env.CALENDAR_MODEL_FILE,expected=process.env.CALENDAR_MODEL_SHA256,output=process.env.SFT_NATIVE_REPORT;
 if(!file||!/^[a-f0-9]{64}$/.test(expected||'')||!output)throw Error('Set CALENDAR_MODEL_FILE, CALENDAR_MODEL_SHA256 and SFT_NATIVE_REPORT');
 const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
 if(hash.digest('hex')!==expected)throw Error('model-checksum');
 const {ggufMetadata}=await import('../src/utils/ggufMetadata.ts');
 // openAsBlob is file backed; do not read a model-sized Buffer.
 const {openAsBlob}=require('node:fs');const meta=await ggufMetadata(await openAsBlob(file));
 if(meta.architecture!=='qwen35')throw Error('Expected Qwen3.5 GGUF');
 const descriptor={id:'imported-'+expected,name:meta.name,file:path.basename(file),bytes:(await fs.stat(file)).size,sha256:expected,revision:'local-verified',url:'',license:'https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE',licenseName:'Apache-2.0',...meta,estimatedRamMB:1600,imported:true};
 const data=process.env.SFT_REGRESSION==='1'?JSON.parse(await fs.readFile('training/v142/regression.json','utf8')):(await fs.readFile('training/v142/data/test.jsonl','utf8')).trim().split('\n').map(JSON.parse);
 const schema=JSON.parse(await fs.readFile('training/v142/data/command-schema.json','utf8'));
 const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-gguf-eval-'));
 const store=new NativeModelStore({root:scratch,catalogue:[descriptor],bundledId:descriptor.id,bundledPath:path.resolve(file)});
 const runtime=path.resolve(process.env.NATIVE_RUNTIME_DIR||`native/${process.platform==='win32'?'win':process.platform}-${process.arch}`);
 const ai=new NativeAI({runtimeRoot:runtime,store});
 const report={model:descriptor,backend:'application-native',conditions:{platform:os.platform(),cpu:os.cpus()[0]?.model,logicalCpus:os.availableParallelism(),context:meta.maxContext,enable_thinking:false,mode:'cpu',constrained:process.env.SFT_CONSTRAINED==='1'},corpusSha256:crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),runtime:JSON.parse(await fs.readFile(path.join(runtime,'runtime-manifest.json'),'utf8')),measurements:[],calendarWrites:0,androidVerified:false};
 try{
  await ai.setMode('cpu');
  // Three process cold starts; OS filesystem page cache is not flushed.
  for(let i=0;i<3;i++){
   await ai.cancel();const start=performance.now();await ai.prepare(descriptor.id);
   const row=data[0],result=await ai.complete(descriptor.id,{messages:row.messages.slice(0,-1),max_tokens:row.output_mode==='text'?96:256});
   report.measurements.push({phase:'cold-process',id:row.id,elapsedMs:performance.now()-start,...result});
  }
  // Full holdout is also the bounded long-conversation stability workload.
  for(const row of data){
   const start=performance.now();
   const result=await ai.complete(descriptor.id,{messages:row.messages.slice(0,-1),max_tokens:row.output_mode==='text'?96:256,...(report.conditions.constrained&&row.output_mode==='command'?{response_format:{type:'json_schema',json_schema:{name:'calendar_command',schema,strict:true}}}:{})});
   report.measurements.push({phase:'warm',id:row.id,language:row.language,category:row.category,elapsedMs:performance.now()-start,...result});
  }
  report.complete=true;
 }finally{
  await ai.cancel();await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');await fs.rm(scratch,{recursive:true,force:true});
 }
 console.log(JSON.stringify({output,samples:report.measurements.length,complete:report.complete,androidVerified:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});
