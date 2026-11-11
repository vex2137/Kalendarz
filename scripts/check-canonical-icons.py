"""Verify deterministic Android-derived assets and actual packaged/window icons."""
import argparse,base64,hashlib,json,re,subprocess,importlib.util
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
ROOT=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def same_pixels(a,b):
 assert a.size==b.size,(a.size,b.size)
 for color in ('white','black'):
  bg=Image.new('RGBA',a.size,color)
  assert ImageChops.difference(Image.alpha_composite(bg,a),Image.alpha_composite(bg,b)).getbbox() is None

def main():
 p=argparse.ArgumentParser();p.add_argument('--web-dir',type=Path);p.add_argument('--x11-window');p.add_argument('--flatpak-location',type=Path);a=p.parse_args()
 m=json.loads((ROOT/'packaging/icons/manifest.json').read_text());assert m['source']=='android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png'
 assert m['sourceSha256']=='bd24fd383253bf8d43f0a81f11c071d76d1d555114376dd647cd9fb38fa0a9da'
 assert digest(ROOT/m['source'])==m['sourceSha256']
 for name,sha in {**m['androidReference'],**m['files']}.items():assert digest(ROOT/name)==sha,name
 spec=importlib.util.spec_from_file_location('adaptive',ROOT/'scripts/android-adaptive-icon.py');adaptive=importlib.util.module_from_spec(spec);spec.loader.exec_module(adaptive)
 source=adaptive.compose();assert m['composition']==adaptive.configuration()
 assert (ROOT/'public/icon.svg').read_text()==adaptive.reference_svg()
 same_pixels(Image.open(ROOT/'public/pwa-maskable-512x512.png').convert('RGBA'),adaptive.compose(masked=False))
 for n in [16,24,32,48,64,128,256,512]:same_pixels(Image.open(ROOT/f'packaging/icons/png/{n}x{n}.png').convert('RGBA'),source.resize((n,n),Image.Resampling.LANCZOS))
 ico=Image.open(ROOT/'packaging/icons/calendar.ico')
 for n in [16,24,32,48,64,128,256]:same_pixels(ico.ico.getimage((n,n)).convert('RGBA'),source.resize((n,n),Image.Resampling.LANCZOS))
 svg=(ROOT/'public/icon.svg').read_text();assert base64.b64decode(re.search('base64,([^"\\s]+)',svg)[1])==(ROOT/m['source']).read_bytes()
 report=dict(androidSource=m['source'],androidSourceSha256=m['sourceSha256'],sourceAssets='PASS exact decoded derivatives; Android files unchanged')
 if a.web_dir:
  for name,sha in m['files'].items():
   if name.startswith('public/'):assert digest(a.web_dir/name.removeprefix('public/'))==sha,name
  manifest=json.loads((a.web_dir/'manifest.webmanifest').read_text())
  for icon in manifest['icons']:
   path=a.web_dir/icon['src'].lstrip('./');im=Image.open(path);assert icon['sizes']==f'{im.width}x{im.height}';assert digest(path)==m['files']['public/'+path.name]
  html=(a.web_dir/'index.html').read_text();assert 'favicon.ico' in html and 'favicon-32x32.png' in html and 'apple-touch-icon.png' in html
  report['packagedWeb']='PASS built manifest, favicon, PWA and touch icons match Android derivatives'
 if a.flatpak_location:
  icon=a.flatpak_location/'files/share/icons/hicolor/512x512/apps/com.vex2137.kalendarz.png';assert digest(icon)==m['files']['packaging/icons/png/512x512.png']
  desktop=a.flatpak_location/'files/share/applications/com.vex2137.kalendarz.desktop';assert 'Icon=com.vex2137.kalendarz' in desktop.read_text();report['flatpakExportedIcon']='PASS installed bundle icon and desktop identity'
 if a.x11_window:
  text=subprocess.check_output(['xprop','-len','16777216','-id',a.x11_window,'-f','_NET_WM_ICON','32c','_NET_WM_ICON'],text=True)
  assert '=' in text,'Window did not publish an icon'
  values=[int(v)&0xffffffff for v in re.findall(r'-?\d+',text.split('=',1)[1])];images=[];i=0
  while i<len(values):
   w,h=values[i:i+2];assert 0<w<=1024 and 0<h<=1024 and i+2+w*h<=len(values)
   data=values[i+2:i+2+w*h];i+=2+w*h
   if w==h:images.append((w,data))
  width,data=max(images,key=lambda item:item[0]);actual=Image.new('RGBA',(width,width));actual.putdata([((v>>16)&255,(v>>8)&255,v&255,(v>>24)&255) for v in data])
  expected=source.resize((width,width),Image.Resampling.LANCZOS);errors=[]
  for color in ('white','black'):
   bg=Image.new('RGBA',actual.size,color);diff=ImageChops.difference(Image.alpha_composite(bg,actual),Image.alpha_composite(bg,expected));errors.append(sum(ImageStat.Stat(diff).mean[:3])/3)
  assert max(errors)<1.0,errors
  report['x11WindowIcon']=dict(status='PASS actual window pixels match Android reference',size=width,meanChannelError=max(errors))
 print(json.dumps(report))
if __name__=='__main__':main()
