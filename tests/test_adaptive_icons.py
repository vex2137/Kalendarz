"""Independent geometry/source regressions for Android 16 adaptive composition."""
import unittest,importlib.util,json,hashlib,xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image,ImageChops
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('adaptive',ROOT/'scripts/android-adaptive-icon.py');adaptive=importlib.util.module_from_spec(spec);spec.loader.exec_module(adaptive)
class AdaptiveIcons(unittest.TestCase):
 def test_original_android_layers_and_background_are_preserved(self):
  c=adaptive.configuration();p=ROOT/c['foreground'];self.assertEqual(hashlib.sha256(p.read_bytes()).hexdigest(),'bd24fd383253bf8d43f0a81f11c071d76d1d555114376dd647cd9fb38fa0a9da');self.assertEqual(adaptive.background_color(),'#FFFFFF')
  doc=ET.parse(ROOT/c['adaptiveXml']);self.assertEqual(doc.find('foreground').attrib['{http://schemas.android.com/apk/res/android}drawable'],'@mipmap/ic_launcher_foreground')
 def test_exact_android16_aosp_mask_and_viewport_are_pinned(self):
  c=adaptive.configuration();self.assertEqual(c['maskPath'],'M50,0L92,0C96.42,0 100,4.58 100 8L100,92C100, 96.42 96.42 100 92 100L8 100C4.58, 100 0 96.42 0 92L0 8 C 0 4.42 4.42 0 8 0L50 0Z');self.assertEqual(c['extraInsetPercentage'],0.25);self.assertEqual(c['viewportScale'],2/3);self.assertIn('android-16.0.0_r1',c['platformReference'])
 def test_sign_uses_adaptive_viewport_not_legacy_frame_or_proportions(self):
  image=adaptive.compose();points=[(x,y) for y in range(512) for x in range(512) if (lambda c:c[0]<150 and c[1]>125 and c[2]>170 and c[3]>200)(image.getpixel((x,y)))];xs,ys=zip(*points);width=max(xs)+1-min(xs);self.assertTrue(278<=width<=284,width);self.assertLess(abs((min(xs)+max(xs))/2-255.5),1);self.assertLess(abs((min(ys)+max(ys))/2-255.5),1)
  self.assertEqual(image.getpixel((256,0)),(255,255,255,255));self.assertEqual(image.getpixel((256,511)),(255,255,255,255))
 def test_masked_desktop_and_full_bleed_pwa_have_same_artwork(self):
  masked=adaptive.compose();full=adaptive.compose(False);self.assertEqual(masked.getpixel((0,0))[3],0);self.assertEqual(full.getpixel((0,0))[3],255);self.assertEqual(masked.crop((64,64,448,448)).tobytes(),full.crop((64,64,448,448)).tobytes())
 def test_published_svg_embeds_original_foreground_and_platform_transform(self):
  svg=(ROOT/'public/icon.svg').read_text();self.assertEqual(svg,adaptive.reference_svg());self.assertIn('x="-25" y="-25" width="150" height="150"',svg);self.assertNotIn('ic_launcher.png',svg)
 def test_generation_is_deterministic_and_does_not_reuse_legacy_png(self):
  self.assertEqual(adaptive.compose().tobytes(),adaptive.compose().tobytes());old=Image.open(ROOT/'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS);self.assertNotEqual(adaptive.compose().tobytes(),old.tobytes())
if __name__=='__main__':unittest.main()
