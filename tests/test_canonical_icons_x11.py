"""X11 reader regression; a fixture window is not evidence of app icon integration."""
import ctypes,ctypes.util,json,os,subprocess,sys,unittest
from pathlib import Path
try:
 from PIL import Image
except ImportError:
 Image=None
ROOT=Path(__file__).resolve().parents[1]
@unittest.skipUnless(os.environ.get('DISPLAY') and Image is not None,'Requires X11 and Pillow; private packaging supplies both')
class X11IconReadTest(unittest.TestCase):
 def setUp(self):
  x=self.x=ctypes.CDLL(ctypes.util.find_library('X11'))
  x.XOpenDisplay.argtypes=[ctypes.c_char_p];x.XOpenDisplay.restype=ctypes.c_void_p;self.display=x.XOpenDisplay(None);self.assertTrue(self.display)
  x.XDefaultRootWindow.argtypes=[ctypes.c_void_p];x.XDefaultRootWindow.restype=ctypes.c_ulong
  x.XCreateSimpleWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_uint,ctypes.c_uint,ctypes.c_uint,ctypes.c_ulong,ctypes.c_ulong];x.XCreateSimpleWindow.restype=ctypes.c_ulong
  self.window=x.XCreateSimpleWindow(self.display,x.XDefaultRootWindow(self.display),0,0,100,100,0,0,0)
  x.XInternAtom.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_int];x.XInternAtom.restype=ctypes.c_ulong
  x.XChangeProperty.argtypes=[ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.POINTER(ctypes.c_ubyte),ctypes.c_int]
  x.XSync.argtypes=[ctypes.c_void_p,ctypes.c_int];x.XDestroyWindow.argtypes=[ctypes.c_void_p,ctypes.c_ulong];x.XCloseDisplay.argtypes=[ctypes.c_void_p]
 def tearDown(self):self.x.XDestroyWindow(self.display,self.window);self.x.XCloseDisplay(self.display)
 def check(self,image):
  values=[512,512]+[(a<<24)|(r<<16)|(g<<8)|b for r,g,b,a in image.getdata()];data=(ctypes.c_ulong*len(values))(*values)
  self.x.XChangeProperty(self.display,self.window,self.x.XInternAtom(self.display,b'_NET_WM_ICON',0),6,32,0,ctypes.cast(data,ctypes.POINTER(ctypes.c_ubyte)),len(values));self.x.XSync(self.display,0)
  return subprocess.run([sys.executable,str(ROOT/'scripts/check-canonical-icons.py'),'--x11-window',hex(self.window)],cwd=ROOT,capture_output=True,text=True)
 def test_full_512_icon_is_read_without_xprop_default_truncation(self):
  result=self.check(Image.open(ROOT/'public/desktop-icon.png').convert('RGBA'));self.assertEqual(result.returncode,0,result.stderr);report=json.loads(result.stdout);self.assertEqual(report['x11WindowIcon']['size'],512);self.assertEqual(report['x11WindowIcon']['meanChannelError'],0)
 def test_wrong_window_icon_is_rejected(self):
  result=self.check(Image.new('RGBA',(512,512),'red'));self.assertNotEqual(result.returncode,0);self.assertIn('AssertionError',result.stderr)
if __name__=='__main__':unittest.main()
