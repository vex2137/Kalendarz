// One-use encrypted runner handoff using the existing RSA-OAEP/AES-GCM scheme.
// Only a temporary public key and bound ciphertext enter a transport branch.
// No Release, permanent secret change or new Android signing key is involved.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const {seal,open}=require('./signing-exchange.cjs');
const repo=process.argv[6]||'vex2137/Kalendarz',prefix='.github/android-beta5-signing/';
function api(method,endpoint,data,optional=false){
 const args=['api','--method',method,endpoint];if(data)args.push('--input','-');
 const result=spawnSync('gh',args,{input:data?JSON.stringify(data):undefined,encoding:'utf8',maxBuffer:1024*1024});
 if(result.status!==0){if(optional&&/HTTP 404/.test(result.stderr))return;throw Error('Signing transport request failed: '+method+' '+endpoint.split('?')[0]+' '+(result.stderr.match(/HTTP \d+/)?.[0]||'CLI failure')); }
 return result.stdout.trim()?JSON.parse(result.stdout):undefined;
}
function trustedWorkflowPath(repository,workflowPath){
 return repository==='vex2137/Kalendarz-private-builds'
  ? ['.github/workflows/build-android-beta5.yml','.github/workflows/build-part2-stable.yml','.github/workflows/build-part3-beta1.yml'].includes(workflowPath)
  : repository==='vex2137/Kalendarz' && workflowPath==='.github/workflows/publish-142.yml';
}
module.exports={trustedWorkflowPath};
async function main(){
 const [mode,runId,directory,source]=process.argv.slice(2);
 const privateBuilder=repo==='vex2137/Kalendarz-private-builds';
 if(!["vex2137/Kalendarz","vex2137/Kalendarz-private-builds"].includes(repo))throw Error('Untrusted builder repository');
 if(!['send','receive'].includes(mode)||!/^\d+$/.test(runId)||!directory||!/^[a-f0-9]{40}$/.test(source))throw Error('Invalid exchange arguments');
 const run=api('GET',`repos/${repo}/actions/runs/${runId}`);
 if(run.event!=='workflow_dispatch'||!trustedWorkflowPath(repo,run.path)||run.status!=='in_progress'||(!privateBuilder&&run.head_sha!==source)||run.head_branch!==(privateBuilder?'main':'feat/1.5.0-part2'))throw Error('Refusing untrusted workflow/source');
 const branch=`android-beta5-signing-${runId}-${run.run_attempt}`,endpoint=`repos/${repo}/contents/${prefix}`;
 const binding=JSON.stringify({repository:repo,runId,attempt:run.run_attempt,workflowSource:run.head_sha,source});
 if(mode==='send'){
  const response=api('GET',endpoint+'public.json?ref='+branch),info=JSON.parse(Buffer.from(response.content,'base64'));
  if(info.binding!==binding||info.source!==source||info.repository!==repo)throw Error('Public key binding mismatch');
  const config=JSON.parse(fs.readFileSync(path.join(directory,'signing.json')));
  if(config.certificateSha256!=='ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143')throw Error('Wrong existing update backup');
  const envelope=seal({...config,keystore:fs.readFileSync(path.join(directory,'calendar-update-142.p12')).toString('base64')},info.publicKey,binding);
  api('PUT',endpoint+'envelope.json',{branch,message:'Deliver one-use encrypted Android update key [skip ci]',content:Buffer.from(JSON.stringify(envelope)).toString('base64')});
  console.log('Encrypted existing update key delivered for this exact run/source; no plaintext or secret changes.');return;
 }
 if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_RUN_ID!==runId||process.env.GITHUB_SHA!==run.head_sha||process.env.CALENDAR_EXPECTED_COMMIT!==source)throw Error('Runner identity mismatch');
 let payload;
 if(process.env.CALENDAR_ANDROID_KEYSTORE_BASE64){
  payload={keystore:process.env.CALENDAR_ANDROID_KEYSTORE_BASE64,password:process.env.CALENDAR_KEYSTORE_PASSWORD,keyPassword:process.env.CALENDAR_KEY_PASSWORD,alias:process.env.CALENDAR_KEY_ALIAS};
 }else{
  const {publicKey,privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:3072});
  api('POST',`repos/${repo}/git/refs`,{ref:'refs/heads/'+branch,sha:run.head_sha});
  try{
   api('PUT',endpoint+'public.json',{branch,message:'Publish one-use Android runner public key [skip ci]',content:Buffer.from(JSON.stringify({repository:repo,source,binding,publicKey:publicKey.export({type:'spki',format:'pem'})})).toString('base64')});
   console.log('Waiting up to 10 minutes for encrypted existing update key: '+branch);
   const deadline=Date.now()+600000;
   while(Date.now()<deadline){const response=api('GET',endpoint+'envelope.json?ref='+branch,undefined,true);if(response){payload=open(JSON.parse(Buffer.from(response.content,'base64')),privateKey,binding);break;}await new Promise(r=>setTimeout(r,5000));}
   if(!payload)throw Error('One-use signing handoff timed out');
  }finally{api('DELETE',`repos/${repo}/git/refs/heads/${branch}`);}
 }
 const env={...process.env,CALENDAR_KEYSTORE_PATH:path.join(directory,'calendar-release.p12'),CALENDAR_KEYSTORE_PASSWORD:payload.password,CALENDAR_KEY_PASSWORD:payload.keyPassword||payload.password,CALENDAR_KEY_ALIAS:payload.alias};
 for(const name of ['CALENDAR_KEYSTORE_PASSWORD','CALENDAR_KEY_PASSWORD','CALENDAR_KEY_ALIAS']){if(!env[name]||/[\r\n]/.test(env[name]))throw Error('Invalid signing payload');console.log('::add-mask::'+env[name]);}
 fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(env.CALENDAR_KEYSTORE_PATH,Buffer.from(payload.keystore,'base64'),{mode:0o600});
 const check=spawnSync('java',['.github/scripts/VerifyAndroidSigning.java'],{env,stdio:['ignore','pipe','pipe']});
 if(check.status!==0){fs.rmSync(env.CALENDAR_KEYSTORE_PATH,{force:true});throw Error('Existing update certificate/private-key proof failed');}
 for(const name of ['CALENDAR_KEYSTORE_PATH','CALENDAR_KEYSTORE_PASSWORD','CALENDAR_KEY_PASSWORD','CALENDAR_KEY_ALIAS'])fs.appendFileSync(process.env.GITHUB_ENV,name+'='+env[name]+'\n');
 console.log('Existing update certificate and private-key proof verified; signing file is runner-temporary only.');
}
if(require.main===module)main().catch(error=>{const safe=/^(Signing transport request failed|Refusing untrusted workflow|Runner identity mismatch|Invalid exchange arguments|Existing update certificate)/.test(error.message)?error.message:'No secret details logged';console.error('Android Beta 5 signing handoff failed: '+safe);process.exitCode=1;});
