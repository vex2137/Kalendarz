"""Capture real X11 icon pixels/screenshots or privately deliver evidence, no redraw."""
import os,sys,json,subprocess,zipfile
from pathlib import Path
from PIL import Image
kind=os.environ.get('CALENDAR_ICON_PLATFORM','linux');out=Path('part4-artifacts')/kind/'visual';out.mkdir(parents=True,exist_ok=True)
if sys.argv[1]=='x11':
 text=subprocess.check_output(['xprop','-len','16777216','-id',sys.argv[2],'-f','_NET_WM_ICON','32c','_NET_WM_ICON'],text=True);data=[int(x.strip())&0xffffffff for x in text.split('=',1)[1].split(',')];i=0;icons=[]
 while i<len(data):
  w,h=data[i:i+2];i+=2;p=data[i:i+w*h];i+=w*h;assert len(p)==w*h;icons.append((w,h,p))
 w,h,p=max(icons,key=lambda a:a[0]);rgba=bytes(v for n in p for v in ((n>>16)&255,(n>>8)&255,n&255,(n>>24)&255));Image.frombytes('RGBA',(w,h),rgba).save(out/'actual-window-icon.png')
 subprocess.run(['import','-window','root',str(out/'running-desktop.png')],check=True)
else:
 kind=sys.argv[2];out=Path('part4-artifacts')/kind/'visual';assert any(out.glob('*.png'))
 import shutil
 for src,name in [('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png','original-android-foreground.png'),('packaging/icons/android16-adaptive.json','original-platform-composition.json'),('public/icon.svg','original-adaptive-reference.svg'),('public/desktop-icon.png','packaged-static-reference.png')]:shutil.copyfile(src,out/name)
 (out/'provenance.json').write_text(json.dumps({'source':os.environ['CALENDAR_EXPECTED_COMMIT'],'workflowRun':os.environ['GITHUB_RUN_ID'],'reference':'Original Android resources + Android 16 AOSP default mask','physicalPocoMaskVerified':False},indent=2)+'\n')
 repo=os.environ['GITHUB_REPOSITORY'];assert repo=='vex2137/Kalendarz-private-builds'
 def api(p):return json.loads(subprocess.check_output(['gh','api','repos/'+repo+('/'+p if p else '')]))
 assert api('')['private'] and api('releases/424632810')['draft']
 archive=out.parent/('Android16-Adaptive-Visual-'+kind+'-'+os.environ['CALENDAR_EXPECTED_COMMIT'][:12]+'.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for f in out.iterdir():z.write(f,f.name)
 subprocess.run(['gh','release','upload','model-v142-v2',str(archive),'--repo',repo],check=True);print('PASS private visual evidence',archive.name)
