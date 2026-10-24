#!/usr/bin/env bash
set -uo pipefail
log_file="${RUNNER_TEMP:-/tmp}/kalendarz-android-test.log"
cd android
bash ./gradlew connectedReleaseAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=com.kalendarz.offline.CalendarSmokeTest -PcalendarTestSigning=true -PcalendarAndroidTestBuildType=release --no-daemon --console=plain 2>&1 | tee "$log_file"
test_status=${PIPESTATUS[0]}
if [ "$test_status" -ne 0 ]; then
  python3 - "$log_file" <<'PY'
from pathlib import Path
import subprocess, sys
def error(message):
    message = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print('::error title=Android instrumentation::' + message)
text = Path(sys.argv[1]).read_text(errors='replace')
start = text.rfind('FAILURE:')
error(text[start:start + 6000] if start >= 0 else text[-6000:])
crash = subprocess.run(['adb', 'logcat', '-d', '-s', 'AndroidRuntime:E'], capture_output=True, text=True)
if crash.stdout.strip():
    error(crash.stdout[-6000:])
PY
fi
exit "$test_status"
