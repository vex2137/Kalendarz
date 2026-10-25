# KALENDARZ 1.4.1 BETA 2 — existing AI actions regression fixes

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. No release or push was performed.

## Confirmed defects and fixes

1. **Export JSON:** the click handler existed, but used a `blob:` download link. Android WebView had no native document-save path for it. The handler also had no visible outcome or exception handling. Android now uses the existing CalendarDevice bridge and `ACTION_CREATE_DOCUMENT` with JSON MIME type. A bounded valid JSON report is written off the UI thread to the selected `content://` document. Success is acknowledged only after writing and closing; cancel, missing bridge, picker failure and write failure have visible outcomes. Web/desktop retain browser download dispatch and report that dispatch, without claiming a confirmed disk write.
2. **Release memory:** the click handler existed, but discarded its promise and gave no feedback. `disposeEngine()` swallowed exit failures and cleared its handle before confirmed shutdown. It now keeps the handle/residency on failure, shares concurrent shutdown attempts, propagates errors and allows a controlled retry. The explicit action verifies the native backend state, handles an already-unloaded model, bounds its wait and prevents automatic preload on resume until the next explicit load/request. Installed model files are retained.
3. **Import GGUF:** the prior beta's bounded metadata/hash imports remain in place. This patch adds visible progress, success, cancellation and errors, including native picker/token release errors. A successful storage operation is labelled separately from actual engine compatibility. Regressions cover Q4_K_M/IQ4_XS metadata, streaming through the Android picker proxy, expired document access, source/old-model preservation and restart. Actual user Qwen files and physical SAF were not available here.
4. **Download models:** the runtime previously converted installation exceptions to state alone, allowing callers to treat a failed promise as successful. Installation now rejects failures explicitly; the UI shows the HTTP/storage/cancel outcome. Local tests cover HTTP 404 and 403, incomplete bodies, network exceptions, checksum errors, quota, cancellation and transaction preservation. Live Hugging Face verification remains blocked by the environment's network policy; the actual reported remote 404 URL is not declared repaired.

A bounded 100-event diagnostics history records click, start, native-bridge call, success, cancellation and error codes. It contains no prompts, JSON payloads, document URIs or signed download URLs. The exported report schema is version 4. Android Logcat uses `CalendarDiagnostics` stage messages without report contents. Feedback is available in Polish, English, German and Russian.

## Verification performed

- 135 application unit tests passed; 24 native/storage/folder unit tests passed. Zero final unit failures or skips.
- TypeScript check passed.
- `tests/diagnostics-actions-browser.cjs`: real production click handlers, actual browser JSON download, native proxy save/cancel/write/missing-bridge outcomes, confirmed RAM-state transitions, shutdown error/retry and no automatic reload after manual release passed. Proxy fault injection is UI/control-flow evidence, not Android hardware evidence.
- `tests/model-actions-browser.cjs`: real model-manager controls, injected HTTP 404 with no false success, Android picker proxy/streamed GGUF storage, expired grant with prior model retention, token cleanup and picker cancellation passed.
- `tests/gguf-import-browser.cjs`: Q4_K_M/IQ4_XS synthetic metadata imports, independent content hashes, both OPFS writers, original-file preservation and restart passed. These fixtures are never inference evidence.
- `tests/model-storage-browser.cjs`: both OPFS writers passed HTTP, network, truncation, checksum, cancellation, quota and failed-replacement checks.
- Official Web 1.4.0 → beta 2 same-origin upgrade/restart preserved recurring events, reminders, theme, language, settings, AI history, model identity and stored model bytes.
- Android beta APK and instrumentation APK compiled. `DiagnosticsActionsTest` prepares real WebView-to-Capacitor-to-document-write tests, with injected SAF picker results, plus cancel/write-failure/release feedback cases. No Android device/emulator was available, so these instrumentation tests were compiled but **not executed**.
- No new physical GPU testing or backend expansion was undertaken in this follow-up. Existing experimental runtime and release gates remain.

## Package

Main APK: `release/KALENDARZ-1.4.1-BETA-2.apk`.

Device tests: `release/KALENDARZ-1.4.1-BETA-2-device-tests.apk`.

Launcher/application label: **KALENDARZ 1.4.1 BETA 2**, including locale aliases. Android version name: `1.4.1 beta 2`; version code: **10402**. The production package remains 1.4.1/10401. The existing diagnostic application ID `com.kalendarz.offline.diagnostics` and its existing test signing are retained. No event schema or original-model-file changes were made. ARM64 native runtime and WASM fallback remain; no weights are bundled.

Install over the previous beta using `adb install -r release/KALENDARZ-1.4.1-BETA-2.apk`, or open the APK and accept the Android update. Do not uninstall or clear app data. The main APK updates the earlier beta and remains separate from the official application.

On a disposable Android test device, install the instrumentation APK and run:

```sh
adb install -r release/KALENDARZ-1.4.1-BETA-2-device-tests.apk
adb shell am instrument -w -e class com.kalendarz.offline.DiagnosticsActionsTest com.kalendarz.offline.diagnostics.test/androidx.test.runner.AndroidJUnitRunner
```

Manual acceptance on the user's phone: open AI diagnostics; Export JSON must open the Android file-location picker and show saved/cancel/error after it returns. Release memory must show progress and a confirmed unloaded/already-unloaded state or a clear error. Re-test both original Qwen imports and each failing download, then export JSON to inspect the recorded stage/error code. These physical checks and live download verification remain required before closing all four device-reported release blockers.

## Rebuild

Reuse the verified staged native runtime; rebuilding llama.cpp is unnecessary for these JS/Java fixes.

```sh
node scripts/prepare-beta-apk.cjs
CALENDAR_BETA_APK=true CALENDAR_ANDROID_NATIVE=true node node_modules/vite/bin/vite.js build
npx cap sync android
cd android
bash gradlew :app:assembleDiagnostics :app:assembleDiagnosticsAndroidTest -PcalendarBeta=true -PcalendarAndroidTestBuildType=diagnostics --no-daemon --max-workers=2
```
