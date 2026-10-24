// Real GGUF compatibility probes; never substitute the rules or fallback model.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { writeFileSync, existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const id = process.env.CANDIDATE_MODEL_ID;
const base = 'http://127.0.0.1:4183';
(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4183','--strictPort'], { stdio: 'ignore' });
  let browser, report = { id, status: 'failed', platform: 'cloud-chromium', physicalDevice: false };
  const profile = mkdtempSync(join(tmpdir(),'calendar-candidate-'));
  try {
    for (let i=0;i<100;i++) { try { if((await fetch(base)).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
    const context = browser = await chromium.launchPersistentContext(profile, { headless: true, serviceWorkers:'block', ...(existsSync('/usr/bin/chromium') ? { executablePath:'/usr/bin/chromium' } : {}), args:['--no-sandbox'] });
    if(process.env.CANDIDATE_RUNTIME==='compat')await context.addInitScript(()=>Object.defineProperty(WebAssembly,'Suspending',{value:undefined,configurable:true}));
    const external=[];
    await context.route('**/*', route => { if(new URL(route.request().url()).origin!==base) { external.push(route.request().url());return route.abort(); } return route.continue(); });
    const page=await context.newPage();
    page.on('console',message=>{if(message.type()==='error')console.error('Engine:',message.text());});
    page.setDefaultTimeout(900000);
    await page.goto(base+'/tests/model-evaluation.html');
    await page.waitForFunction(()=>window.calendarEvaluation);
    report=await page.evaluate(async id => {
      const {runtime,diagnosticsReport}=window.calendarEvaluation;
      await runtime.selectLocalModel(id);
      const file=await (await fetch('/benchmark-model.gguf')).blob();
      await runtime.installLocalModel(file);
      if(!runtime.modelStatus().installed) throw new Error('Candidate installation failed: '+JSON.stringify({status:runtime.modelStatus(),storage:await navigator.storage.estimate()}));
      let cold,warm,command;
      try {
        cold=await runtime.inferLocalText('Answer the user briefly in their language.','Ile to jest dwa plus dwa? Odpowiedz samą liczbą.',[],{maxTokens:768,timeoutMs:600000});
        warm=await runtime.inferLocalText('Answer the user briefly in their language.','What is two plus two? Answer with the number only.',[],{maxTokens:768,timeoutMs:600000});
        command=await runtime.inferCalendarJson('Extract a JSON calendar command.','Add event Test tomorrow at 14:00',{type:'object',properties:{action:{const:'create'},title:{type:'string'}},required:['action','title'],additionalProperties:false},[],{maxTokens:768,timeoutMs:600000});
      } catch(error) { return {id,status:'failed',platform:'cloud-chromium',physicalDevice:false,error:String(error),cold,warm,command,diagnostics:diagnosticsReport()}; }
      const diagnostics=diagnosticsReport();
      const chat=await window.calendarEvaluation.runModelAssistant('Możemy po prostu pogadać?',[],'en',new Date(2026,9,24,10),{},window.calendarEvaluation.DEFAULT_PLANNING);
      const chatMetric=diagnosticsReport().metrics.at(-1);
      const calendar=await window.calendarEvaluation.runModelAssistant('Dodaj wydarzenie Próba jutro o 9:00',[],'en',new Date(2026,9,24,10),{},window.calendarEvaluation.DEFAULT_PLANNING);
      await runtime.unloadLocalModel();
      return {id,status:'passed',platform:'cloud-chromium',physicalDevice:false,cold,warm,command,diagnostics,pipeline:{chat:{text:chat.text,route:chat.route,language:chat.language,proposal:Boolean(chat.suggestedPlan),metric:chatMetric},calendar:{route:calendar.route,language:calendar.language,title:calendar.suggestedPlan?.events[0]?.title}}};
    },id);
    assert.equal(report.status,'passed',JSON.stringify(report));
    report.runtimeFlavor=process.env.CANDIDATE_RUNTIME||'auto';
    if(report.runtimeFlavor==='compat')assert.equal(report.diagnostics.capabilities.jspi,false);
    if(report.runtimeFlavor==='jspi')assert.equal(report.diagnostics.capabilities.jspi,true);
    report.quality = { polishArithmetic: /4/u.test(report.cold), englishArithmetic: /4/u.test(report.warm) };
    assert.ok(report.cold.length>0 && report.warm.length>0, 'Raw generation must return actual output');
    assert.equal(JSON.parse(report.command).action,'create');
    assert.equal(report.pipeline.chat.route,'model');assert.equal(report.pipeline.chat.proposal,false);assert.equal(report.pipeline.chat.language,'pl');assert.ok(report.pipeline.chat.metric.completionTokens>0&&report.pipeline.chat.metric.modelId===id);
    assert.equal(report.pipeline.calendar.route,'rules');assert.equal(report.pipeline.calendar.language,'pl');assert.equal(report.pipeline.calendar.title,'Próba');
    const inferences=report.diagnostics.metrics.filter(x=>x.route==='model'&&!x.error);
    assert.equal(inferences.length,3); assert.ok(inferences.every(m=>m.modelId===id&&m.completionTokens>0));
    assert.deepEqual(external,[]);
    console.log(JSON.stringify(report));
  } catch(error) { report.status='failed'; report.error=String(error); console.error(error); process.exitCode=1; }
  finally { writeFileSync(process.env.CANDIDATE_REPORT||'candidate-results.json',JSON.stringify(report,null,2)); await browser?.close();server.kill('SIGTERM');rmSync(profile,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
