// Real GGUF only. The first-load race is deliberately ordered; timers advance
// only for the idle policy, and those measurements are excluded from comparisons.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {existsSync,writeFileSync}=require('node:fs');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4189',id=process.env.CANDIDATE_MODEL_ID;
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4189','--strictPort'],{stdio:'ignore'});
  let browser;const report={id,physicalDevice:false,environment:'Linux Chromium',passed:false};
  try{
    assert.ok(id);
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    const context=await browser.newContext({serviceWorkers:'block'}),external=[],errors=[];
    await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){external.push(route.request().url());return route.abort();}return route.continue();});
    const page=await context.newPage();page.setDefaultTimeout(900000);page.on('pageerror',error=>errors.push(error.message));
    const open=async()=>{await page.goto(base+'/tests/model-evaluation.html');await page.waitForFunction(()=>window.calendarEvaluation);};
    await open();
    await page.evaluate(async id=>{const r=window.calendarEvaluation.runtime;await r.selectLocalModel(id);await r.installLocalModel(await(await fetch('/candidate-lifecycle.gguf')).blob());if(!r.modelStatus().installed)throw new Error(JSON.stringify(r.modelStatus()));},id);
    await page.reload();await page.waitForFunction(()=>window.calendarEvaluation);
    report.lifecycle=await page.evaluate(async id=>{
      const {runtime:r,diagnosticsReport,registry}=window.calendarEvaluation,states=[];
      const check=(label,loaded)=>{const s=r.modelStatus();if(s.modelId!==id||!s.installed||s.loaded!==loaded)throw new Error(label+': '+JSON.stringify(s));states.push({label,...s});};
      const text=async query=>{const answer=await r.inferLocalText('Reply briefly in the user\'s language. Do not claim to save calendar changes.',query,[],{maxTokens:64});const metric=diagnosticsReport().metrics.filter(m=>m.route==='model').at(-1);if(metric.modelId!==r.modelStatus().modelId||!metric.completionTokens)throw new Error('No genuine selected-model output');return {query,answer,metric};};
      // Hold only the initial disk check. Foreground inference overtakes it.
      const getDirectory=navigator.storage.getDirectory.bind(navigator.storage);let release,entered=false;
      const held=new Promise(resolve=>release=resolve);let first=true;
      navigator.storage.getDirectory=async()=>{if(first){first=false;entered=true;await held;}return getDirectory();};
      const checking=r.checkLocalModel();while(!entered)await new Promise(resolve=>setTimeout(resolve,5));
      const inference=text('Can we just have a chat?');release();const cold=await inference;await checking;navigator.storage.getDirectory=getDirectory;
      check('foreground overtakes storage check',true);
      const warm=await text('What is two plus two?');check('warm generation',true);
      await r.unloadLocalModel();check('RAM release keeps installation',false);
      const reloaded=await text('Cześć, co tam?');check('reload without download',true);
      const cancelled=r.inferLocalText('Write a long story.','Tell a detailed story about a clock.',[],{maxTokens:256});
      while(r.modelStatus().phase!=='running')await new Promise(resolve=>setTimeout(resolve,5));r.cancelModelOperation();
      let cancellation;try{await cancelled;throw new Error('Cancellation was ignored');}catch(error){cancellation=error.message;if(cancellation!=='model-cancelled')throw error;}
      check('cancel keeps installation',false);
      // Retain the OPFS file but lose its IndexedDB registration, as after a
      // metadata inconsistency. Loading must repair it without HTTP or deletion.
      await new Promise((resolve,reject)=>{const open=indexedDB.open('calendar-local-model');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('models','readwrite');tx.objectStore('models').delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
      const repaired=await text('Answer briefly: what is two plus two?');check('verified OPFS metadata recovery',true);
      const switches=[];
      for(let i=0;i<2;i++){
        await r.restoreFallbackModel();if(r.modelStatus().loaded)throw new Error('Previous engine was not released');
        if(i===0)switches.push({fallback:await text('What is two plus two?')});else await r.prepareLocalModel();
        await r.selectLocalModel(id);check('switch back '+i,false);switches.push({candidate:await text('Can you speak English?')});check('candidate after switch '+i,true);
      }
      return {states,cold,warm,reloaded,repaired,switches,cancellation,selected:registry.activeModel().id};
    },id);
    assert.equal(report.lifecycle.selected,id);
    assert.equal(report.lifecycle.cold.metric.engineStateAtStart,'unloaded');
    assert.equal(report.lifecycle.warm.metric.engineStateAtStart,'loaded');
    assert.equal(report.lifecycle.reloaded.metric.engineStateAtStart,'unloaded');
    // A small frozen PL/EN subset compares rules, native JSON extraction and the
    // actual assistant. It is not a new 200-input benchmark or a semantic score.
    report.quality=await page.evaluate(async()=>{
      const h=window.calendarEvaluation,r=h.runtime,now=new Date(h.benchmarks.BENCHMARK_REFERENCE),results=[];
      for(const item of h.benchmarks.BILINGUAL_CASES.filter(c=>['001','009','016'].includes(c.id)))for(const language of ['pl','en']){
        const query=item[language];
        for(const mode of ['rules','llm','assistant']){
          const row={caseId:item.id,language,query,mode,manualSemanticReviewRequired:true};
          try{
            if(mode==='rules'){
              const quick=await h.assistantQuickReply(query,[],language,now,h.DEFAULT_PLANNING),parsed=h.parseCalendarCommand(query,language,now);
              row.route=quick?'quick':parsed?'rules':'unrouted';row.response=quick?.text;row.command=parsed?.command;
            }else if(mode==='llm'){
              row.route='model';row.raw=await r.inferCalendarJson(h.assistantSystemPrompt(language,now),query,h.ASSISTANT_SCHEMA,[],{maxTokens:256});row.command=h.parseModelCommand(row.raw);row.response=row.command.reply;
            }else{
              const response=await h.runModelAssistant(query,[],language==='pl'?'en':'pl',now,{},h.DEFAULT_PLANNING);
              row.route=response.route;row.response=response.text;
              const event=response.suggestedPlan?.events[0];row.command=event?{action:'create',title:event.title,date:event.startDate,time:event.startTime,endTime:event.endTime,allDay:event.allDay}:response.route==='model'?{action:'chat',reply:response.text}:undefined;
            }
            row.checks=h.benchmarks.scoreBenchmarkCommand(item.id,item.action,row.command,language);
            if(row.route==='model')row.metric=h.diagnosticsReport().metrics.filter(m=>m.route==='model').at(-1);
          }catch(error){row.error=String(error);}
          results.push(row);
        }
      }
      return results;
    });
    if(id==='qwen3.5-0.8b-q4-k-m'){
      await page.evaluate(()=>localStorage.removeItem('calendar_active_ai_model_v1'));
      await page.reload();await page.waitForFunction(()=>window.calendarEvaluation);
      report.autoPreferred=await page.evaluate(async()=>{const h=window.calendarEvaluation;await h.runtime.checkLocalModel();return h.runtime.modelStatus().modelId===h.registry.PREFERRED_MODEL.id&&h.runtime.modelStatus().installed;});
      assert.equal(report.autoPreferred,true,'Installed Q4 is preferred only without a saved manual choice');
    }
    await page.evaluate(()=>window.calendarEvaluation.runtime.restoreFallbackModel());
    await page.reload();await page.waitForFunction(()=>window.calendarEvaluation);
    report.explicitFallback=await page.evaluate(async()=>{const h=window.calendarEvaluation;await h.runtime.checkLocalModel();return h.runtime.modelStatus().modelId===h.registry.DEFAULT_MODEL.id;});
    assert.equal(report.explicitFallback,true,'An explicit fallback choice must survive restart');
    await page.evaluate(id=>window.calendarEvaluation.runtime.selectLocalModel(id),id);
    await page.reload();await page.waitForFunction(()=>window.calendarEvaluation);
    await page.evaluate(async id=>{const r=window.calendarEvaluation.runtime;await r.checkLocalModel();if(r.modelStatus().modelId!==id||!r.modelStatus().installed||r.modelStatus().loaded)throw new Error('Restart lost installation/selection');r.setAssistantActive(true);await r.prepareLocalModel();},id);
    await page.clock.install();await page.evaluate(()=>window.calendarEvaluation.runtime.setAssistantActive(false));await page.clock.fastForward(30001);await page.clock.resume();
    await page.waitForFunction(()=>!window.calendarEvaluation.runtime.modelStatus().loaded);
    report.idleAndResume=await page.evaluate(async id=>{
      const r=window.calendarEvaluation.runtime;
      if(!r.modelStatus().installed)throw new Error('Idle release lost installation');
      Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document,'hidden',{value:false,configurable:true});r.setAssistantActive(true);window.dispatchEvent(new Event('calendar-app-resume'));
      await r.prepareLocalModel();
      if(!r.modelStatus().loaded||r.modelStatus().modelId!==id)throw new Error('Foreground resume did not reload the installed model');
      window.dispatchEvent(new Event('calendar-memory-pressure'));
      for(let i=0;r.modelStatus().loaded&&i<200;i++)await new Promise(resolve=>setTimeout(resolve,20));
      if(r.modelStatus().loaded||!r.modelStatus().installed)throw new Error('Memory pressure lost installation');
      return {passed:true,state:r.modelStatus(),clockControlled:true};
    },id);
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);report.passed=true;
    console.log(JSON.stringify({id,passed:true,lifecycle:report.lifecycle.states,quality:report.quality.map(row=>({caseId:row.caseId,language:row.language,mode:row.mode,route:row.route,response:row.response,command:row.command,error:row.error,checks:row.checks})),native:report.lifecycle.warm.metric}));
  }catch(error){report.error=String(error);throw error;}
  finally{writeFileSync(process.env.LIFECYCLE_REPORT||'model-lifecycle-results.json',JSON.stringify(report,null,2));await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
