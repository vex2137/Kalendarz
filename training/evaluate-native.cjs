// Bounded real-GGUF evaluation; reports raw extraction, never executes a command.
const fs=require('node:fs/promises');
const path=require('node:path');
const {NativeAI}=require('../electron/native-ai.cjs');
const {NativeModelStore}=require('../electron/native-model-store.cjs');
(async()=>{
  const catalogue=[require('../src/utils/localModelManifest.json'),...require('../src/utils/optionalModels.json')];
  const model=catalogue.find(m=>m.id===(process.env.NATIVE_MODEL_ID||catalogue[0].id));
  if(!model||!process.env.CALENDAR_MODEL_FILE)throw Error('Select a catalogue model and CALENDAR_MODEL_FILE');
  const directory=process.env.SFT_DATA_DIR||'training/data';
  const schema=JSON.parse(await fs.readFile(path.join(directory,'command-schema.json'),'utf8'));
  const rows=(await fs.readFile(path.join(directory,'test.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  // One example per held-out category/language unless the complete split is requested.
  const seen=new Set(),sample=process.env.SFT_FULL_TEST==='1'?rows:rows.filter(row=>{const key=row.category+':'+row.language;if(seen.has(key))return false;seen.add(key);return true;});
  const limit=Number(process.env.SFT_EVAL_LIMIT||90);if(!Number.isInteger(limit)||limit<1||limit>1000)throw Error('Invalid evaluation budget');
  const store=new NativeModelStore({root:'/unused',catalogue,bundledId:model.id,bundledPath:path.resolve(process.env.CALENDAR_MODEL_FILE)});
  const ai=new NativeAI({runtimeRoot:path.resolve(process.env.NATIVE_RUNTIME_DIR||`native/${process.platform==='win32'?'win':process.platform==='darwin'?'mac':process.platform}-${process.arch}`),store});
  const report={model:model.id,sha256:model.sha256,fineTuned:false,calendarWrites:0,constrainedDecoding:true,results:[],passed:false};
  const {parseModelCommand}=await import('../src/utils/modelCommand.ts');
  try{
    await ai.setMode('cpu');
    for(const row of sample.slice(0,limit)){
      const result=await ai.complete(model.id,{messages:row.messages.slice(0,2),max_tokens:model.id==='lfm2.5-2.6b-q4-k-m'?768:256,response_format:{type:'json_schema',json_schema:{name:'calendar_command',schema,strict:true}}});
      let command,syntax=false,valid=false;
      try{JSON.parse(result.text);syntax=true;command=parseModelCommand(result.text);valid=result.finish==='stop';}catch{}
      const expected=JSON.parse(row.messages[2].content),normalize=value=>JSON.stringify(Object.fromEntries(Object.entries(value).filter(([,v])=>v!=null).sort(([a],[b])=>a.localeCompare(b))));
      report.results.push({id:row.id,category:row.category,language:row.language,expected,syntax,valid,intent:valid&&command.action===expected.action,exact:valid&&normalize(command)===normalize(expected),...result});
    }
    report.summary={records:report.results.length,validJson:report.results.filter(r=>r.syntax).length,validCommands:report.results.filter(r=>r.valid).length,intent:report.results.filter(r=>r.intent).length,exact:report.results.filter(r=>r.exact).length};
    report.passed=true;
  }finally{
    await ai.cancel();const output=process.env.SFT_NATIVE_REPORT||'training/runs/native-base-evaluation.json';await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({model:report.model,completed:report.passed,summary:report.summary,output}));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
