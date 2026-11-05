"""Verify both APK identities, then update the existing installation using adb install -r."""
import argparse
from pathlib import Path
import re
import subprocess
import tempfile
import importlib.util

spec = importlib.util.spec_from_file_location('verify_v142_install', Path(__file__).with_name('verify-android-v142.py'))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk', type=Path)
    parser.add_argument('--sdk', type=Path, required=True)
    parser.add_argument('--commit', required=True, help='Full source commit from the build run')
    parser.add_argument('--serial', help='ADB device serial (required if multiple devices are attached)')
    args = parser.parse_args()
    tools = args.sdk / 'build-tools/35.0.0'
    subprocess.run(['python3', str(Path(__file__).with_name('verify-android-v142.py')), str(args.apk.resolve()),
                    '--build-tools', str(tools), '--commit', args.commit], check=True)
    adb = [str(args.sdk / 'platform-tools/adb')]
    if args.serial: adb += ['-s', args.serial]

    def call(*parameters):
        return subprocess.check_output([*adb, *parameters], text=True).strip()

    verify.require(call('get-state') == 'device', 'An authorized ADB device is required')
    package = 'com.kalendarz.offline.diagnostics'
    paths = call('shell', 'pm', 'path', package).splitlines()
    paths = [line.removeprefix('package:') for line in paths if line.startswith('package:') and line.endswith('/base.apk')]
    verify.require(len(paths) == 1, 'Expected the existing diagnostics installation')
    with tempfile.TemporaryDirectory(prefix='calendar-update-check-') as directory:
        installed = Path(directory) / 'installed.apk'
        subprocess.run([*adb, 'pull', paths[0], str(installed)], check=True)
        certificate = subprocess.check_output([str(tools / 'apksigner'), 'verify', '--print-certs', str(installed)], text=True)
        badging = subprocess.check_output([str(tools / 'aapt'), 'dump', 'badging', str(installed)], text=True)
        digests = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})', certificate)
        verify.require(digests == [verify.CERTIFICATE], 'Installed certificate mismatch; update stopped')
        match = re.match(r"package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'", badging)
        verify.require(match is not None and match.groups() in [(package, '10406', '1.4.1'), (package, '10407', '1.4.2')],
                       'Unexpected installed package/version; update stopped')
    # No uninstall, clear, downgrade, alternate package ID or test-only flags.
    subprocess.run([*adb, 'install', '-r', str(args.apk.resolve())], check=True)
    info = call('shell', 'dumpsys', 'package', package)
    verify.require(re.search(r'\bversionCode=10407\b', info) and re.search(r'\bversionName=1\.4\.2(?=\s|$)', info),
                   'Post-install version check failed')
    print('Updated existing installation to 1.4.2/10407. Check retained data and offline PL/EN replies on the device.')


if __name__ == '__main__':
    main()
