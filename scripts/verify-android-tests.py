"""Require the actual release WebView smoke test to execute and pass."""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET


def annotation(message):
    message = message.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::error title=Android tests::{message}")


reports = list(Path("android/app/build/outputs/androidTest-results/connected").rglob("*.xml"))
cases = [case for report in reports for case in ET.parse(report).getroot().iter("testcase")]
failed = False
for case in cases:
    for failure in [*case.findall("failure"), *case.findall("error")]:
        annotation(f"{case.get('classname')}.{case.get('name')}: {failure.get('message', '')}\n{(failure.text or '')[:2000]}")
        failed = True
smoke = [case for case in cases if case.get("name") == "createsPersistsAndDisplaysVersion"]
if not smoke or all(case.find("skipped") is not None for case in smoke):
    annotation("The release APK create/save/reload/version test did not execute.")
    failed = True
print(f"Android: {len(cases)} test cases, {len(smoke)} release WebView smoke test(s).")
sys.exit(1 if failed else 0)
