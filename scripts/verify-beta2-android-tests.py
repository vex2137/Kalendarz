"""Require the selected real Android WebView regression tests to execute."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

required = {
    "importNonCatalogueGgufThroughSafAndRetainAfterRestart",
    "nativeBridgeReportsExpiredTokensWithoutPrivatePaths",
    "safPickerStreamsContentUriAndReleasesAccess",
    "transferSurvivesStoppedActivityAndResumesAfterNotificationPause",
}
reports = list(Path("android/app/build/outputs/androidTest-results/connected").rglob("*.xml"))
cases = [case for path in reports for case in ET.parse(path).getroot().iter("testcase")]
failed = [case for case in cases if case.find("failure") is not None or case.find("error") is not None]
executed = {case.get("name") for case in cases if case.find("skipped") is None}
missing = required - executed
for case in failed:
    print(f"FAIL {case.get('classname')}.{case.get('name')}")
if missing:
    print("Required native tests did not execute:", ", ".join(sorted(missing)))
print(f"Android 16: {len(cases)} instrumentation cases; {len(failed)} failed; {len(missing)} required tests missing.")
sys.exit(bool(failed or missing))
