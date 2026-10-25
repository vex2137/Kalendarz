// Browser interaction and native-boundary fault injection; no physical GPU claim.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4197','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4197')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});
  for(const touch of [false,true]){
   const context=await browser.newContext({serviceWorkers:'block',hasTouch:touch,viewport:{width:touch?412:1280,height:915}});
   await context.addInitScript(()=>{
    window.__mode={mode:'auto',layers:999,loaded:false,prepares:0,stops:0,fail:false,hold:true};
    const state=()=>({backend:window.__mode.mode==='gpu'?'vulkan':'cpu-native',mode:window.__mode.mode,gpuLayers:window.__mode.layers,loaded:window.__mode.loaded,gpuActive:false,available:true});
    window.calendarNativeAI={platform:'android',status:async()=>state(),info:async()=>({installed:true}),folders:async()=>({models:[],folders:[],warnings:[]}),
     setMode:async(mode,layers=999)=>{if(window.__mode.fail){window.__mode.fail=false;throw Error('model-stop-timeout');}if(window.__mode.loaded)throw Error('model-before-stop');window.__mode.mode=mode;window.__mode.layers=layers;return state();},
     prepare:async()=>{window.__mode.prepares++;if(window.__mode.hold)await new Promise(resolve=>window.__finishLoad=resolve);window.__mode.loaded=true;return state();},
     stop:async()=>{window.__mode.stops++;window.__mode.loaded=false;window.__finishLoad?.();window.__mode.hold=false;await new Promise(r=>setTimeout(r,30));window.__mode.loaded=false;},
    };
    function assertUnloaded(){if(window.__mode.loaded)throw Error('mode-before-stop');}
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4197');
   const press=locator=>touch?locator.tap():locator.click();
   await press(page.locator('#btn-open-ai-assistant'));await page.waitForFunction(()=>window.__mode.prepares>0);
   await press(page.locator('#btn-ai-settings'));
   const panel=page.locator('[data-testid=backend-settings]:visible'),result=panel.getByTestId('backend-mode-result');
   // Selection must stay available while automatic preloading is in progress.
   await press(panel.locator('[data-mode="cpu"]'));await result.filter({hasText:'Mode saved'}).waitFor({timeout:8000}).catch(async error=>{console.error(await panel.innerText(),await page.evaluate(async()=>({bridge:window.__mode,actions:(await import('/src/utils/modelDiagnostics.ts')).diagnosticActions()})));throw error;});
   assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_backend_mode_v1')),'cpu');
   assert.equal(await panel.locator('[data-mode="cpu"]').getAttribute('aria-pressed'),'true');
   assert.equal(await page.evaluate(()=>window.__mode.loaded),false);
   const prepares=await page.evaluate(()=>window.__mode.prepares);
   await page.evaluate(()=>window.dispatchEvent(new Event('calendar-app-resume')));await page.waitForTimeout(450);
   assert.equal(await page.evaluate(()=>window.__mode.prepares),prepares,'No mode-change preload loop');
   await panel.locator('input[type=number]').fill('8');await press(panel.getByRole('button',{name:'Apply layer limit',exact:true}));
   await page.waitForFunction(()=>window.__mode.layers===8);
   await press(panel.locator('[data-mode="gpu"]'));await page.waitForFunction(()=>window.__mode.mode==='gpu');
   assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_gpu_layers_v1')),'8');
   await page.reload();await press(page.locator('#btn-open-ai-assistant'));await press(page.locator('#btn-ai-settings'));
   await page.waitForFunction(()=>window.__mode.mode==='gpu'&&window.__mode.layers===8);
   assert.equal(await panel.locator('[data-mode="gpu"]').getAttribute('aria-pressed'),'true');
   // A rejected bridge acknowledgement rolls back persistence and selection.
   await page.evaluate(()=>window.__mode.fail=true);await press(panel.locator('[data-mode="cpu"]'));
   await result.filter({hasText:'model-stop-timeout'}).waitFor();assert.equal(await result.getAttribute('role'),'alert');
   assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_backend_mode_v1')),'gpu');
   await press(panel.locator('[data-mode="auto"]'));await page.waitForFunction(()=>window.__mode.mode==='auto');
   // Invalid offload values must never enter the bridge or persistent settings.
   await panel.locator('input[type=number]').fill('0');await press(panel.getByRole('button',{name:'Apply layer limit',exact:true}));await result.filter({hasText:'model-input'}).waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_gpu_layers_v1')),'8');
   await press(panel.locator('[data-mode=cpu]'));await page.waitForFunction(()=>window.__mode.mode==='cpu');
   assert.deepEqual(errors,[]);await context.close();
  }
  const web=await browser.newContext({serviceWorkers:'block'}),page=await web.newPage();await page.goto('http://127.0.0.1:4197');
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  const panel=page.locator('[data-testid=backend-settings]:visible');
  // Establish an explicitly saved baseline through the real UI. A rejected GPU
  // selection must preserve that exact persisted policy.
  await panel.locator('[data-mode=auto]').click();await panel.getByTestId('backend-mode-result').filter({hasText:'Mode saved'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_backend_mode_v1')),'auto');
  await panel.locator('[data-mode=gpu]').click();
  await panel.getByTestId('backend-mode-result').filter({hasText:'model-gpu-unavailable'}).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_ai_backend_mode_v1')),'auto');
  await panel.locator('[data-mode=cpu]').click();await panel.getByTestId('backend-mode-result').filter({hasText:'Mode saved'}).waitFor();await web.close();
  console.log('PASS mouse + touch: selection during preload, awaited unload, mode/layer persistence, restart synchronization, visible success/errors, rollback and no reload loop. Mock native boundary only.');
 }finally{await browser?.close();server.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
