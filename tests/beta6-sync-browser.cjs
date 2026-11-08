const {spawn}=require('node:child_process');
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host=127.0.0.1','--port=4197','--strictPort'],{stdio:'ignore'});
try{for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4197')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const code=await new Promise(resolve=>{const child=spawn(process.execPath,['tests/navigation-themes-sync.cjs'],{stdio:'inherit',env:{...process.env,CALENDAR_TEST_URL:'http://127.0.0.1:4197',FEATURE_TEST_SECTION:'sync'}});child.on('exit',resolve);});if(code!==0)throw Error('QR/import/export regression failed');
}finally{server.kill();}})().catch(e=>{console.error(e);process.exitCode=1});
