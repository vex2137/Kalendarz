const { chromium }=require('playwright');
const { spawn }=require('node:child_process');
const { existsSync,writeFileSync }=require('node:fs');
const assert=require('node:assert/strict');
const base='http://127.0.0.1:4185';
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4185','--strictPort'],{stdio:'ignore'});
  let browser;
  try{
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    const context=await browser.newContext({serviceWorkers:'block'}),external=[];
    await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}return route.continue();});
    const page=await context.newPage();page.setDefaultTimeout(300000);await page.goto(base+'/tests/model-evaluation.html');await page.waitForFunction(()=>window.calendarEvaluation);
    const results=await page.evaluate(async()=>{
      const {benchmarks,runtime,runModelAssistant,DEFAULT_PLANNING,diagnosticsReport}=window.calendarEvaluation;
      await runtime.checkLocalModel();
      const rules=await benchmarks.runAssistantBenchmark({mode:'rules',preset:'corpus',signal:new AbortController().signal});
      const controller=new AbortController();
      const stopped=await benchmarks.runAssistantBenchmark({mode:'rules',preset:'smoke',signal:controller.signal,onProgress:run=>{if(run.nextIndex===3)controller.abort();}});
      const resumed=await benchmarks.runAssistantBenchmark({mode:'rules',preset:'smoke',signal:new AbortController().signal,resume:stopped});
      const chat=await runModelAssistant('Możemy po prostu pogadać?',[],'en',new Date(2026,9,24,10),{},DEFAULT_PLANNING);
      return {rules,rulesSummary:benchmarks.summarizeBenchmarkRun(rules),stopped:{status:stopped.status,nextIndex:stopped.nextIndex},resumed:{status:resumed.status,count:resumed.results.length},chat:{text:chat.text,route:chat.route,language:chat.language,proposal:Boolean(chat.suggestedPlan)},diagnostics:diagnosticsReport()};
    });
    assert.equal(results.rules.status,'complete');assert.equal(results.rules.results.length,200);assert.equal(results.rulesSummary.actualModelCalls,0);assert.equal(results.stopped.status,'stopped');assert.equal(results.stopped.nextIndex,3);assert.equal(results.resumed.status,'complete');assert.equal(results.resumed.count,10);
    assert.equal(results.chat.route,'model');assert.equal(results.chat.language,'pl');assert.equal(results.chat.proposal,false);assert.ok(results.chat.text.length>0);
    assert.ok(results.diagnostics.metrics.some(m=>m.route==='model'&&m.completionTokens>0));assert.deepEqual(external,[]);
    writeFileSync(process.env.MULTIMODEL_BENCH_REPORT||'/workspace/artifacts/multimodel-benchmark-browser.json',JSON.stringify(results,null,2));
    console.log(JSON.stringify({rules:results.rulesSummary,chat:results.chat,stopped:results.stopped,resumed:results.resumed}));
  }finally{await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
