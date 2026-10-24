// Synthetic bytes test disk transactions/failures only, never GGUF compatibility.
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {existsSync}=require('node:fs');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4187';
(async()=>{
  const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4187','--strictPort'],{stdio:'ignore'});
  let browser;
  try{
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
    for(const workerOnly of [false,true]){
      const context=await browser.newContext({serviceWorkers:'block'});const page=await context.newPage();
      await page.goto(base);
      const result=await page.evaluate(async workerOnly=>{
        if(workerOnly)Object.defineProperty(FileSystemFileHandle.prototype,'createWritable',{value:undefined,configurable:true});
        const store=await import('/src/utils/localModelStore.ts');
        const bytes=new Uint8Array(256*1024).map((_,i)=>i%251);
        const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
        const descriptor={id:'storage-probe',bytes:bytes.length,sha256,url:location.origin+'/storage-probe.gguf'};
        const actualFetch=window.fetch;
        window.fetch=async()=>new Response(bytes);
        const signal=new AbortController().signal;
        let blob=await store.downloadModel(signal,()=>{},descriptor);await store.verifyModel(blob,signal,undefined,descriptor);await store.saveModel(blob,signal,descriptor);
        if(!(await store.savedModel(descriptor)))throw new Error('Disk-backed download was not committed');
        // Lose only the registry entry: recovery must adopt the verified OPFS file.
        await new Promise((resolve,reject)=>{const open=indexedDB.open('calendar-local-model');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('models','readwrite');tx.objectStore('models').delete(descriptor.id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});
        if(await store.hasDownloadedModelData(descriptor))throw new Error('Missing metadata was hidden');
        if(!(await store.recoverSavedModel(descriptor)))throw new Error('Verified orphan was not recovered');
        if(!(await store.savedModel(descriptor)))throw new Error('Recovered metadata was not durable');
        await store.removeSavedModel(descriptor);
        // System-picked File follows the same import path, including worker OPFS.
        blob=new File([bytes],'storage-probe.gguf');await store.verifyModel(blob,signal,undefined,descriptor);await store.saveModel(blob,signal,descriptor);
        if(!(await store.savedModel(descriptor)))throw new Error('Import was not committed');
        await store.removeSavedModel(descriptor);
        const failures=[];
        for(const [name,response] of [['http',()=>new Response('',{status:403})],['short',()=>new Response(bytes.slice(0,10))],['checksum',()=>new Response(new Uint8Array(bytes.length))]]){
          window.fetch=async()=>response();let partial;
          try{partial=await store.downloadModel(signal,()=>{},descriptor);await store.verifyModel(partial,signal,undefined,descriptor);throw new Error('unexpected-success');}
          catch(error){if(error.message==='unexpected-success')throw error;failures.push(error.message);}
          finally{await store.discardDownloadedModel(partial);}
        }
        window.fetch=async()=>new Response(bytes);
        const cancel=new AbortController();try{await store.downloadModel(cancel.signal,()=>cancel.abort(),descriptor);throw new Error('unexpected-success');}catch(error){if(error.message==='unexpected-success')throw error;failures.push(error.name);}
        const estimate=navigator.storage.estimate.bind(navigator.storage);navigator.storage.estimate=async()=>({quota:1,usage:1});
        try{await store.downloadModel(signal,()=>{},descriptor);throw new Error('unexpected-success');}catch(error){if(error.message==='unexpected-success')throw error;failures.push(error.message);}finally{navigator.storage.estimate=estimate;}
        window.fetch=actualFetch;
        const directory=await(await navigator.storage.getDirectory()).getDirectoryHandle('calendar-models');const files=[];for await(const [name]of directory.entries())files.push(name);
        return {failures,files,installed:await store.hasDownloadedModelData(descriptor)};
      },workerOnly);
      assert.deepEqual(result.failures,['model-http-403','model-size','model-checksum','AbortError','model-storage-space']);assert.deepEqual(result.files,[]);assert.equal(result.installed,false);
      console.log(`OPFS ${workerOnly?'sync worker':'createWritable'}: download/import, HTTP, truncation, checksum, cancellation and quota passed.`);
      await context.close();
    }
  }finally{await browser?.close();server.kill('SIGTERM');}
})().catch(error=>{console.error(error);process.exitCode=1;});
