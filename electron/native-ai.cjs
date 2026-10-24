const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const fs=require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const crypto=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function parseDevices(output){
  return output.split('\n').flatMap(line=>{
    const match=line.match(/^\s*(Vulkan\d+):\s*(.+?)(?:\s+\((\d+) MiB,\s*(\d+) MiB free\))?\s*$/);
    if(!match||/llvmpipe|lavapipe|swiftshader|software|cpu/iu.test(match[2]))return [];
    return [{id:match[1],name:match[2],...(match[3]?{totalBytes:Number(match[3])*1048576,freeBytes:Number(match[4])*1048576}:{})}];
  });
}
function validateRequest(request){
  if(!request||typeof request!=='object'||!Array.isArray(request.messages)||request.messages.length>7)throw Error('model-input');
  let length=0;for(const m of request.messages){if(!['system','user','assistant'].includes(m.role)||typeof m.content!=='string')throw Error('model-input');length+=m.content.length;}
  if(length>20000||!Number.isInteger(request.max_tokens)||request.max_tokens<1||request.max_tokens>768)throw Error('model-input');
  if(request.response_format&&JSON.stringify(request.response_format).length>32000)throw Error('model-input');
  return {messages:request.messages,max_tokens:request.max_tokens,temperature:0,top_k:50,repeat_penalty:1.05,
    ...(request.response_format?{response_format:request.response_format}:{}),chat_template_kwargs:{enable_thinking:false},stream:true,stream_options:{include_usage:true}};
}
class NativeAI {
  constructor({runtimeRoot,store,platform=process.platform}){this.root=runtimeRoot;this.store=store;this.platform=platform;this.mode='auto';this.state={backend:'cpu-native',gpuActive:false,loaded:false,available:false};this.checked=new Set();}
  snapshot(){return {...this.state,mode:this.mode,gpuDevices:this.devices||[]};}
  binary(backend){return path.join(this.root,backend,this.platform==='win32'?'llama-server.exe':'llama-server');}
  env(backend){const directory=path.join(this.root,backend);return {...process.env,PATH:directory+path.delimiter+(process.env.PATH||''),...(this.platform==='linux'?{LD_LIBRARY_PATH:directory+(process.env.LD_LIBRARY_PATH?':'+process.env.LD_LIBRARY_PATH:'')}:{})};}
  async verifyRuntime(backend){
    if(this.checked.has(backend))return;
    const manifest=JSON.parse(await fs.readFile(path.join(this.root,'runtime-manifest.json'),'utf8'));
    let found=false;
    for(const [name,sha]of Object.entries(manifest.files)){
      if(!name.startsWith(backend+'/'))continue;
      if(!/^(cpu|vulkan)\/[a-zA-Z0-9._+-]+$/.test(name))throw Error('native-runtime-manifest');
      const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(path.join(this.root,name)))hash.update(chunk);
      if(hash.digest('hex')!==sha)throw Error('native-runtime-checksum');found=true;
    }
    if(!found)throw Error('native-runtime-missing');this.checked.add(backend);
  }
  async probe(refresh=false){
    if(this.devices&&!refresh)return this.devices;
    try{await this.verifyRuntime('vulkan');const result=await run(this.binary('vulkan'),['--list-devices'],{env:this.env('vulkan'),timeout:10000,maxBuffer:128*1024,windowsHide:true});this.devices=parseDevices(result.stdout+'\n'+result.stderr);}
    catch{this.devices=[];}
    return this.devices;
  }
  async memory(){
    const pid=this.child?.pid;if(!pid)return;this.state.ramBytes=undefined;this.state.vramBytes=undefined;
    try{
      if(this.platform==='linux'){const status=await fs.readFile(`/proc/${pid}/status`,'utf8');const kb=status.match(/^VmRSS:\s+(\d+) kB/m);if(kb)this.state.ramBytes=Number(kb[1])*1024;}
      else if(this.platform==='win32'){const r=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-Process -Id ${pid}).WorkingSet64`],{timeout:3000,windowsHide:true});if(/^\d+\s*$/.test(r.stdout))this.state.ramBytes=Number(r.stdout.trim());}
      this.state.memoryScope='native-server resident memory';
      if(this.backend==='vulkan'){
        const r=await run('nvidia-smi',['--query-compute-apps=pid,used_memory','--format=csv,noheader,nounits'],{timeout:2000,windowsHide:true});
        const row=r.stdout.split('\n').map(l=>l.split(',').map(s=>s.trim())).find(r=>Number(r[0])===pid&&/^\d+$/.test(r[1]));
        if(row)this.state.vramBytes=Number(row[1])*1048576;
      }
    }catch{/* Missing counters stay unavailable, never zero-filled. */}
  }
  async stop(){
    const child=this.child;this.child=undefined;this.loadedId=undefined;this.backend=undefined;this.state={...this.state,loaded:false,gpuActive:false,ramBytes:undefined,vramBytes:undefined};
    if(child&&child.exitCode===null&&child.signalCode===null){await new Promise(resolve=>{let done=false;const finish=()=>{if(!done){done=true;clearTimeout(kill);resolve();}};const kill=setTimeout(()=>{child.kill('SIGKILL');finish();},1500);child.once('exit',finish);child.kill();});}
  }
  async cancel(){this.operation?.abort();this.startController?.abort();await this.stop();await this.loading?.catch(()=>{});await this.stop();}
  async setMode(mode){if(!['auto','gpu','cpu'].includes(mode))throw Error('model-input');if(this.operation)throw Error('model-busy');await this.cancel();this.mode=mode;this.state.fallbackReason=undefined;return this.snapshot();}
  async start(id,backend,device,signal){
    await this.stop();await this.verifyRuntime(backend);signal.throwIfAborted();
    const model=this.store.descriptor(id),file=await this.store.verifiedPath(id,signal);
    const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});
    signal.throwIfAborted();
    const key=crypto.randomBytes(32).toString('hex');this.endpoint=`http://127.0.0.1:${port}`;this.key=key;this.log='';this.offloaded=0;
    const args=['--host','127.0.0.1','--port',String(port),'--api-key',key,'--model',file,'--ctx-size',String(model.maxContext),'--parallel','1','--threads',String(Math.min(4,require('node:os').availableParallelism())),'--batch-size','128','--ubatch-size','64','--no-webui','--timeout','180','--sleep-idle-seconds','300',
      '--n-gpu-layers',backend==='vulkan'?'999':'0','--device',backend==='vulkan'?device.id:'none'];
    const child=spawn(this.binary(backend),args,{env:this.env(backend),stdio:['ignore','pipe','pipe'],windowsHide:true});this.child=child;this.backend=backend;
    const logs=chunk=>{this.log=(this.log+chunk.toString()).slice(-32000);const matches=[...this.log.matchAll(/offloaded (\d+)\/(\d+) layers to GPU/g)];if(matches.length)this.offloaded=Number(matches.at(-1)[1]);};
    child.stdout.on('data',logs);child.stderr.on('data',logs);let failed=false;child.on('error',()=>{failed=true;});child.on('exit',()=>{if(this.child===child){this.state.loaded=false;this.state.gpuActive=false;}});
    const abort=()=>{child.kill();};signal.addEventListener('abort',abort,{once:true});
    try{
      const end=Date.now()+120000;let healthy=false;
      while(Date.now()<end){signal.throwIfAborted();if(failed||child.exitCode!==null||child.signalCode!==null)throw Error('native-start-failed');try{const response=await fetch(this.endpoint+'/health',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(1500)});if(response.ok){healthy=true;break;}}catch{}await delay(100);}
      if(!healthy)throw Error('native-load-timeout');if(backend==='vulkan'&&!this.offloaded)throw Error('native-offload-unconfirmed');
      this.loadedId=id;this.state={...this.state,available:true,loaded:true,threads:Math.min(4,require('node:os').availableParallelism()),backend:backend==='vulkan'?'vulkan':'cpu-native',deviceName:device?.name,gpuActive:false,offloadedLayers:this.offloaded};await this.memory();return this.snapshot();
    }catch(error){await this.stop();throw error;}
    finally{signal.removeEventListener('abort',abort);}
  }
  async prepare(id){
    this.store.descriptor(id);if(this.loading)return this.loading;
    if(this.loadedId===id&&this.state.loaded&&this.child?.exitCode===null&&this.child.signalCode===null)return this.snapshot();
    this.state.fallbackReason=undefined;
    const controller=this.startController=new AbortController();
    this.loading=(async()=>{
      const devices=this.mode==='cpu'?[]:await this.probe(true),descriptor=this.store.descriptor(id);const device=devices.find(d=>d.freeBytes===undefined||d.freeBytes>=(descriptor.estimatedRamMB+256)*1048576);
      if(this.mode!=='cpu'&&device){try{return await this.start(id,'vulkan',device,controller.signal);}catch(error){if(controller.signal.aborted)throw error;this.state.fallbackReason='gpu-start-failed';}}
      else if(this.mode!=='cpu')this.state.fallbackReason=devices.length?'insufficient-vram':'no-compatible-gpu';
      return this.start(id,'cpu',undefined,controller.signal);
    })();
    try{return await this.loading;}finally{this.loading=undefined;this.startController=undefined;}
  }
  async stream(request,signal){
    const started=performance.now();const response=await fetch(this.endpoint+'/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(request),signal});
    if(!response.ok||!response.body)throw Error('native-inference');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',finish=null,usage={},timings={},firstTokenMs;
    try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let split;while((split=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,split).trim();buffer=buffer.slice(split+1);if(!line.startsWith('data:')||line==='data: [DONE]')continue;const chunk=JSON.parse(line.slice(5));const choice=chunk.choices?.[0],content=choice?.delta?.content;if(content){firstTokenMs??=performance.now()-started;text+=content;if(text.length>24000)throw Error('model-response');}if(choice?.finish_reason)finish=choice.finish_reason;if(chunk.usage)usage=chunk.usage;if(chunk.timings)timings=chunk.timings;}}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(!text||!finish)throw Error('model-response');await this.memory();const tokens=usage.completion_tokens||timings.predicted_n||0;
    this.state.gpuActive=this.backend==='vulkan'&&this.offloaded>0&&tokens>0;
    return {text,finish,usage,timings,firstTokenMs,backend:this.snapshot()};
  }
  async complete(id,input){
    if(this.operation)throw Error('model-busy');const request=validateRequest(input);this.store.descriptor(id);
    const controller=this.operation=new AbortController();const timeout=setTimeout(()=>controller.abort(),180000);
    try{
      await this.prepare(id);controller.signal.throwIfAborted();
      try{return await this.stream(request,controller.signal);}
      catch(error){if(controller.signal.aborted||this.backend!=='vulkan')throw error;this.state.fallbackReason='gpu-inference-failed';await this.start(id,'cpu',undefined,controller.signal);return await this.stream(request,controller.signal);}
    }catch(error){await this.stop();throw error;}
    finally{clearTimeout(timeout);this.operation=undefined;}
  }
}
module.exports={NativeAI,parseDevices,validateRequest};
