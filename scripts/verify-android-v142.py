"""Fail closed before distributing the 1.4.2 update. Never signs or installs APKs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent.parent
CERTIFICATE = 'ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
MODEL_ID = 'kalendarz-qwen35-v2-q4-k-m'
MODEL_FILE = 'kalendarz-qwen35-v2-q4_k_m.gguf'
MODEL_BYTES = 529297056
MODEL_SHA256 = 'fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5'
LLAMA_COMMIT = '620d2225cc436ab0b001e3200e590e3b286ef9ab'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def release_model():
    model = json.loads((ROOT / 'src/utils/localModelManifest.json').read_text())
    require((model['id'], model['file'], model['bytes'], model['sha256'], model['revision'], model['url']) ==
            (MODEL_ID, MODEL_FILE, MODEL_BYTES, MODEL_SHA256, 'local-finetune-v142-v2', ''), 'Unexpected release model')
    require(json.loads((ROOT / 'package.json').read_text())['version'] == '1.4.2', 'Unexpected package version')
    return model


def verify_identity(badging, certificates):
    match = re.match(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
    require(match is not None and match.groups() == ('com.kalendarz.offline.diagnostics', '10407', '1.4.2'),
            'APK update package/version mismatch')
    digests = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})', certificates)
    require(digests == [CERTIFICATE], 'APK update certificate mismatch')


def verify_contents(apk, commit, model):
    with zipfile.ZipFile(apk) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), 'Duplicate APK entries')
        build = json.loads(archive.read('assets/public/build-info.json'))
        require(build.get('version') == '1.4.2' and build.get('dirty') is False and
                build.get('androidNative') is True and build.get('bundledModel') is not False and
                build.get('distribution') != 'model-free' and build.get('commit') == commit,
                'Unexpected APK build provenance/variant')
        manifest = json.loads(archive.read('assets/public/models/manifest.json'))
        require(manifest == {key: model[key] for key in ('file', 'bytes', 'sha256')}, 'Packaged manifest mismatch')
        catalogue = json.loads(archive.read('assets/public/models/catalogue.json'))
        require(catalogue[0] == model, 'Packaged default model mismatch')
        weight_path = 'assets/public/models/' + model['file']
        require([name for name in names if name.lower().endswith('.gguf')] == [weight_path],
                'APK must contain exactly the requested GGUF')
        info = archive.getinfo(weight_path)
        require(info.file_size == model['bytes'] and info.compress_type == zipfile.ZIP_STORED,
                'GGUF size/compression mismatch')
        with archive.open(weight_path) as stream:
            require(stream.read(4) == b'GGUF', 'Invalid GGUF magic')
        with archive.open(weight_path) as stream:
            require(hashlib.file_digest(stream, 'sha256').hexdigest() == model['sha256'], 'GGUF checksum mismatch')
        license_data = archive.read('assets/public/models/LICENSE.txt')
        require(hashlib.sha256(license_data).hexdigest() == model['licenseSha256'], 'Model license mismatch')
        require(model['revision'].encode() in archive.read('assets/public/models/NOTICE.txt'), 'Missing modification notice')
        binary = archive.read('lib/arm64-v8a/libcalendar_llama.so')
        require(len(binary) >= 64 and binary[:6] == b'\x7fELF\x02\x01' and
                struct.unpack_from('<H', binary, 18)[0] == 183, 'Missing/invalid ARM64 ELF engine')
        runtime = json.loads(archive.read('assets/android-native-runtime.json'))
        require(runtime['abi'] == 'arm64-v8a' and runtime['llamaCommit'] == LLAMA_COMMIT and
                runtime['binarySha256'] == hashlib.sha256(binary).hexdigest(), 'Native engine provenance mismatch')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    parser.add_argument('--build-tools', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    args = parser.parse_args()
    require(re.fullmatch(r'[0-9a-f]{40}', args.commit), 'A full source commit is required')
    model = release_model()

    def call(tool, *parameters):
        return subprocess.check_output([str(args.build_tools / tool), *map(str, parameters)], text=True)

    verify_identity(call('aapt', 'dump', 'badging', args.apk),
                    call('apksigner', 'verify', '--verbose', '--print-certs', args.apk))
    call('zipalign', '-c', '-P', '16', '4', args.apk)
    verify_contents(args.apk, args.commit, model)
    with args.apk.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    args.apk.with_suffix('.apk.sha256').write_text(f'{digest}  {args.apk.name}\n')
    print('Verified 1.4.2/10407, existing package/certificate, bundled Qwen v2, ARM64 engine and alignment.')


if __name__ == '__main__':
    main()
