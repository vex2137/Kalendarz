// Bounded native acceptance; the full two-model lifecycle report is archived.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {existsSync,writeFileSync}=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4189','--strictPort'],{stdio:'ignore'});
  let browser;const report={passed:false,environment:'Linux Chromium; real GGUF',physicalDevice:false,turns:[]};
  const deadline=setTimeout(()=>{console.error('Native release smoke exceeded 5 minutes');process.exit(1);},300000);
  try{
    for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4189')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
    await page.goto('http://127.0.0.1:4189/tests/model-evaluation.html');await page.waitForFunction(()=>window.calendarEvaluation);
    await page.evaluate(async()=>{const r=window.calendarEvaluation.runtime;await r.selectLocalModel('qwen3.5-0.8b-q4-k-m');await r.installLocalModel(await(await fetch('/candidate-lifecycle.gguf')).blob());if(!r.modelStatus().installed)throw new Error(JSON.stringify(r.modelStatus()));});
    await page.reload();await page.waitForFunction(()=>window.calendarEvaluation);
    report.turns=await page.evaluate(async()=>{
      const {runtime:r,diagnosticsReport}=window.calendarEvaluation,rows=[];
      const answer=async label=>{const text=await r.inferLocalText('Answer briefly.','What is two plus two?',[],{maxTokens:24,timeoutMs:90000});const metric=diagnosticsReport().metrics.filter(m=>m.route==='model').at(-1);if(!metric.completionTokens||!r.modelStatus().installed||!r.modelStatus().loaded)throw new Error(label+JSON.stringify(r.modelStatus()));rows.push({label,text,metric});};
      await answer('Q4 after browser reload');await r.unloadLocalModel();if(!r.modelStatus().installed||r.modelStatus().loaded)throw new Error('RAM release lost installation');
      await answer('Q4 reload from existing OPFS');await r.restoreFallbackModel();await answer('Bundled 350M');return rows;
    });
    assert.equal(report.turns[0].metric.modelId,'qwen3.5-0.8b-q4-k-m');assert.equal(report.turns[2].metric.modelId,'lfm2.5-350m-q4-k-m');report.passed=true;
    console.log(JSON.stringify(report));
  }catch(error){report.error=String(error);throw error;}
  finally{clearTimeout(deadline);writeFileSync('diagnostics-artifact/release-native-smoke.json',JSON.stringify(report,null,2));await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
