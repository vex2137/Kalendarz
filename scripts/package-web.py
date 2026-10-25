"""Package the explicit production Web distribution without deploying a site."""
import argparse
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--dist', type=Path, default=ROOT / 'dist')
parser.add_argument('--output', type=Path, default=ROOT / 'release/KALENDARZ-1.4.1-WEB.zip')
args = parser.parse_args()
build = json.loads((args.dist / 'build-info.json').read_text())
version = json.loads((ROOT / 'package.json').read_text())['version']
if build['version'] != version or build.get('androidNative') or build.get('dirty') or build.get('distribution') != 'model-free':
    raise SystemExit('Rebuild a clean, explicit production Web distribution before packaging')
files = sorted(p for p in args.dist.rglob('*') if p.is_file())
if any(p.is_symlink() or p.suffix.lower() == '.gguf' for p in files):
    raise SystemExit('Web deployment archive must not contain symlinks or model weights')
readme = '''# KALENDARZ 1.4.1 Web deployment

Extract this archive into the document root of an HTTPS static host. No site has
been published by creating this artifact. Keep the existing origin and URL scope
when updating an installed PWA so its IndexedDB/OPFS data remain accessible.

Serve .js as JavaScript and .wasm as application/wasm. Send these headers on the
HTML, scripts, workers and WASM responses:

Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp

_headers is an example for hosts supporting that format. nginx.example.conf is a
static-origin example; put HTTPS in front of it in production. Avoid stale index.html
and sw.js caches. Service-worker installation enables offline application use.

This distribution contains both CPU WebAssembly runtimes and no model weights.
Import/download a supported GGUF after first installation. Previously installed
models and data stay in browser storage; do not clear that storage during upgrade.
GPU-only reports unavailable without a native bridge; no browser GPU acceleration
is claimed. Native Vulkan/CUDA belongs to the desktop/Android distributions.

LICENSE contains the application's unchanged MIT license. build-info.json records
the application source commit and production variant. Verify the download using the
release SHA-256 checksum file before deployment.
'''
nginx = '''server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;
    location / { try_files $uri $uri/ /index.html; }
    location = /sw.js { expires -1; }
    location = /index.html { expires -1; }
}
'''
args.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in files:
        archive.write(file, file.relative_to(args.dist).as_posix())
    archive.writestr('DEPLOYMENT.md', readme)
    archive.writestr('nginx.example.conf', nginx)
    archive.writestr('_headers', '/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n')
    archive.writestr('LICENSE', (ROOT / 'LICENSE').read_bytes())
print(json.dumps({'artifact': str(args.output), 'version': version, 'sourceCommit': build['commit'], 'files': len(files), 'deployed': False}))
