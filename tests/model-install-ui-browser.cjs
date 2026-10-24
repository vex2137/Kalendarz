// Real audited IQ4_XS bytes and actual native inference through production UI.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {existsSync,writeFileSync}=require('node:fs');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4188',id=process.env.MODEL_TEST_ID||'qwen3.5-0.8b-iq4-xs';
const quantization=id.endsWith('iq4-xs')?'IQ4_XS':'Q4_K_M';
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host=127.0.0.1','--port=4188','--strictPort',...(process.env.ASSISTANT_TEST_WEB_DIR?['--outDir',process.env.ASSISTANT_TEST_WEB_DIR]:[])],{stdio:'ignore'});
  let browser;const report={physicalDevice:false,environment:'Linux Chromium, production APK JavaScript, forced OPFS sync worker',modelId:id,passed:false};
  try{
    assert.ok(process.env.MODEL_IMPORT_FILE,'MODEL_IMPORT_FILE must point to the exact verified IQ4_XS');
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    const context=await browser.newContext({viewport:{width:393,height:851},serviceWorkers:'block'});
    await context.addInitScript(()=>Object.defineProperty(FileSystemFileHandle.prototype,'createWritable',{value:undefined,configurable:true}));
    const page=await context.newPage();page.setDefaultTimeout(900000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const open=async()=>{await page.locator('#btn-open-ai-assistant').click();await page.waitForFunction(()=>document.querySelector('#drawer-ai-assistant input[type=text]')?.disabled===false);};
    const settings=async()=>page.locator('#btn-ai-settings').click(),close=async()=>{await page.locator('#ai-settings-panel header button').click();await page.locator('#drawer-ai-assistant').waitFor();};
    const terminal=async()=>{await page.waitForFunction(()=>['installed','error','missing'].includes(document.querySelector('[data-testid=local-model-setup]')?.dataset.modelPhase));const phase=await page.locator('[data-testid=local-model-setup]').getAttribute('data-model-phase');if(phase!=='installed')throw new Error(await page.locator('#ai-settings-panel').innerText());};
    const diagnostics=async()=>{await settings();await page.locator('#ai-tab-diagnostics').click();const data=JSON.parse(await page.locator('#ai-diagnostics-report').textContent());await close();return data;};
    const send=async text=>{await page.locator('#drawer-ai-assistant input[type=text]').fill(text);await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]').disabled);const data=await diagnostics();assert.equal(data.lastTurn.route,'model');assert.equal(data.lastTurn.language,'en');assert.equal(data.lastModel.modelId,id);assert.ok(data.lastModel.completionTokens>0&&!data.lastModel.error);return {reply:await page.locator('#drawer-ai-assistant .rounded-tl-xs').last().innerText(),diagnostics:data};};
    await page.goto(base);await open();await settings();await page.locator('#ai-download-model').click();
    await page.getByRole('textbox',{name:'Hugging Face link'}).fill(`https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF/blob/main/Qwen3.5-0.8B.${quantization}.gguf`);
    await page.getByRole('button',{name:'Find models',exact:true}).click();
    assert.equal(await page.locator('[data-model-id]').count(),1);
    const row=page.locator(`[data-model-id="${id}"]`);
    await row.getByRole('button',{name:'Use model',exact:true}).click();
    await row.getByRole('button',{name:'Download',exact:true}).click();await terminal();
    report.downloaded=true;await close();
    // Block every external request after installation; inference must use disk.
    const unexpected=[];await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){unexpected.push(route.request().url());return route.abort();}return route.continue();});
    await page.locator('#drawer-ai-assistant input[type=text]').fill('Add event PendingProbe tomorrow at 18-20');
    await page.locator('#btn-send-ai-message').click();await page.waitForFunction(()=>!document.querySelector('#drawer-ai-assistant input[type=text]').disabled);
    assert.equal(await page.locator('[id^=btn-confirm-ai-event-]').count(),1,'A pending proposal must not capture the following ordinary conversation');
    report.downloadResponse=await send('Maybe it will be better in english');
    assert.equal(report.downloadResponse.diagnostics.lastModel.quantization,quantization);
    assert.equal(await page.getByTestId('model-header-name').innerText(),`Qwen3.5 0.8B ${quantization}`);
    await page.locator('#btn-close-ai-drawer').click();await open();
    await settings();await row.getByRole('button',{name:'Remove download',exact:true}).click();
    await page.getByLabel('Import GGUF',{exact:true}).setInputFiles({name:'wrong.gguf',mimeType:'application/octet-stream',buffer:Buffer.from('not a GGUF')});
    await page.getByRole('alert').filter({hasText:'does not match'}).waitFor();
    assert.equal(await page.locator('[data-testid=local-model-setup]').getAttribute('data-model-installed'),'false');report.incompatibleRejected=true;
    await page.getByLabel('Import GGUF',{exact:true}).setInputFiles(process.env.MODEL_IMPORT_FILE);await terminal();report.imported=true;
    await close();await page.reload();await open();
    report.importResponse=await send('What is two plus two? Answer briefly.');
    assert.equal(report.importResponse.diagnostics.runtime.installed,true);
    assert.equal(report.importResponse.diagnostics.runtime.loaded,true);
    await settings();await page.getByRole('button',{name:'Restore fallback model',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-testid=local-model-setup]')?.getAttribute('aria-label')==='LFM2.5 350M Q4_K_M');
    report.fallback=true;assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);report.passed=true;
    console.log(JSON.stringify({passed:true,modelId:id,downloaded:report.downloaded,imported:report.imported,incompatibleRejected:report.incompatibleRejected,fallback:report.fallback,sourceCommit:report.importResponse.diagnostics.build.commit,inferences:[report.downloadResponse,report.importResponse].map(result=>({reply:result.reply,model:result.diagnostics.lastModel,turn:result.diagnostics.lastTurn}))}));
  }catch(error){report.error=String(error);throw error;}
  finally{writeFileSync(process.env.MODEL_INSTALL_REPORT||'model-install-ui-results.json',JSON.stringify(report,null,2));await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
