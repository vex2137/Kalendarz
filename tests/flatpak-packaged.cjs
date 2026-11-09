// Real installed Flatpak under D-Bus/Xvfb; do not launch the extracted host executable.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const APP='com.vex2137.kalendarz',pause=ms=>new Promise(r=>setTimeout(r,ms));
async function closeBrowser(browser){if(!browser)return;let timer;try{await Promise.race([browser.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('flatpak-test-browser-close-timeout')),15000)})]);}finally{clearTimeout(timer);}}
(async()=>{
 const out='part4-artifacts/flatpak';fs.mkdirSync(out,{recursive:true});const port=19676;let browser,child,acceptance;
 const marker=path.join(process.env.HOME,'calendar-host-private-marker');fs.writeFileSync(marker,'must not be readable inside the sandbox');
 execFileSync('flatpak',['run','--user','--command=sh',APP,'-c','test ! -e "$HOME/calendar-host-private-marker"']);
 try{
  child=spawn('flatpak',['run','--user',APP,...(process.env.CALENDAR_PART4_BETA_NUMBER==='3'?['--ignore-certificate-errors']:[]),'--remote-debugging-port='+port],{stdio:['ignore','pipe','pipe']});let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs=(logs+b).slice(-30000)});
  const end=Date.now()+90000;while(Date.now()<end){try{if((await fetch('http://127.0.0.1:'+port+'/json/version')).ok)break;}catch{}if(child.exitCode!==null)throw Error('Flatpak exited: '+logs);await pause(500);}
  browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const page=browser.contexts()[0].pages()[0];await page.locator('#btn-create-event-top').waitFor();
  if(process.env.CALENDAR_FLATPAK_REOPEN==='true')await page.getByText('Flatpak preserved event',{exact:true}).waitFor();
  else{await page.locator('#btn-create-event-top').click();await page.locator('#input-event-title').fill('Flatpak preserved event');await page.locator('#btn-save-event-form').click();await page.getByText('Flatpak preserved event',{exact:true}).waitFor();}
  await page.reload();await page.getByText('Flatpak preserved event',{exact:true}).waitFor();await page.locator('#btn-open-ai-assistant').click();
  const native=await page.evaluate(()=>window.calendarNativeAI.status());for(const backend of ['cpu-native','cuda','vulkan'])assert.ok(native.packagedBackends.includes(backend));
  await page.locator('#btn-ai-settings').click();await page.getByTestId('model-folders').waitFor();
  const data=await page.evaluate(()=>({origin:location.origin,crypto:!!crypto.subtle}));assert.equal(data.crypto,true);
  if(process.env.CALENDAR_PART4_BETA_NUMBER==='3' && process.env.CALENDAR_FLATPAK_REOPEN==='true'){
   const check=require('./default-model-package-check.cjs');
   if(process.env.CALENDAR_EXTERNAL_MODEL){
    // Input copied into the app's existing sandbox-owned XDG data; no filesystem grant.
    const directory=path.join(process.env.HOME,'.var/app',APP,'data/default-acceptance');fs.mkdirSync(directory,{recursive:true});acceptance=path.join(directory,'model.gguf');fs.copyFileSync(process.env.CALENDAR_EXTERNAL_MODEL,acceptance);
    console.log('Flatpak: starting real default model cycle in sandbox');const report=await check.cycle(page,acceptance);fs.writeFileSync(path.join(out,'default-model.json'),JSON.stringify(report,null,2));console.log(report);
   }else{const report=await check.infer(page);fs.writeFileSync(path.join(out,'default-model-restart.json'),JSON.stringify(report,null,2));console.log('PASS managed default model after actual Flatpak restart/update',report);}
  }
  const result={source:process.env.CALENDAR_EXPECTED_COMMIT,startup:'PASS installed Flatpak via Zypak in sandbox',calendar:'PASS event write, reload and native AI bridge',hostFilesystem:'PASS ungranted home marker denied',restart:process.env.CALENDAR_FLATPAK_REOPEN==='true'?'PASS preserved data after update':'pending update',portalFileChooser:'NOT TESTED: requires manual portal selection',physicalGpu:'NOT TESTED',packagedBackends:native.packagedBackends};fs.writeFileSync(path.join(out,'flatpak-smoke.json'),JSON.stringify(result,null,2));console.log(result);
  await page.evaluate(()=>window.close()).catch(e=>{if(!/closed|destroyed/i.test(e.message))throw e;});console.log('Flatpak: closing verified application');await closeBrowser(browser);browser=undefined;
  await Promise.race([new Promise(r=>child.once('exit',r)),pause(15000)]);if(child.exitCode===null)throw Error('Flatpak failed to close');
 }catch(error){console.error('Flatpak test failed:',error);throw error;}
 finally{try{await closeBrowser(browser);}catch(error){console.error('Flatpak cleanup:',error);}if(child&&child.exitCode===null){execFileSync('flatpak',['kill',APP],{stdio:'ignore'});child.kill();}fs.rmSync(marker,{force:true});if(acceptance)fs.rmSync(acceptance,{force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
