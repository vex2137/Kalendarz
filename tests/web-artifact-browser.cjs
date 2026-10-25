// Exercise only shipped production files through UI; no source-module imports,
// native bridge mocks, remote weights, or claims of hardware GPU acceleration.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs/promises'),{createReadStream,existsSync}=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(process.env.CALENDAR_WEB_DIR||'dist'),model=process.env.CALENDAR_MODEL_FILE;assert.ok(model&&existsSync(model),'Set CALENDAR_MODEL_FILE to a real LFM2.5 350M Q4_K_M');
 const build=JSON.parse(await fs.readFile(path.join(root,'build-info.json'),'utf8'));assert.equal(build.version,'1.4.1');assert.equal(build.androidNative,false);assert.equal(build.bundledModel,false);assert.equal(build.dirty,false);
 const server=http.createServer(async(request,response)=>{try{
  const url=new URL(request.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))throw Error('path');const stat=await fs.stat(file);if(!stat.isFile())throw Error('file');
  const ext=path.extname(file),mime={'.js':'application/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.html':'text/html','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png'}[ext]||'application/octet-stream';
  response.writeHead(200,{'Content-Type':mime,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cache-Control':'no-cache'});createReadStream(file).pipe(response);
 }catch{response.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(180000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
  await page.locator('#btn-create-event-top').click();await page.locator('#input-event-title').fill('Web artifact retention fixture');await page.locator('#btn-save-event-form').click();
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();const chooser=page.waitForEvent('filechooser');await page.locator('#ai-import-gguf').click();await(await chooser).setFiles(model);await page.locator('[data-model-installed=true]').waitFor();
  await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').click();await page.locator('[data-testid=backend-mode-result]:visible').filter({hasText:'Mode saved'}).waitFor();await page.locator('#ai-settings-panel header button').click();
  const metrics=await require('./model-device-check.cjs')(page,'en').catch(async error=>{console.error('Production diagnostic snapshot:',await page.locator('#ai-diagnostics-report').innerText());throw error;});for(const metric of metrics){assert.equal(metric.backend,'cpu-wasm');assert.ok(metric.completionTokens>0);}
  await page.locator('#btn-ai-settings').click();await page.locator('#ai-tab-diagnostics').click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).click();const download=await downloaded,report=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(report.build.androidNative,false);assert.equal(report.backend.backend,'cpu-wasm');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));await page.reload();await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));await context.setOffline(true);await page.reload();await page.getByText('Web artifact retention fixture',{exact:true}).waitFor();
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();await page.locator('[data-model-installed=true]').waitFor();assert.equal(await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);
  const evidence={version:build.version,commit:build.commit,productionFilesOnly:true,actualGguf:true,metrics,offlineReload:true,modelAndSettingsRetained:true,physicalGpu:false,passed:true};if(process.env.CALENDAR_WEB_REPORT)await fs.writeFile(process.env.CALENDAR_WEB_REPORT,JSON.stringify(evidence,null,2)+'\n');console.log('PASS production Web files: isolated startup, real GGUF import, cold/warm WASM CPU, JSON export, service worker/offline reload, event/model/mode persistence.');await context.close();
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
