// Real GGUF process test. GPU proof is mandatory only with REQUIRE_REAL_GPU=1.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {NativeAI}=require('../electron/native-ai.cjs');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
(async()=>{
  const catalogue=[require('../src/utils/localModelManifest.json'),...require('../src/utils/optionalModels.json')];
  const model=catalogue.find(model=>model.id===(process.env.NATIVE_MODEL_ID||catalogue[0].id));assert.ok(model);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'calendar-native-smoke-'));
  const store=new NativeModelStore({root,bundledId:model.id,bundledPath:path.resolve(process.env.CALENDAR_MODEL_FILE||'public/models/'+model.file),catalogue});
  const ai=new NativeAI({runtimeRoot:path.resolve(process.env.NATIVE_RUNTIME_DIR||`native/${process.platform==='win32'?'win':'linux'}-x64`),store});
  const report={model:model.id,runtime:require('../scripts/native-runtime-manifest.json').version,physicalGpuProof:false,results:[],passed:false};
  try{
    const {calendarSystemPrompt,COMMAND_SCHEMA,parseModelCommand}=await import('../src/utils/modelCommand.ts');
    const now=new Date('2026-10-24T12:00:00+02:00');
    await ai.setMode(process.env.REQUIRE_REAL_GPU==='1'?'gpu':'auto');
    let started=performance.now();report.prepared=await ai.prepare(model.id);report.loadMs=performance.now()-started;
    const request=prompt=>({messages:[{role:'system',content:calendarSystemPrompt('pl',now)},{role:'user',content:prompt}],max_tokens:256,response_format:{type:'json_schema',json_schema:{name:'calendar_command',schema:COMMAND_SCHEMA,strict:true}}});
    for(const prompt of ['Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00','Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00','Przenieś wydarzenie Dentysta na poniedziałek o 14:00','Jaki mam plan na dziś?','Dodaj spotkanie kiedyś po południu']){
      started=performance.now();const result=await ai.complete(model.id,request(prompt));
      const command=parseModelCommand(result.text);assert.ok(result.usage.completion_tokens>0);assert.ok(result.firstTokenMs>=0);
      report.results.push({prompt,command,totalMs:performance.now()-started,...result});
    }
    const first=report.results[0].command;assert.equal(first.action,'create');assert.equal(first.date,'2026-10-25');assert.equal(first.time,'15:00');assert.equal(first.endTime,'16:00');
    const pid=ai.child.pid;await ai.cancel();assert.equal(ai.snapshot().loaded,false);
    assert.throws(()=>process.kill(pid,0),'Unloading must end the inference process');
    await ai.setMode('cpu');await ai.prepare(model.id);assert.equal(ai.snapshot().backend,'cpu-native');
    const generation=ai.complete(model.id,{messages:[{role:'user',content:'Write a very long detailed story about a clock.'}],max_tokens:768});
    const cancelled=assert.rejects(generation);await new Promise(resolve=>setTimeout(resolve,150));await ai.cancel();await cancelled;
    await ai.prepare(model.id);const reload=await ai.complete(model.id,request('Dodaj wydarzenie Pomiar jutro o 14:15'));assert.equal(parseModelCommand(reload.text).time,'14:15');report.reload=reload;
    report.physicalGpuProof=report.results.every(row=>row.backend.backend==='vulkan'&&row.backend.gpuActive&&row.backend.offloadedLayers>0);
    if(process.env.REQUIRE_REAL_GPU==='1')assert.equal(report.physicalGpuProof,true,'Real GPU inference was not established; publication is blocked');
    report.passed=true;
  }finally{await ai.cancel();await store.close();await fs.rm(root,{recursive:true,force:true});await fs.writeFile(process.env.NATIVE_REPORT||'native-smoke-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({model:model.id,passed:report.passed,loadMs:report.loadMs,physicalGpuProof:report.physicalGpuProof,results:report.results.map(r=>({prompt:r.prompt,command:r.command,backend:r.backend,firstTokenMs:r.firstTokenMs,timings:r.timings,usage:r.usage}))}));}
})().catch(error=>{console.error(error);process.exitCode=1;});
