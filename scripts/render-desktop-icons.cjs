// Rasterize the existing official SVG; Pillow is an optional developer tool,
// not an application dependency. CI validates the checked-in outputs.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{chromium}=require('playwright');
(async()=>{const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});try{const page=await browser.newPage({viewport:{width:512,height:512},deviceScaleFactor:1});await page.setContent('<style>html,body{margin:0;width:512px;height:512px;overflow:hidden;background:transparent}</style>'+fs.readFileSync(path.join(root,'public/icon.svg'),'utf8'));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(root,'public/desktop-icon.png'),omitBackground:true});}finally{await browser.close();}
const result=spawnSync('python3',['-c',`from PIL import Image
from pathlib import Path
import hashlib,json
root=Path('.')
image=Image.open('public/desktop-icon.png').convert('RGBA')
sizes=[16,24,32,48,64,128,256,512]
files=[]
for n in sizes:
 p=root/f'packaging/icons/png/{n}x{n}.png';p.parent.mkdir(parents=True,exist_ok=True);image.resize((n,n),Image.Resampling.LANCZOS).save(p,optimize=True);files.append(str(p))
image.save('packaging/icons/calendar.ico',format='ICO',sizes=[(n,n) for n in sizes if n<=256],bitmap_format='bmp')
files+=['packaging/icons/calendar.ico','public/desktop-icon.png']
manifest={'source':'public/icon.svg','sourceSha256':hashlib.sha256(Path('public/icon.svg').read_bytes()).hexdigest(),'files':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in files}}
Path('packaging/icons/manifest.json').write_text(json.dumps(manifest,indent=2)+'\\n')
`],{cwd:root,stdio:'inherit'});if(result.status)throw Error('Install Pillow in the developer environment to regenerate PNG/ICO assets');})();
