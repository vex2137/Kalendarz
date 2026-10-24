#!/usr/bin/env bash
set -euo pipefail
apk=android/app/build/outputs/apk/release/app-release.apk
old_apk="$RUNNER_TEMP/calendar-official-1.4.0.apk"
test_apk=android/app/build/outputs/apk/androidTest/release/app-release-androidTest.apk
curl --fail --location --retry 2 --output "$old_apk" https://github.com/vex2137/Kalendarz/releases/download/v1.4.0/Calendar-1.4.0-android.apk
echo 'b1065426530dd46a2f3bf2790e0571f3bc24d46660271a28a12b34e96dfce674  '"$old_apk" | sha256sum -c -
node scripts/verify-android-signature.cjs "$old_apk"
node scripts/verify-android-signature.cjs "$apk"
for candidate in "$old_apk" "$apk"; do
  # Read the full output: head can close the pipe early and SIGPIPE aapt.
  "$ANDROID_HOME/build-tools/35.0.0/aapt" dump badging "$candidate" | sed -n '1p'
done
adb install -r "$old_apk"
adb install -r "$test_apk"
run_stage() {
  local stage="$1"
  local output="$RUNNER_TEMP/upgrade-$stage.txt"
  adb shell am instrument -w -r -e class "com.kalendarz.offline.CalendarUpgradeTest#$stage" com.kalendarz.offline.test/androidx.test.runner.AndroidJUnitRunner | tee "$output"
  grep -F 'OK (1 test)' "$output"
  if grep -E 'FAILURES|INSTRUMENTATION_FAILED|shortMsg=' "$output"; then exit 1; fi
}
run_stage seedOfficial140
adb shell am force-stop com.kalendarz.offline
# This install must succeed without an uninstall, proving matching signing identity.
adb install -r "$apk"
run_stage verifyUpgrade141
printf '%s\n' 'Verified official 1.4.0 → 1.4.1 in-place update: event, times, settings, language, custom palette, model choice, downloaded weights and AI history retained.'
