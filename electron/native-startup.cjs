// Startup-only public diagnostics. Never export raw server logs or chat payloads.
function classifyLoadFailure(error,log='',stage=''){
  if(['verify-runtime','process-start'].includes(stage)&&['ENOENT','EACCES','ENOEXEC','EPERM'].includes(error.code))return 'model-native-runtime';
  if(error.message?.startsWith('model-'))return error.message;
  if(error.code==='ENOMEM')return 'model-memory';
  if(/out of (?:(?:device|host) )?memory|bad_alloc|allocation failed|cannot allocate|CUDA_ERROR_OUT_OF_MEMORY|VK_ERROR_OUT_OF_(?:DEVICE|HOST)_MEMORY/iu.test(log))return 'model-memory';
  if(/unknown (?:model )?architecture|unsupported (?:model )?architecture|unsupported.*gguf.*version/iu.test(log))return 'model-gguf-unsupported';
  if(/invalid.*gguf|invalid magic|bad magic/iu.test(log))return 'model-gguf-invalid';
  if(error.message?.startsWith('native-runtime')||/error while loading shared libraries|cannot open shared object file|symbol lookup error|undefined symbol|GLIBC(?:XX)?_.*not found/iu.test(log))return 'model-native-runtime';
  if(['ENOENT','EACCES','EPERM'].includes(error.code)||/permission denied|no such file|failed to open|cannot open/iu.test(log))return 'model-file-unavailable';
  return 'model-native-load';
}
function safeStartupLine(line,secrets=[]){
  line=line.replace(/\x1b\[[0-9;]*m/g,'');
  for(const secret of secrets)if(secret)line=line.split(secret).join('<redacted>');
  line=line.replace(/(?:--api-key|Authorization|Bearer)\s*[:=]?\s*\S+/gi,'<credential>')
    .replace(/(^|[\s"'=(])(?:[A-Za-z]:[\\/]|\/)[^\s"'<>]*/g,'$1<path>')
    .replace(/[^\s"'<>]+\.gguf/gi,'<model>');
  if(/\b(?:prompt|chat|messages|content|user|assistant)\b|general\.name|chat_template/iu.test(line))return '';
  return /ggml_(?:cuda|vulkan)|\bCUDA\b|CUDA_ERROR|\bVulkan\b|VK_ERROR|offload|\bn_ctx|\berror\b|failed to|permission denied|allocation|out of memory|cannot open|shared libraries|symbol lookup|GLIBC|unknown.*architecture|unsupported.*architecture|invalid.*gguf|magic/iu.test(line)?line.slice(0,512):'';
}
module.exports={classifyLoadFailure,safeStartupLine};
