// Compose unchanged Android adaptive layers; no new artwork or Android changes.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const result=spawnSync('python3',[path.join(__dirname,'render-adaptive-icons.py')],{cwd:path.resolve(__dirname,'..'),stdio:'inherit'});
if(result.status!==0)throw Error('Install developer tools Pillow and CairoSVG==2.8.2 to compose original Android adaptive resources');
