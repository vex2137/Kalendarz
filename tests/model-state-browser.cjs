// Production model UI and real OPFS/IndexedDB state transitions. Synthetic GGUF
// metadata contains no usable tensors; this is not inference or GPU evidence.
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{existsSync}=require('node:fs'),{chromium}=require('playwright');
const base='http://127.0.0.1:4197';
const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;},u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},str=s=>Buffer.concat([u64(Buffer.byteLength(s)),Buffer.from(s)]);
function fixture(quant){const fields=[['general.architecture','qwen35'],['general.name','State regression fixture'],['general.file_type',quant],['qwen35.context_length',2048]];return Buffer.concat([Buffer.from('GGUF'),u32(3),u64(1),u64(fields.length),...fields.flatMap(([k,v])=>[str(k),u32(typeof v==='string'?8:4),typeof v==='string'?str(v):u32(v)]),Buffer.alloc(1024)]);}
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4197','--strictPort'],{stdio:'ignore',env:{...process.env,CALENDAR_MODEL_FREE:'true',CALENDAR_ANDROID_NATIVE:'false'}});let browser;
  try{
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    const page=await browser.newPage({serviceWorkers:'block'});const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.evaluate(async()=>{window.__runtime=await import('/src/utils/localModelRuntime.ts');window.__registry=await import('/src/utils/modelRegistry.ts');window.__store=await import('/src/utils/localModelStore.ts');await window.__runtime.checkLocalModel();localStorage.setItem('model-state-retained-data','retained');});
    const open=async()=>{await page.locator('#btn-open-ai-assistant').click();await page.locator('#btn-ai-settings').click();};
    await open();
    const preferred=await page.evaluate(()=>window.__registry.DEFAULT_MODEL.id),row=id=>page.locator(`[data-model-id="${id}"]`);
    await row(preferred).getByTestId('catalogue-model-status').filter({hasText:'Available in catalogue'}).waitFor();
    assert.equal(await row(preferred).getAttribute('data-model-selected'),'true');
    assert.equal(await row(preferred).getAttribute('data-model-installation'),'missing');
    await row(preferred).getByRole('button',{name:'Download',exact:true}).waitFor();
    assert.equal(await row(preferred).getByRole('button',{name:'Download',exact:true}).isEnabled(),true,'Missing default Qwen must offer the existing download action');
    assert.equal(await page.getByTestId('model-in-use').count(),0,'A selected missing model cannot be in use');
    assert.ok((await page.getByTestId('active-model-card').innerText()).includes('Selected model'));
    // A genuine catalogue URL must reach the standard downloader; an HTTP failure
    // must not turn a saved preference into an installed/verified model.
    const qwenUrl=await page.evaluate(()=>window.__registry.DEFAULT_MODEL.url);let qwenRequests=0;
    await page.route(qwenUrl,route=>{qwenRequests++;return route.fulfill({status:503,body:'Synthetic catalogue download failure'});});
    await row(preferred).getByRole('button',{name:'Download',exact:true}).click();
    await page.waitForFunction(()=>window.__runtime.modelStatus().phase==='error'&&window.__runtime.modelStatus().error==='model-http-503');
    assert.equal(qwenRequests,1,'Default Qwen uses its configured URL and existing downloader');
    assert.equal(await page.evaluate(()=>window.__runtime.modelStatus().installed),false);
    assert.equal(await row(preferred).getByTestId('model-in-use').count(),0);

    const ids=[];
    for(const quant of [15,30]){
      await page.getByLabel('Import GGUF',{exact:true}).setInputFiles({name:`state-${quant}.gguf`,mimeType:'application/octet-stream',buffer:fixture(quant)});
      await page.waitForFunction(()=>window.__runtime.modelStatus().phase==='installed'&&window.__runtime.modelStatus().modelId.startsWith('imported-'));
      const id=await page.evaluate(()=>window.__runtime.modelStatus().modelId);ids.push(id);
      await row(id).getByTestId('catalogue-model-status').filter({hasText:'Installed and verified'}).waitFor();
      assert.equal(await row(id).getAttribute('data-model-loaded'),'false');
      assert.equal(await row(id).getByTestId('model-in-use').count(),0,'Verified on disk is independent of engine residency');
    }
    await row(ids[0]).getByRole('button',{name:'Use model',exact:true}).waitFor();
    // A legacy record is readable but does not inherit a checksum guarantee just
    // from its size. Keep it inactive so automatic checking cannot hide the state.
    await page.evaluate(async id=>{
      const d=window.__registry.findModel(id),blob=await window.__store.savedModel(d);
      const request=indexedDB.open('calendar-local-model');await new Promise((resolve,reject)=>{request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('models','readwrite');tx.objectStore('models').put(blob,id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
      await window.__runtime.selectLocalModel(window.__registry.DEFAULT_MODEL.id);
    },ids[0]);
    await row(ids[0]).getByTestId('catalogue-model-status').filter({hasText:'Complete — verification required'}).waitFor();
    assert.equal(await row(ids[0]).getByRole('button',{name:'Use model',exact:true}).count(),0);
    await row(ids[0]).getByRole('button',{name:'Verify model',exact:true}).waitFor();
    // A durable Range checkpoint is partial, not installed, selected or used.
    const partial=await page.evaluate(async()=>{
      const d=window.__registry.OPTIONAL_FALLBACK,{transferName}=await import('/src/utils/resumableModelTransfer.ts');
      const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models',{create:true}),key=transferName(d);
      const writer=await(await dir.getFileHandle(key+'.gguf',{create:true})).createWritable();await writer.write(new Uint8Array(64));await writer.close();
      await window.__runtime.selectLocalModel(d.id);return d.id;
    });
    await row(partial).getByTestId('catalogue-model-status').filter({hasText:'Partly downloaded'}).waitFor();
    await row(partial).getByRole('button',{name:'Resume download',exact:true}).waitFor();
    assert.equal(await row(partial).getByRole('button',{name:'Use model',exact:true}).count(),0);
    assert.equal(await row(partial).getByTestId('model-in-use').count(),0);
    await page.locator('#ai-settings-panel header button').click();await page.locator('#btn-close-ai-drawer').click();await page.locator('#btn-view-week').click();await open();
    await row(partial).getByRole('button',{name:'Resume download',exact:true}).waitFor();
    assert.equal(await row(partial).getAttribute('data-model-installation'),'partial');
    // Native info without explicit verification never upgrades mere bytes to a
    // verified install. This branch exercises the real shared state reader.
    const native=await page.evaluate(async()=>{
      const d=window.__registry.OPTIONAL_FALLBACK,previous=window.calendarNativeAI;try{
        window.calendarNativeAI={info:async()=>({installed:true,bytes:d.bytes,verified:false})};
        const unverified=await window.__store.modelInstallationState(d);
        window.calendarNativeAI.info=async()=>({installed:true,bytes:d.bytes,verified:true});
        return {unverified,verified:await window.__store.modelInstallationState(d)};
      }finally{window.calendarNativeAI=previous;}
    });
    assert.equal(native.unverified.state,'unverified');assert.equal(native.verified.state,'verified');
    const legacy=await page.evaluate(async id=>{
      const d=window.__registry.findModel(id),store=window.__store,blob=await store.savedModel(d);
      const before=await store.modelInstallationState(d);
      await store.verifyModel(blob,undefined,undefined,d);
      if(!await store.markModelVerified(d,blob))throw Error('Legacy source lost verification identity');
      const after=await store.modelInstallationState(d);
      // Replace the raw record with different same-size bytes after the old Blob
      // was verified. Its late receipt must never bless the new record.
      const replacement=new Blob([new Uint8Array(blob.size)]);
      const put=value=>new Promise((resolve,reject)=>{const request=indexedDB.open('calendar-local-model');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('models','readwrite');tx.objectStore('models').put(value,id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
      const persisted=await store.savedModel(d),hashBefore=await store.modelChecksum(persisted);
      await put(replacement);let stale;
      try{await store.markModelVerified(d,persisted);throw Error('Stale checksum accepted');}catch(error){stale=error.message;}
      const afterReplacement=await store.modelInstallationState(d),retained=await store.savedModel(d);
      await store.verifyModel(blob,undefined,undefined,d);
      await put(blob);const restored=await store.savedModel(d);await store.verifyModel(restored,undefined,undefined,d);await store.markModelVerified(d,restored);
      return {before,after,stale,afterReplacement,retainedSize:retained.size,hashBefore,hashAfter:await store.modelChecksum(await store.savedModel(d)),bytes:blob.size};
    },ids[0]);
    assert.equal(legacy.before.state,'unverified');assert.equal(legacy.after.state,'verified');assert.equal(legacy.stale,'model-storage');assert.equal(legacy.afterReplacement.state,'unverified');assert.equal(legacy.retainedSize,legacy.bytes);assert.equal(legacy.hashAfter,legacy.hashBefore);
    const opfs=await page.evaluate(async id=>{
      const d=window.__registry.findModel(id),store=window.__store;
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('calendar-local-model');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const get=()=>new Promise((resolve,reject)=>{const request=db.transaction('models').objectStore('models').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const put=value=>new Promise((resolve,reject)=>{const tx=db.transaction('models','readwrite');tx.objectStore('models').put(value,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
      try{
        const original=await get();if(!original.opfsName)throw Error('Expected real OPFS registration');
        await put({opfsName:original.opfsName});const before=await store.modelInstallationState(d);
        const blob=await store.savedModel(d);await store.verifyModel(blob,undefined,undefined,d);
        await store.markModelVerified(d,blob);const after=await store.modelInstallationState(d);
        await put({opfsName:'another-registration.gguf'});let stale;
        try{await store.markModelVerified(d,blob);throw Error('Stale OPFS receipt accepted');}catch(error){stale=error.message;}
        await put(original);const restored=await store.savedModel(d);await store.verifyModel(restored,undefined,undefined,d);
        return {before,after,stale,sameBytes:restored.size===blob.size};
      }finally{db.close();}
    },ids[1]);
    assert.equal(opfs.before.state,'unverified');assert.equal(opfs.after.state,'verified');assert.equal(opfs.stale,'model-storage');assert.equal(opfs.sameBytes,true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('model-state-retained-data')),'retained');
    assert.equal(await page.evaluate(()=>localStorage.getItem('calendar_active_ai_model_v1')),partial);
    assert.deepEqual(errors,[]);
    console.log('PASS model states UI: selected missing, verified unloaded, inactive Use action, legacy unverified, durable partial + resume, navigation return, explicit native verification, atomic Blob/OPFS legacy receipts and stale replacement rejection and retained preferences. No inference claimed.');
  }finally{await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
