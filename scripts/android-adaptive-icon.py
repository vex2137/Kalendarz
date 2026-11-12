"""Compose original Android layers using the Android 16 AOSP mask/viewport.

No legacy launcher PNG, added artwork, frame, shadow or guessed manufacturer mask.
Pillow and CairoSVG are developer-only tools, never application dependencies.
"""
from pathlib import Path
from io import BytesIO
import base64,json,xml.etree.ElementTree as ET
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def configuration():return json.loads((ROOT/'packaging/icons/android16-adaptive.json').read_text())
def background_color():
 p=ROOT/'android/app/src/main/res/values/ic_launcher_background.xml'
 return ET.parse(p).find("color[@name='ic_launcher_background']").text.strip()
def reference_svg(size=512):
 c=configuration();foreground=base64.b64encode((ROOT/c['foreground']).read_bytes()).decode()
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="{size}" height="{size}"><defs><clipPath id="android16"><path d="{c["maskPath"]}"/></clipPath></defs><g clip-path="url(#android16)"><rect width="100" height="100" fill="{background_color()}"/><image x="-25" y="-25" width="150" height="150" href="data:image/png;base64,{foreground}"/></g></svg>\n'
def compose(masked=True):
 c=configuration();assert c['extraInsetPercentage']==0.25 and c['viewportScale']==2/3
 foreground=Image.open(ROOT/c['foreground']).convert('RGBA')
 image=Image.new('RGBA',(512,512),background_color())
 # AdaptiveIconDrawable expands each child by 25% on every side (1.5x).
 layer=foreground.resize((768,768),Image.Resampling.LANCZOS)
 image.alpha_composite(layer,(-128,-128))
 if masked:
  import cairosvg
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="white" d="{c["maskPath"]}"/></svg>'
  mask=Image.open(BytesIO(cairosvg.svg2png(bytestring=svg.encode(),output_width=2048,output_height=2048))).convert('RGBA').getchannel('A').resize((512,512),Image.Resampling.LANCZOS)
  image.putalpha(mask)
 return image
