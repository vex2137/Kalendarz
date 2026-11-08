const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {NativeAI}=require('../electron/native-ai.cjs');
test('native SSE forwards real Unicode deltas before completion and retains final metrics',async()=>{
 const server=http.createServer((req,res)=>{req.resume();res.writeHead(200,{'Content-Type':'text/event-stream'});const first=Buffer.from('data: '+JSON.stringify({choices:[{delta:{content:'Zażółć '}}]})+'\n\n');const split=first.indexOf(Buffer.from('ż'))+1;res.write(first.subarray(0,split));setTimeout(()=>{res.write(first.subarray(split));setTimeout(()=>res.end('data: '+JSON.stringify({choices:[{delta:{content:'gęślą'},finish_reason:'stop'}],usage:{prompt_tokens:9,completion_tokens:4},timings:{predicted_ms:25,predicted_per_second:24}})+'\n\n'),25);},10);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const ai=new NativeAI({runtimeRoot:'/unused',store:{}});ai.endpoint='http://127.0.0.1:'+server.address().port;ai.key='fixture';ai.memory=async()=>{};ai.backend='cpu';let finished=false;const chunks=[];const pending=ai.stream({},new AbortController().signal,c=>{assert.equal(finished,false);chunks.push(c.text);}).then(r=>{finished=true;return r;});const result=await pending;assert.deepEqual(chunks,['Zażółć ','gęślą']);assert.equal(result.text,'Zażółć gęślą');assert.equal(result.usage.completion_tokens,4);assert.equal(result.timings.predicted_per_second,24);}
 finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('cancelling a resident native generation disconnects its request and retains the loaded engine',async()=>{
 const ai=new NativeAI({runtimeRoot:'/unused',store:{descriptor:()=>({maxContext:2048})}});let stopped=0,entered;
 const ready=new Promise(r=>entered=r);ai.prepare=async()=>{ai.backend='cpu';ai.state.loaded=true;};ai.stop=async()=>{stopped++;};
 ai.stream=async(_request,signal)=>{entered();return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true}));};
 const pending=assert.rejects(ai.complete('known',{messages:[{role:'user',content:'fixture'}],max_tokens:16}),/cancelled/);await ready;await ai.cancelGeneration();await pending;assert.equal(stopped,0);assert.equal(ai.state.loaded,true);assert.equal(ai.operation,undefined);
});
