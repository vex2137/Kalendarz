// Shared acceptance of the real production file-import/download/loader paths.
// The caller supplies the private GGUF outside the package and an isolated profile.
const assert=require('node:assert/strict'),https=require('node:https'),fs=require('node:fs'),fsp=require('node:fs/promises'),crypto=require('node:crypto');
const model=require('../src/utils/localModelManifest.json'),source=require('../src/utils/defaultModelSource.json');
async function infer(page){
 await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').click();await page.locator('[data-testid=backend-mode-result]:visible').filter({hasText:'Mode saved'}).waitFor();
 const row=page.locator(`[data-model-id="${model.id}"]`);await row.getByRole('button',{name:'Load',exact:true}).click();await row.locator('[data-testid=model-in-use]').waitFor({timeout:180000});
 const info=await page.evaluate(id=>window.calendarNativeAI.info(id),model.id);assert.equal(info.installed,true);assert.equal(info.verified,true);assert.equal(info.bytes,model.bytes);
 const result=await page.evaluate(async id=>{return window.calendarNativeAI.complete(id,{messages:[{role:'system',content:'Reply briefly without reasoning.'},{role:'user',content:'Say hello briefly.'}],max_tokens:64});},model.id);
 assert.ok(result.text.trim());assert.ok(result.usage.completion_tokens>0);assert.equal(result.backend.backend,'cpu-native');assert.equal(result.backend.gpuActive,false);return{installed:true,verified:true,completionTokens:result.usage.completion_tokens,backend:result.backend.backend};
}
async function installed(page,wanted=true){
 const end=Date.now()+180000;let last;
 // Poll awaited bridge values on the controller side; a Promise is not installation proof.
 do{last=await page.evaluate(id=>window.calendarNativeAI.info(id),model.id);if(last.installed===wanted&&(!wanted||last.verified===true))return;await page.waitForTimeout(100);}while(Date.now()<end);
 throw Error('Timed out waiting for verified native installation='+wanted+': '+JSON.stringify(last));
}
async function cycle(page,file){
 const stat=await fsp.stat(file);assert.equal(stat.size,model.bytes);const hash=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))hash.update(b);assert.equal(hash.digest('hex'),model.sha256);
 const metadata=await require('../electron/model-folders.cjs').readGGUF(file);assert.equal(metadata.architecture,'qwen35');assert.ok(metadata.blockCount>0);assert.ok(metadata.contextLength>=2048);
 const certDirectory=await fsp.mkdtemp(require('node:path').join(require('node:os').tmpdir(),'calendar-https-test-'));
 // Ephemeral localhost TLS fixture only, never an application signing key.
 const cert=require('node:path').join(certDirectory,'cert.pem'),key=require('node:path').join(certDirectory,'key.pem');require('node:child_process').execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost'],{stdio:'ignore'});
 let requests=0;const server=https.createServer({key:await fsp.readFile(key),cert:await fsp.readFile(cert)},(req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Range, If-Range');res.setHeader('Access-Control-Expose-Headers','Content-Range, ETag');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}requests++;const range=/^bytes=(\d+)-$/.exec(req.headers.range||''),start=range?Number(range[1]):0;res.setHeader('Content-Type','application/octet-stream');res.setHeader('ETag','"'+model.sha256+'"');res.setHeader('Content-Length',model.bytes-start);if(range){res.statusCode=206;res.setHeader('Content-Range',`bytes ${start}-${model.bytes-1}/${model.bytes}`);}fs.createReadStream(file,{start}).pipe(res);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const route=route=>route.continue({url:'https://127.0.0.1:'+server.address().port+'/model.gguf'});
 try{
  const row=page.locator(`[data-model-id="${model.id}"]`);await page.locator('[data-testid=backend-settings]:visible [data-mode=cpu]').click();await page.locator('[data-testid=backend-mode-result]:visible').filter({hasText:'Mode saved'}).waitFor();
  // A fresh profile proves a real download; retained verified bytes should be recovered.
  assert.equal((await page.evaluate(id=>window.calendarNativeAI.info(id),model.id)).installed,false);
  await page.route(source.url,route);await row.getByRole('button',{name:'Download',exact:true}).click();await installed(page);assert.ok(requests>0,'The real catalogue download must reach the local HTTP server');
  const downloadInference=await infer(page);
  await row.locator('details').evaluate(e=>{e.open=true});page.once('dialog',d=>d.accept());await row.getByRole('button',{name:'Remove download',exact:true}).click();await installed(page,false);
  await page.getByLabel('Import GGUF',{exact:true}).setInputFiles(file);await installed(page);
  const importInference=await infer(page);
  await page.getByLabel('Import GGUF',{exact:true}).setInputFiles(file);await installed(page);await page.waitForFunction(()=>{const input=document.querySelector('input[aria-label="Import GGUF"]');return input&&!input.disabled;});
  return{source:process.env.CALENDAR_EXPECTED_COMMIT,modelId:model.id,sha256:model.sha256,bytes:model.bytes,blockCount:metadata.blockCount,contextLength:metadata.contextLength,import:'PASS actual pinned default file, duplicate and native load',download:'PASS actual HTTP to OPFS to native commit and load',importInference,downloadInference,networkRequests:requests,physicalGpuTested:false};
 }finally{await page.unroute(source.url,route);server.closeAllConnections();await new Promise(r=>server.close(r));await fsp.rm(certDirectory,{recursive:true,force:true});}
}
module.exports={cycle,infer,model};
