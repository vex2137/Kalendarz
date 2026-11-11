// Deterministic format/size conversion of the unchanged Android launcher icon.
// Pillow is a developer tool only. No artwork is drawn or regenerated.
const {spawnSync}=require('node:child_process'),path=require('node:path');
const result=spawnSync('python3',['-c',String.raw`
from PIL import Image
from pathlib import Path
import hashlib,json,shutil,base64
root=Path('.')
source=root/'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'
image=Image.open(source).convert('RGBA')
sizes=[16,24,32,48,64,128,256,512]
files=[]
for n in sizes:
 p=root/f'packaging/icons/png/{n}x{n}.png';p.parent.mkdir(parents=True,exist_ok=True)
 image.resize((n,n),Image.Resampling.LANCZOS).save(p,optimize=True);files.append(str(p))
Image.open('packaging/icons/png/256x256.png').save('packaging/icons/calendar.ico',format='ICO',sizes=[(n,n) for n in sizes if n<=256],append_images=[Image.open(f'packaging/icons/png/{n}x{n}.png') for n in sizes if n<256],bitmap_format='bmp')
for name,size in [('desktop-icon.png',512),('pwa-512x512.png',512),('apple-touch-icon.png',180),('favicon-32x32.png',32)]:
 p=root/'public'/name;image.resize((size,size),Image.Resampling.LANCZOS).save(p,optimize=True);files.append(str(p))
shutil.copyfile(source,'public/pwa-192x192.png')
shutil.copyfile('packaging/icons/calendar.ico','public/favicon.ico')
encoded=base64.b64encode(source.read_bytes()).decode('ascii')
Path('public/icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="512" height="512"><image width="192" height="192" href="data:image/png;base64,'+encoded+'"/></svg>\n')
files+=['packaging/icons/calendar.ico','public/pwa-192x192.png','public/favicon.ico','public/icon.svg']
manifest={'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'conversion':'Unchanged Android legacy launcher PNG; resolution/encoding only','androidReference':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [source,root/'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png',root/'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml']},'files':{p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in files}}
Path('packaging/icons/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
`],{cwd:path.resolve(__dirname,'..'),stdio:'inherit'});
if(result.status!==0)throw Error('Install Pillow in the developer environment to convert the existing Android icon');
