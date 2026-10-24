"""Optional ADB sampler for app and explicitly identified WebView renderer PIDs.

Run while the on-phone benchmark is active. No root or app release is required.
The sampler never reads the calendar or chat database and never uploads results.
"""
import argparse
import datetime
import json
from pathlib import Path
import re
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--adb', default='adb')
parser.add_argument('--package', default='com.kalendarz.offline.diagnostics')
parser.add_argument('--renderer-pids', type=int, nargs='*', default=[])
parser.add_argument('--duration', type=int, default=300)
parser.add_argument('--interval', type=float, default=2)
parser.add_argument('--output', default='android-process-benchmark.json')
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z][\w]*(?:\.[\w]+)+', args.package):
    parser.error('Invalid package')
if not 1 <= args.duration <= 21600 or not 0.5 <= args.interval <= 60:
    parser.error('Duration/interval outside supported range')

def shell(*command):
    result = subprocess.run([args.adb, 'shell', *command], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout

main = shell('pidof', args.package).strip().split()
if not main:
    parser.error('Start the diagnostic app on an ADB-connected device first')
pids = sorted(set([int(pid) for pid in main] + args.renderer_pids))
report = {'version': 1, 'package': args.package, 'pids': pids,
          'coverage': 'app plus user-selected renderer PIDs; completeness is not assumed',
          'physicalDeviceVerified': False, 'startedAtUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'model': shell('getprop', 'ro.product.model').strip(),
          'webView': shell('dumpsys', 'webviewupdate'), 'samples': []}
destination = Path(args.output)
end = time.monotonic() + args.duration
try:
    while time.monotonic() < end:
        sample = {'hostTimeUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'processes': []}
        cpu = shell('dumpsys', 'cpuinfo')
        for pid in pids:
            memory = shell('dumpsys', 'meminfo', str(pid))
            pss = re.search(r'TOTAL PSS:\s*(\d+)', memory) or re.search(r'^\s*TOTAL\s+(\d+)', memory, re.MULTILINE)
            utilization = re.search(r'([\d.]+)%\s+' + str(pid) + r'/', cpu)
            sample['processes'].append({'pid': pid, 'pssKB': int(pss[1]) if pss else None,
                                        'cpuPercentAsReported': float(utilization[1]) if utilization else None})
        sample['selectedGroupPssKB'] = sum(item['pssKB'] for item in sample['processes']) if all(item['pssKB'] is not None for item in sample['processes']) else None
        sample['battery'] = shell('dumpsys', 'battery')
        report['samples'].append(sample)
        with destination.with_suffix('.jsonl').open('a') as journal:
            journal.write(json.dumps(sample) + '\n')
        time.sleep(min(args.interval, max(0, end-time.monotonic())))
except KeyboardInterrupt:
    pass
finally:
    destination.write_text(json.dumps(report, indent=2) + '\n')
print(f'Saved {len(report["samples"])} actual ADB samples to {destination}')
