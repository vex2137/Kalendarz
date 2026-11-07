"""Independent Android-only Beta 5 guard; the paired Beta 2 policy stays intact."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import zipfile
from part2_artifact_guard import ROOT, expected_source, verify_info

CERT = 'ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143'
RUNTIME_COMMIT = '80d2c0c2c56e4a1bbf74be98f64b99927bf230bc'
SOURCE_SHA256 = 'e9bf2b83a13e14b5577dcdb65bb18ff8c049143caab22106547d37ef8c54fbf3'
NAME = 'Kalendarz-1.5.0-Part-2-Beta-5-Android-arm64.apk'


def policy():
    value = json.loads((ROOT / 'scripts/android-beta5-version.json').read_text())
    code, previous = value['versionCode'], value['lastTestedVersionCode']
    if type(code) is not int or type(previous) is not int or previous < 10515 or code <= previous:
        raise ValueError('Android Beta 5 must increase the last tested versionCode')
    if value['versionName'] != '1.5.0-part2-beta.5':
        raise ValueError('Unexpected Android beta label')
    return value


def identity(badging):
    value = policy()
    expected = "name='com.kalendarz.offline.diagnostics' versionCode='{}' versionName='{}'".format(value['versionCode'], value['versionName'])
    if expected not in badging:
        raise ValueError('Android application ID/version mismatch')


def verify_apk(apk, source, tools):
    def run(*args):
        return subprocess.check_output(list(map(str, args)), text=True)
    certs = run(tools / 'apksigner', 'verify', '--verbose', '--print-certs', apk)
    if 'certificate SHA-256 digest: ' + CERT not in certs:
        raise ValueError('Existing Android update certificate is required')
    identity(run(tools / 'aapt', 'dump', 'badging', apk))
    run(tools / 'zipalign', '-c', '-P', '16', '4', apk)
    with zipfile.ZipFile(apk) as z:
        if z.testzip() or any(n.lower().endswith(('.gguf', '.p12', '.jks', '.keystore')) for n in z.namelist()):
            raise ValueError('Corrupt APK or forbidden weights/signing material')
        verify_info(json.loads(z.read('assets/public/build-info.json')), source, android=True)
        native = [n for n in z.namelist() if n.startswith('lib/')]
        if native != ['lib/arm64-v8a/libcalendar_llama.so']:
            raise ValueError('Unexpected native ABI or library payload')
        binary = z.read(native[0])
        if binary[:6] != b'\x7fELF\x02\x01' or binary[16:20] != b'\x03\x00\xb7\x00':
            raise ValueError('The runtime must be an Android AArch64 PIE executable')
        runtime = json.loads(z.read('assets/android-native-runtime.json'))
        if (runtime.get('llamaCommit') != RUNTIME_COMMIT or runtime.get('llamaVersion') != 'b12189' or
                runtime.get('abi') != 'arm64-v8a' or runtime.get('backends') != ['cpu-native'] or
                runtime.get('architectures') != ['lfm3', 'qwen35'] or
                runtime.get('binarySha256') != hashlib.sha256(binary).hexdigest() or
                runtime.get('sources') != [{'url': 'https://codeload.github.com/ggml-org/llama.cpp/tar.gz/' + RUNTIME_COMMIT, 'sha256': SOURCE_SHA256}]):
            raise ValueError('Android runtime provenance/hash mismatch')
    with apk.open('rb') as stream:
        checksum = hashlib.file_digest(stream, 'sha256').hexdigest()
    return dict(file=apk.name, bytes=apk.stat().st_size, sha256=checksum, source=source,
                package='com.kalendarz.offline.diagnostics', versionCode=policy()['versionCode'],
                certificateSha256=CERT, runtime=runtime)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True)
    p.add_argument('--check-remote', action='store_true')
    p.add_argument('--info', type=Path)
    p.add_argument('--platform', choices=['android'])
    p.add_argument('--apk', type=Path)
    args = p.parse_args()
    expected_source(args.source, args.check_remote)
    result = dict(source=args.source, **policy())
    if args.info:
        verify_info(json.loads(args.info.read_text()), args.source, android=True)
    if args.apk:
        if args.apk.name != NAME:
            raise ValueError('Unexpected artifact filename')
        result = verify_apk(args.apk, args.source, Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0')
        args.apk.with_suffix('.apk.sha256').write_text(result['sha256'] + '  ' + args.apk.name + '\n')
        args.apk.with_suffix('.apk.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
