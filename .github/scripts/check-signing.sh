#!/usr/bin/env bash
set -euo pipefail
set +x
for name in CALENDAR_ANDROID_KEYSTORE_BASE64 CALENDAR_KEYSTORE_PASSWORD CALENDAR_KEY_ALIAS CALENDAR_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "::error::Required Android signing secret is unavailable: $name"
    exit 1
  fi
done
umask 077
export CALENDAR_KEYSTORE_PATH="$RUNNER_TEMP/calendar-release.p12"
trap 'rm -f "$CALENDAR_KEYSTORE_PATH"' EXIT
python3 - <<'PY'
import base64, os
from pathlib import Path
try:
    data = base64.b64decode(os.environ['CALENDAR_ANDROID_KEYSTORE_BASE64'], validate=True)
    if not data: raise ValueError()
    Path(os.environ['CALENDAR_KEYSTORE_PATH']).write_bytes(data)
except Exception:
    raise SystemExit('Invalid Android keystore encoding; no build is allowed.')
PY
java .github/scripts/VerifyAndroidSigning.java
