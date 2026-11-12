"""Reproducible format conversions of the original adaptive Android artwork."""
from pathlib import Path
import importlib.util,hashlib,json,shutil
from PIL import Image
spec=importlib.util.spec_from_file_location('adaptive',Path(__file__).with_name('android-adaptive-icon.py'));adaptive=importlib.util.module_from_spec(spec);spec.loader.exec_module(adaptive)
root=adaptive.ROOT;c=adaptive.configuration();image=adaptive.compose();files=[]
for n in [16,24,32,48,64,128,256,512]:
 p=root/f'packaging/icons/png/{n}x{n}.png';image.resize((n,n),Image.Resampling.LANCZOS).save(p,optimize=True);files.append(str(p.relative_to(root)))
Image.open(root/'packaging/icons/png/256x256.png').save(root/'packaging/icons/calendar.ico',format='ICO',sizes=[(n,n) for n in [16,24,32,48,64,128,256]],append_images=[Image.open(root/f'packaging/icons/png/{n}x{n}.png') for n in [16,24,32,48,64,128]],bitmap_format='bmp')
for name,size in [('desktop-icon.png',512),('pwa-512x512.png',512),('pwa-192x192.png',192),('apple-touch-icon.png',180),('favicon-32x32.png',32)]:
 p=root/'public'/name;image.resize((size,size),Image.Resampling.LANCZOS).save(p,optimize=True);files.append(str(p.relative_to(root)))
adaptive.compose(masked=False).save(root/'public/pwa-maskable-512x512.png',optimize=True)
shutil.copyfile(root/'packaging/icons/calendar.ico',root/'public/favicon.ico')
(root/'public/icon.svg').write_text(adaptive.reference_svg())
files+=['public/pwa-maskable-512x512.png','packaging/icons/calendar.ico','public/favicon.ico','public/icon.svg']
def sha(p):return hashlib.sha256((root/p).read_bytes()).hexdigest()
refs=[c['foreground'],c['background'],c['adaptiveXml'],'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png']
m={'source':c['foreground'],'sourceSha256':sha(c['foreground']),'conversion':'Original Android adaptive foreground + original background, Android 16 AOSP mask and 1.5x child viewport; no added artwork','composition':c,'androidReference':{p:sha(p) for p in refs},'files':{p:sha(p) for p in files}}
(root/'packaging/icons/manifest.json').write_text(json.dumps(m,indent=2)+'\n')
