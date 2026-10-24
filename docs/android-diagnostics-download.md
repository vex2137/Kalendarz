# Download the Android AI diagnostics build

The current POCO follow-up candidate uses Qwen Q4_K_M as the preferred optional
model and retains bundled 350M as fallback. See [persistent-model tests and phone
steps](ai-140-poco-followup.md). Saved manual selections are preserved. Qwen weights
are not bundled or automatically downloaded.

For the 1.4.0 AI Update candidate, follow [the acceptance checklist](ai-140-acceptance.md).
Models and diagnostics now open in Assistant → AI settings, in separate tabs.
The source branch is `fix/ai-140-diagnostics`; the base package version remains
1.3.1-diagnostics until an official release is authorized.

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

The workflow builds the triggering commit on `optimize/lfm25-parser-runtime`
or `feat/local-ai-models-history`. The latter also includes optional model
management, durable chats and the bilingual benchmark. The ZIP includes
`multimodel-progress.md` with the phone comparison procedure. Larger models
are installed explicitly from the model panel; they are not bundled or
downloaded automatically.

It runs on code pushes to those branches and supports manual dispatch when GitHub
exposes the workflow in the Actions UI. A completed run can also be rerun from
its run page. This is a diagnostic artifact, not an official application release.
