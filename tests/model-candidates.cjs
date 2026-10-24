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
    const external=[];
    await context.route('**/*', route => { if(new URL(route.request().url()).origin!==base) { external.push(route.request().url());return route.abort(); } return route.continue(); });
    const page=await context.newPage();
    page.setDefaultTimeout(900000);
    await page.goto(base+'/tests/model-evaluation.html');
    await page.waitForFunction(()=>window.calendarEvaluation);
    report=await page.evaluate(async id => {
      const {runtime,diagnosticsReport}=window.calendarEvaluation;
      await runtime.selectLocalModel(id);
      const file=await (await fetch('/benchmark-model.gguf')).blob();
      await runtime.installLocalModel(file);
      if(!runtime.modelStatus().installed) throw new Error('Candidate installation failed: '+JSON.stringify({status:runtime.modelStatus(),storage:await navigator.storage.estimate()}));
      const cold=await runtime.inferLocalText('Answer the user briefly in their language.','Ile to jest dwa plus dwa? Odpowiedz samą liczbą.',[],{maxTokens:32,timeoutMs:600000});
      const warm=await runtime.inferLocalText('Answer the user briefly in their language.','What is two plus two? Answer with the number only.',[],{maxTokens:32,timeoutMs:600000});
      const command=await runtime.inferCalendarJson('Extract a JSON calendar command.','Add event Test tomorrow at 14:00',{type:'object',properties:{action:{const:'create'},title:{type:'string'}},required:['action','title'],additionalProperties:false},[],{maxTokens:64,timeoutMs:600000});
      const diagnostics=diagnosticsReport();
      await runtime.unloadLocalModel();
      return {id,status:'passed',platform:'cloud-chromium',physicalDevice:false,cold,warm,command,diagnostics};
    },id);
    report.quality = { polishArithmetic: /4/u.test(report.cold), englishArithmetic: /4/u.test(report.warm) };
    assert.ok(report.cold.length>0 && report.warm.length>0, 'Raw generation must return actual output');
    assert.equal(JSON.parse(report.command).action,'create');
    const inferences=report.diagnostics.metrics.filter(x=>x.route==='model'&&!x.error);
    assert.equal(inferences.length,3); assert.ok(inferences.every(m=>m.modelId===id&&m.completionTokens>0));
    assert.deepEqual(external,[]);
    console.log(JSON.stringify(report));
  } catch(error) { report.status='failed'; report.error=String(error); console.error(error); process.exitCode=1; }
  finally { writeFileSync(process.env.CANDIDATE_REPORT||'candidate-results.json',JSON.stringify(report,null,2)); await browser?.close();server.kill('SIGTERM');rmSync(profile,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
