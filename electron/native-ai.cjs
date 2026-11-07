const {classifyLoadFailure,safeStartupLine}=require('./native-startup.cjs');
const {nativeProcessEnvironment}=require('./native-environment.cjs');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
const fs=require('node:fs/promises');
const {createReadStream,readFileSync}=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const crypto=require('node:crypto');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function parseDevices(output){
  return output.split('\n').flatMap(line=>{
    const match=line.match(/^\s*((?:Vulkan|CUDA|Metal)\d*):\s*(.+?)(?:\s+\((\d+) MiB,\s*(\d+) MiB free\))?\s*$/);
    if(!match||/llvmpipe|lavapipe|swiftshader|software|cpu/iu.test(match[2]))return [];
    return [{backend:match[1].startsWith('CUDA')?'cuda':match[1].startsWith('Metal')?'metal':'vulkan',id:match[1],name:match[2],...(match[3]?{totalBytes:Number(match[3])*1048576,freeBytes:Number(match[4])*1048576}:{})}];
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
function gpuFailure(error,log=''){
  if(error.nativeFailureReason)return error.nativeFailureReason;
  if(error.message?.startsWith('native-runtime')||/error while loading shared libraries|undefined symbol/iu.test(log))return 'gpu-runtime-unavailable';
  if(error.message==='native-offload-unconfirmed')return 'gpu-offload-unconfirmed';
  if(/out of (?:(?:device|host) )?memory|VK_ERROR_OUT_OF_(?:DEVICE|HOST)_MEMORY|ErrorOutOf(?:Device|Host)Memory|CUDA_ERROR_OUT_OF_MEMORY|cudaMalloc.*failed|bad_alloc|allocation failed|not enough.*memory/iu.test(log+' '+error.message))return 'insufficient-vram';
  if(/CUDA_ERROR|CUDA error|cuda.*(?:driver|initializ)|VK_ERROR|vulkan.*(?:driver|initializ)|device lost/iu.test(log+' '+error.message))return 'gpu-driver-failed';
  return 'gpu-start-failed';
}
class NativeAI {
  constructor({runtimeRoot,store,platform=process.platform}){this.root=runtimeRoot;this.store=store;this.platform=platform;this.mode='auto';this.gpuLayers=999;this.contexts=new Map();this.packaged=[];try{const m=JSON.parse(readFileSync(path.join(runtimeRoot,'runtime-manifest.json'),'utf8'));this.packaged=[...new Set(Object.keys(m.files).map(file=>file.split('/')[0]==='cpu'?'cpu-native':file.split('/')[0]))];if(platform==='darwin'&&this.packaged.includes('cpu-native'))this.packaged.push('metal');}catch{}this.state={backend:'cpu-native',gpuActive:false,loaded:false,available:false};this.checked=new Set();this.attempts=[];}
  snapshot(){return {...this.state,nativeAttempts:this.attempts.map(a=>({...a})),contextLimit:2147483647,availableMemoryBytes:require('node:os').freemem(),mode:this.mode,gpuLayers:this.gpuLayers,system:this.platform,cpuArchitecture:process.arch,packagedBackends:this.packaged,availableBackends:[...new Set((this.devices||[]).map(d=>d.backend))],gpuDevices:this.devices||[]};}
  binary(backend){return path.join(this.root,backend==='metal'?'cpu':backend,this.platform==='win32'?'llama-server.exe':'llama-server');}
  env(backend){const directory=path.join(this.root,backend==='metal'?'cpu':backend);const base=this.platform==='linux'?nativeProcessEnvironment():process.env;return {...base,...(this.platform==='darwin'?{DYLD_LIBRARY_PATH:directory+(base.DYLD_LIBRARY_PATH?':'+base.DYLD_LIBRARY_PATH:'')}:{}),PATH:directory+path.delimiter+(base.PATH||''),...(this.platform==='linux'?{LD_LIBRARY_PATH:directory+(base.LD_LIBRARY_PATH?':'+base.LD_LIBRARY_PATH:'')}:{})};}
  async verifyRuntime(backend){
    if(backend==='metal')backend='cpu';
    if(this.checked.has(backend))return;
    const manifest=JSON.parse(await fs.readFile(path.join(this.root,'runtime-manifest.json'),'utf8'));
    let found=false;
    for(const [name,sha]of Object.entries(manifest.files)){
      if(!name.startsWith(backend+'/'))continue;
      if(!/^(cpu|vulkan|cuda)\/[a-zA-Z0-9._+-]+$/.test(name))throw Error('native-runtime-manifest');
      const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(path.join(this.root,name)))hash.update(chunk);
      if(hash.digest('hex')!==sha)throw Error('native-runtime-checksum');found=true;
    }
    if(!found)throw Error('native-runtime-missing');this.checked.add(backend);
  }
  async probe(refresh=false){
    if(this.devices&&!refresh)return this.devices;
    this.devices=[];
    let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(this.root,'runtime-manifest.json'),'utf8'));}catch{}
    const backends=this.platform==='darwin'?['metal']:[...(Object.keys(manifest?.files||{}).some(name=>name.startsWith('cuda/'))?['cuda']:[]),'vulkan'];
    for(const backend of backends){
      try{await this.verifyRuntime(backend);const result=await run(this.binary(backend),['--list-devices'],{env:this.env(backend),timeout:10000,maxBuffer:128*1024,windowsHide:true});this.devices.push(...parseDevices(result.stdout+'\n'+result.stderr).filter(d=>d.backend===backend));}
      catch(error){this.probeReason=error.message.startsWith('native-runtime')||error.code==='ENOENT'?'gpu-runtime-unavailable':'gpu-driver-failed';
        const stderr=String(error.stderr||'').split('\n').map(line=>safeStartupLine(line,[this.root])).filter(Boolean).join('\n').slice(-4096);
        this.attempts=[...this.attempts,{backend,binary:path.relative(this.root,this.binary(backend)),stage:'probe',status:'failed',reason:this.probeReason,code:'model-gpu-unavailable',exitCode:Number.isInteger(error.code)?error.code:null,requestedLayers:this.gpuLayers,offloadedLayers:0,stderr}].slice(-4);
      }
    }
    if(this.devices.length)this.probeReason=undefined;
    return this.devices;
  }
  async memory(){
    const pid=this.child?.pid;if(!pid)return;this.state.ramBytes=undefined;this.state.vramBytes=undefined;
    try{
      if(this.platform==='linux'){const status=await fs.readFile(`/proc/${pid}/status`,'utf8');const kb=status.match(/^VmRSS:\s+(\d+) kB/m);if(kb)this.state.ramBytes=Number(kb[1])*1024;}
      else if(this.platform==='win32'){const r=await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-Process -Id ${pid}).WorkingSet64`],{timeout:3000,windowsHide:true});if(/^\d+\s*$/.test(r.stdout))this.state.ramBytes=Number(r.stdout.trim());}
      else if(this.platform==='darwin'){const r=await run('ps',['-o','rss=','-p',String(pid)],{timeout:2000});if(/^\s*\d+\s*$/.test(r.stdout))this.state.ramBytes=Number(r.stdout.trim())*1024;}
      this.state.memoryScope='native-server resident memory';
      if(['vulkan','cuda'].includes(this.backend)){
        const r=await run('nvidia-smi',['--query-compute-apps=pid,used_memory','--format=csv,noheader,nounits'],{timeout:2000,windowsHide:true,env:this.platform==='linux'?nativeProcessEnvironment():process.env});
        const row=r.stdout.split('\n').map(l=>l.split(',').map(s=>s.trim())).find(r=>Number(r[0])===pid&&/^\d+$/.test(r[1]));
        if(row)this.state.vramBytes=Number(row[1])*1048576;
      }
    }catch{/* Missing counters stay unavailable, never zero-filled. */}
  }
  async stop(){
    if(this.stopping)return this.stopping;
    const child=this.child;this.loadedId=undefined;this.backend=undefined;this.state={...this.state,loaded:false,gpuActive:false,deviceName:undefined,offloadedLayers:undefined,contextApplied:undefined,contextUsed:undefined,contextRequested:undefined,ramBytes:undefined,vramBytes:undefined};
    if(child&&child.exitCode===null&&child.signalCode===null){this.stopping=new Promise((resolve,reject)=>{let kill,deadline;const finish=error=>{clearTimeout(kill);clearTimeout(deadline);child.removeListener('exit',exited);child.removeListener('error',failed);error?reject(error):resolve();};const exited=()=>finish();const failed=error=>finish(error);child.once('exit',exited);child.once('error',failed);kill=setTimeout(()=>child.kill('SIGKILL'),1500);deadline=setTimeout(()=>finish(Error('model-stop-timeout')),5000);child.kill();});try{await this.stopping;}finally{this.stopping=undefined;}}
    if(this.child===child)this.child=undefined;
  }
  async cancel(){
    if(this.cancelling)return this.cancelling;
    this.cancelling=(async()=>{this.operation?.abort();this.startController?.abort();await this.stop();await this.loading?.catch(()=>{});await this.operationDone;await this.stop();})();
    try{await this.cancelling;}finally{this.cancelling=undefined;}
  }
  async setMode(mode,gpuLayers=999){if(!['auto','gpu','cpu'].includes(mode)||!Number.isInteger(gpuLayers)||gpuLayers<1||gpuLayers>999)throw Error('model-input');if(this.operation)throw Error('model-busy');await this.cancel();this.mode=mode;this.gpuLayers=gpuLayers;this.state.fallbackReason=undefined;this.state.errorCode=undefined;return this.snapshot();}
  async start(id,backend,device,signal){
    const started=performance.now(),attempt={backend,binary:path.relative(this.root,this.binary(backend)),stage:'stop-previous',status:'starting',requestedLayers:backend==='cpu'?0:this.gpuLayers,contextLength:this.contexts.get(id)||this.store.descriptor(id).maxContext,offloadedLayers:0,stderr:''};
    this.attempts=[...this.attempts,attempt].slice(-4);this.currentAttempt=attempt;
    let child,localLog='',pending='',spawnError,closed=false,key,file;
    const stage=name=>{attempt.stage=name;};
    const check=()=>{signal.throwIfAborted();if(child&&(this.child!==child||spawnError||child.exitCode!==null||child.signalCode!==null))throw spawnError||Error('native-start-failed');};
    const add=chunk=>{localLog=(localLog+chunk.toString()).slice(-32000);if(this.child!==child||this.currentAttempt!==attempt)return;this.log=localLog;const matches=[...localLog.matchAll(/offloaded (\d+)\/(\d+) layers to GPU/g)];if(matches.length)this.offloaded=attempt.offloadedLayers=Number(matches.at(-1)[1]);};
    const stderr=chunk=>{add(chunk);if(attempt.status!=='starting')return;pending=(pending+chunk.toString()).slice(-8192);let split;while((split=pending.indexOf('\n'))>=0){const line=safeStartupLine(pending.slice(0,split),[key,file,this.root]);pending=pending.slice(split+1);if(line)attempt.stderr=(attempt.stderr+line+'\n').slice(-4096);}};
    const abort=()=>{child?.kill();};
    try{
      await this.stop();stage('verify-runtime');await this.verifyRuntime(backend);check();
      stage('verify-model');const model=this.store.descriptor(id);file=await this.store.verifiedPath(id,signal);check();
      const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});check();
      key=crypto.randomBytes(32).toString('hex');this.endpoint=`http://127.0.0.1:${port}`;this.key=key;this.log='';this.offloaded=0;
      const args=['--host','127.0.0.1','--port',String(port),'--api-key',key,'--model',file,'--ctx-size',String(attempt.contextLength),'--parallel','1','--threads',String(Math.min(4,require('node:os').availableParallelism())),'--batch-size','128','--ubatch-size','64','--no-webui','--timeout','180','--sleep-idle-seconds','300',
        '--n-gpu-layers',String(attempt.requestedLayers),'--device',backend!=='cpu'?device.id:'none'];
      stage('process-start');child=spawn(this.binary(backend),args,{env:this.env(backend),stdio:['ignore','pipe','pipe'],windowsHide:true});this.child=child;this.backend=backend;
      child.stdout.on('data',add);child.stderr.on('data',stderr);child.on('error',error=>{spawnError=error;});child.on('close',()=>{closed=true;});
      child.on('exit',()=>{if(this.child===child){this.state.loaded=false;this.state.gpuActive=false;}});
      signal.addEventListener('abort',abort,{once:true});
      stage('health');const end=Date.now()+120000;let healthy=false;
      while(Date.now()<end){check();try{const response=await fetch(this.endpoint+'/health',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(1500)});attempt.healthHttpStatus=response.status;if(response.ok){healthy=true;break;}}catch{}await delay(100);}
      check();if(!healthy)throw Error('native-load-timeout');
      // /health readiness and pipe delivery are independent asynchronous events.
      if(backend!=='cpu'){stage('offload');const deadline=Date.now()+1000;while(!this.offloaded&&Date.now()<deadline){check();await delay(20);}check();if(!this.offloaded)throw Error('native-offload-unconfirmed');}
      stage('context');let props;try{const r=await fetch(this.endpoint+'/props',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(1500)});if(r.ok)props=await r.json();}catch{}check();
      const contextApplied=parseContextSize(localLog,props);attempt.stage='loaded';attempt.status='loaded';
      this.loadedId=id;this.state={...this.state,modelId:id,modelName:model.name,contextRequested:attempt.contextLength,contextApplied,contextUsed:undefined,loadMs:performance.now()-started,tokensPerSecond:undefined,errorCode:undefined,available:true,loaded:true,threads:Math.min(4,require('node:os').availableParallelism()),backend:backend==='cpu'?'cpu-native':backend,deviceName:device?.name,gpuActive:false,offloadedLayers:this.offloaded};await this.memory();return this.snapshot();
    }catch(error){
      // Drain already exited process pipes briefly before classifying its failure.
      if(child&&!closed&&(child.exitCode!==null||spawnError))await Promise.race([new Promise(resolve=>child.once('close',resolve)),delay(250)]);
      if(pending){const line=safeStartupLine(pending,[key,file,this.root]);if(line)attempt.stderr=(attempt.stderr+line).slice(-4096);}
      if(spawnError)attempt.stage='process-start';
      attempt.status=signal.aborted?'cancelled':'failed';attempt.code=signal.aborted?'model-cancelled':classifyLoadFailure(error,localLog,attempt.stage);attempt.exitCode=child?.exitCode??null;attempt.signal=child?.signalCode??null;
      if(/^[A-Z0-9_]{1,40}$/.test(error.code||''))attempt.nativeCode=error.code;else if(/^(?:native|model)-[a-z-]{1,60}$/.test(error.message||''))attempt.nativeCode=error.message;
      attempt.reason=backend==='cpu'?attempt.code:attempt.code==='model-native-runtime'?'gpu-runtime-unavailable':gpuFailure(error,localLog);
      if(child&&this.child===child)await this.stop();
      if(signal.aborted)throw signal.reason||error;
      this.state.errorCode=attempt.code;const failure=Error(attempt.code);failure.nativeFailureReason=attempt.reason;throw failure;
    }finally{signal.removeEventListener('abort',abort);}
  }
  async prepare(id,contextSize){
    const descriptor=this.store.descriptor(id),previous=this.contexts.get(id)||descriptor.maxContext,requested=contextSize??previous;
    if(contextSize!==undefined&&(!Number.isInteger(contextSize)||contextSize<32||contextSize>2147483647))throw Error('model-context-range');
    if(this.cancelling)throw Error('model-busy');
    if(this.loading){if(this.loadingId!==id||requested!==this.loadingContext)throw Error('model-busy');return this.loading;}
    if(this.operation&&(this.operationId!==id||contextSize!==undefined&&contextSize!==previous))throw Error('model-busy');
    if(this.loadedId===id&&this.state.contextRequested===requested&&this.state.loaded&&this.child?.exitCode===null&&this.child.signalCode===null)return this.snapshot();
    if(this.operation&&contextSize!==undefined)throw Error('model-busy');
    if(contextSize!==undefined)this.contexts.set(id,contextSize);
    this.loadingContext=requested;this.attempts=[];
    this.state.fallbackReason=undefined;this.state.errorCode=undefined;this.loadingId=id;
    const controller=this.startController=new AbortController();
    this.loading=(async()=>{
      this.probeReason=undefined;
      const devices=this.mode==='cpu'?[]:await this.probe(true),descriptor=this.store.descriptor(id);
      const rejected=devices.filter(d=>this.gpuLayers>=999&&d.freeBytes!==undefined&&d.freeBytes<(descriptor.estimatedRamMB+256)*1048576);
      for(const backend of new Set(rejected.map(d=>d.backend||'vulkan')))this.attempts=[...this.attempts,{backend,binary:path.relative(this.root,this.binary(backend)),stage:'memory-preflight',status:'rejected',reason:'insufficient-vram',requestedLayers:this.gpuLayers,contextLength:requested,offloadedLayers:0,stderr:''}].slice(-4);
      const compatible=devices.filter(d=>this.gpuLayers<999||d.freeBytes===undefined||d.freeBytes>=(descriptor.estimatedRamMB+256)*1048576);
      controller.signal.throwIfAborted();
      // Try each packaged GPU backend once, in CUDA/Vulkan or Metal preference order.
      const attempted=new Set();
      for(const device of compatible){const backend=device.backend||'vulkan';if(attempted.has(backend))continue;attempted.add(backend);
        try{return await this.start(id,backend,device,controller.signal);}catch(error){if(controller.signal.aborted||error.message==='model-stop-timeout')throw error;this.state.fallbackReason=gpuFailure(error,this.log);}}
      if(this.mode!=='cpu'&&!attempted.size)this.state.fallbackReason=devices.length?'insufficient-vram':this.probeReason||'no-compatible-gpu';
      if(this.mode==='gpu'){await this.stop();this.state.errorCode='model-gpu-unavailable';throw Error('model-gpu-unavailable');}
      return this.start(id,'cpu',undefined,controller.signal);
    })();
    try{return await this.loading;}finally{this.loading=undefined;this.loadingId=undefined;this.loadingContext=undefined;this.startController=undefined;}
  }
  async stream(request,signal){
    const started=performance.now();const response=await fetch(this.endpoint+'/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json'},body:JSON.stringify(request),signal});
    if(!response.ok||!response.body)throw Error('native-inference');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',finish=null,usage={},timings={},firstTokenMs;
    try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let split;while((split=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,split).trim();buffer=buffer.slice(split+1);if(!line.startsWith('data:')||line==='data: [DONE]')continue;const chunk=JSON.parse(line.slice(5));const choice=chunk.choices?.[0],content=choice?.delta?.content;if(content){firstTokenMs??=performance.now()-started;text+=content;if(text.length>24000)throw Error('model-response');}if(choice?.finish_reason)finish=choice.finish_reason;if(chunk.usage)usage=chunk.usage;if(chunk.timings)timings=chunk.timings;}}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    if(!text||!finish)throw Error('model-response');await this.memory();const tokens=usage.completion_tokens||timings.predicted_n||0;
    this.state.gpuActive=['vulkan','cuda','metal'].includes(this.backend)&&this.offloaded>0&&tokens>0;
    if(this.state.gpuActive&&this.currentAttempt){this.currentAttempt.stage='inference';this.currentAttempt.status='confirmed';}
    this.state.contextUsed=Number.isInteger(usage.prompt_tokens)&&Number.isInteger(usage.completion_tokens)?usage.prompt_tokens+usage.completion_tokens:undefined;
    this.state.tokensPerSecond=Number.isFinite(timings.predicted_per_second)?timings.predicted_per_second:undefined;
    return {text,finish,usage,timings,firstTokenMs,backend:this.snapshot()};
  }
  async complete(id,input){
    if(this.operation||this.cancelling)throw Error('model-busy');const request=validateRequest(input);this.store.descriptor(id);
    let finished;this.operationDone=new Promise(resolve=>{finished=resolve;});
    const controller=this.operation=new AbortController();this.operationId=id;const abortLoad=()=>this.startController?.abort();controller.signal.addEventListener('abort',abortLoad,{once:true});const timeout=setTimeout(()=>controller.abort(),180000);
    try{
      await this.prepare(id);controller.signal.throwIfAborted();
      try{return await this.stream(request,controller.signal);}
      catch(error){if(controller.signal.aborted||!['vulkan','cuda','metal'].includes(this.backend))throw error;this.state.fallbackReason='gpu-inference-failed';if(this.currentAttempt){this.currentAttempt.stage='inference';this.currentAttempt.status='failed';this.currentAttempt.reason='gpu-inference-failed';}if(this.mode==='gpu'){this.state.errorCode='model-gpu-inference';throw Error('model-gpu-inference');}await this.start(id,'cpu',undefined,controller.signal);return await this.stream(request,controller.signal);}
    }catch(error){await this.stop();throw error;}
    finally{clearTimeout(timeout);controller.signal.removeEventListener('abort',abortLoad);this.operation=undefined;this.operationId=undefined;this.operationDone=undefined;finished();}
  }
}
function parseContextSize(log,props){const value=props?.default_generation_settings?.n_ctx;const match=[...log.matchAll(/\bn_ctx_per_seq\s*=\s*(\d+)/g)].at(-1)||[...log.matchAll(/\bn_ctx\s*=\s*(\d+)/g)].at(-1);const n=Number(value??match?.[1]);return Number.isInteger(n)&&n>0&&n<=2147483647?n:undefined;}
module.exports={parseContextSize,NativeAI,parseDevices,validateRequest};
