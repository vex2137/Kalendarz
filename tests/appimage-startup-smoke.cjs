// Smoke the actual extracted package; no GGUF download or GPU inference claim.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{_electron}=require('playwright');
(async()=>{
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-actions-smoke-'));let application;
 try{
  application=await _electron.launch({executablePath:path.resolve('build/checked-appimage/squashfs-root/calendar'),env:{...process.env,XDG_CONFIG_HOME:profile,XDG_CACHE_HOME:path.join(profile,'cache')},args:['--no-sandbox','--disable-gpu','--user-data-dir='+path.join(profile,'data')],timeout:30000});
  const page=await application.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.locator('#btn-create-event-top').waitFor();
  await page.locator('#btn-view-month').click();assert.ok((await page.locator('main').innerText()).length);
  const native=await page.evaluate(()=>window.calendarNativeAI.status());
  for(const name of ['cpu-native','cuda','vulkan'])assert.ok(native.packagedBackends.includes(name));
  assert.ok(Array.isArray(native.nativeAttempts),'The packaged native bridge must contain the new startup diagnostics');
  await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();
  const context=page.locator('[data-testid=model-context-settings]:visible');await context.getByRole('slider').waitFor();assert.equal(await context.getByRole('spinbutton').count(),1);
  const rows=page.locator('[data-model-id]:visible');assert.ok(await rows.count());
  assert.deepEqual(errors,[]);
  const result={smoke:'PASS actual package startup, month, context/model controls, nativeAttempts bridge and shutdown',packagedBackends:native.packagedBackends,gpuActive:native.gpuActive,physicalGpuVerified:false};
  fs.writeFileSync('manual-test-assets/appimage/smoke-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await application?.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
