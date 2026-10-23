# Download the Android AI diagnostics build

Open the successful **Android AI diagnostics APK** run on GitHub Actions while
signed in to GitHub. Under **Artifacts**, download
**Calendar-AI-diagnostics-android**. GitHub provides a ZIP containing
`Calendar-AI-diagnostics.apk`, `SHA256SUMS.txt`, `BUILD-INFO.json`, this guide and
the physical acceptance instructions (`assistant-device-investigation.md`).
Artifacts expire after 30 days.

On the phone, extract the ZIP, open the APK, and allow installation from the
browser/file manager if Android asks. The launcher label is **Calendar AI
diagnostics**. It installs as `com.kalendarz.offline.diagnostics`, alongside the
regular app, with separate data. It uses a temporary debug signing key; if a
future diagnostic build has a different key, export diagnostic data before
uninstalling the old diagnostic app and installing the new one.

The APK contains verified LFM2.5 350M Q4_K_M weights and the upstream license;
no model download is needed on the phone. On POCO X7 Pro, enable airplane mode,
open **Assistant → AI diagnostics → Device test: cold + warm**, then repeat with
**Compare with one CPU thread**. Export the diagnostic JSON for each run and
record Android/System WebView versions and battery/thermal conditions.

For the greeting/language regression, follow
[the physical acceptance steps](assistant-device-investigation.md). Diagnostics
now show the source commit and the last message's quick/rules/model path.

The workflow builds the triggering commit on `optimize/lfm25-parser-runtime`.
It runs on code pushes to that branch and supports manual dispatch when GitHub
exposes the workflow in the Actions UI. A completed run can also be rerun from
its run page. This is a diagnostic artifact, not an official application release.
