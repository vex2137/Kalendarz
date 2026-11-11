"""Reuse prior model validation only when application/AI/data code is unchanged."""
from pathlib import Path
import subprocess,json
ROOT=Path(__file__).resolve().parents[1]
BASE='aa90a317c9e89ae8ef984de6e435df6f4604eb28'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT,text=True)
files=git('diff','--name-only',BASE,'HEAD').splitlines()
allowed={'index.html','vite.config.ts','scripts/render-desktop-icons.cjs','scripts/check-canonical-icons.py','scripts/check-windows-icon.ps1','scripts/check-icon-change-scope.py','scripts/canonical-icons-private-build.yml','scripts/upload-private-icon-packages.py','tests/desktop-packaging.test.ts','tests/linux-desktop-icons.cjs','tests/windows-packages.cjs','tests/flatpak-packaged.cjs','tests/icon-web-package.cjs','tests/test_canonical_icons_x11.py','docs/reports/android-canonical-icons.md'}
assert files and all(f in allowed or f.startswith('packaging/icons/') or f in ['public/icon.svg','public/desktop-icon.png','public/pwa-192x192.png','public/pwa-512x512.png','public/apple-touch-icon.png','public/favicon.ico','public/favicon-32x32.png'] for f in files),files
base=git('show',BASE+':vite.config.ts');expected=base.replace("          'icon.svg',","          'icon.svg',\n          'favicon.ico',\n          'favicon-32x32.png',");assert (ROOT/'vite.config.ts').read_text()==expected
base=git('show',BASE+':index.html');expected=base.replace('<link rel="icon" type="image/svg+xml" href="./icon.svg" />','<link rel="icon" href="./favicon.ico" sizes="16x16 24x24 32x32 48x48 64x64 128x128 256x256" />\n    <link rel="icon" type="image/png" href="./favicon-32x32.png" sizes="32x32" />');assert (ROOT/'index.html').read_text()==expected
assert not git('diff','--name-only',BASE,'HEAD','--','src','electron','android','package.json','bun.lock','scripts/native-runtime-manifest.json').strip()
print(json.dumps(dict(status='PASS',applicationCodeUnchangedFrom=BASE,priorRealQwenRun=42894252025,androidResourcesUnchanged=True,changedFiles=len(files))))
