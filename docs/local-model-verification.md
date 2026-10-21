# LFM2.5 offline verification — 2026-10-21

Base integration: `987c7937434df2109ff501431dc7ebaa8cbd5034`, fetched from `feature/navigation-themes-encrypted-sync` and fast-forwarded into the clean `work` checkout. The fixes remain local. No release was published.

## Environment and actual weights

- Linux, Chromium 154, AMD EPYC 9V74; four CPU cores of quota, four inference threads, cross-origin isolation enabled.
- Official LFM2.5 350M Q4_K_M GGUF: 229,312,224 bytes.
- SHA-256: `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`.
- Real wllama/llama.cpp WASM inference. No canned model responses or remote inference.

## Initial Polish verification

```sh
npm run lint
npm test
npm run build
CALENDAR_MODEL_FILE=/workspace/models/LFM2.5-350M-Q4_K_M.gguf \
  MODEL_TEST_SCREENSHOT=/workspace/artifacts/lfm2.5-offline.png npm run test:model
```

TypeScript and production build passed. All 82 unit tests passed. The complete real-model browser test passed. A separate missing-weights check verified that `test:model` exits nonzero before launching inference when `CALENDAR_MODEL_FILE` is absent.

The browser imported the verified weights into IndexedDB, waited for service-worker installation, disconnected from the network, reloaded offline and then ran all requests below. No external HTTP requests were attempted during the offline scenarios. Calendar mutations required explicit confirmations; proposals alone did not alter stored records. Model persistence, deletion/undo, event identity, exact titles, dates, times and preserved duration were checked.

| Polish request | Verified result | End-to-end response | Longest UI frame |
| --- | --- | ---: | ---: |
| Dodaj wydarzenie Dentysta jutro o 15:00 do 16:00 | Create Dentysta: 2026-10-22, 15:00–16:00 | 29.73 s | 47 ms |
| Przenieś wydarzenie Dentysta na 2026-10-24 o 14:00 | Move same ID: 2026-10-24, 14:00–15:00 | 4.57 s | 33 ms |
| Znajdź wydarzenie Dentysta | Return saved Dentysta; no mutation | 1.88 s | 50 ms |
| Usuń wydarzenie Dentysta | Explicit deletion confirmation, then undo restores event | 3.15 s | 25 ms |
| Dodaj wydarzenie Trening pojutrze o 18:30 do 19:30 | Trening: 2026-10-23, 18:30–19:30 | 4.34 s | 36 ms |
| Dodaj wydarzenie Przegląd w piątek o 09:15 do 10:15 | Przegląd: Friday 2026-10-23, 09:15–10:15 | 4.02 s | 37 ms |
| Dodaj wydarzenie Dyżur 2026-10-31 o 23:30 | Dyżur: 2026-10-31 23:30 → 2026-11-01 00:30 | 4.98 s | 32 ms |
| Dodaj wydarzenie Kontrola jutro o 09:00 do 10:00 | Kontrola: 2026-10-25, 09:00–10:00; Warsaw DST boundary | 22.13 s | 38 ms |

The first request took 29.73 seconds including verification/loading and an uncached prompt. Subsequent requests with the same system prefix took 1.88–4.98 seconds. Changing the simulated current date invalidated the cached prefix and took 22.13 seconds with weights already loaded. The maximum observed animation-frame gap was 50 ms. These are measurements on this executor, not device-wide latency or memory guarantees.

## Fixes exercised

The extraction schema allows omission of unspecified fields instead of forcing fourteen generated values. Date/time shapes remain constrained, and the adapter checks calendar validity, normalizes absent text fields and blocks ungrounded optional details. Calendar date calculations are supplied as prompt facts and checked against model output. Native chat roles preserve bounded conversation context. Duration defaults and existing durations take precedence over unsolicited model end values. Generic event nouns and relative-date title suffixes are normalized conservatively; quoted titles are preserved. Single-day searches now exclude later events and retain events spanning that day (unit regression).

## Scope

These selected Polish commands validate the integrated model and deterministic calendar tools, including their date calculations. They do not establish general Polish language accuracy; Polish is not listed among the model's primary languages. Creation/edit/deletion proposals still need review and confirmation. Android follow-up is recorded below. Packaged Electron and other browsers were not tested in this run. Cold-start latency remains substantial.

Artifacts in this workspace: `/workspace/artifacts/lfm2.5-offline-test.log`, `/workspace/artifacts/lfm2.5-unit-tests.log`, `/workspace/artifacts/lfm2.5-results.json`, `/workspace/artifacts/lfm2.5-offline.png`.


## English/Polish and Android follow-up

The final adapter suite passes **84/84** tests. Lint, TypeScript and the production web build pass. Clear imperative verbs constrain the action grammar without bypassing real inference; negated/revised requests retain the full grammar. English receives English examples. Search ignores model date filters without a user date phrase. The browser search assertion now checks the last response rather than accidentally accepting an event name from previous messages.

The first English prompt decreased from 863 to 719 tokens (about 17%); Polish decreased to 754 tokens. This reduces prefill work, but is not a controlled device-level latency comparison. Unproven prompt-cache experiments were removed. Inference remains on the worker and threading still requires cross-origin isolation.

Final English run: all eight offline scenarios passed, including exact names, dates, duration, confirmation, persisted identity, search, delete/undo, weekday, midnight and DST. Response times in scenario order: **30.42, 5.10, 3.25, 4.11, 4.55, 4.74, 4.92, 22.26 seconds**. The last request changes the simulated current date and requires uncached prefill. The Android emulator and a short Gradle build shared the host during this run, so timings are observations, not an isolated benchmark.

Commands:

```sh
CALENDAR_MODEL_FILE=/workspace/models/LFM2.5-350M-Q4_K_M.gguf MODEL_TEST_LANGUAGE=en npm run test:model
CALENDAR_MODEL_FILE=/workspace/models/LFM2.5-350M-Q4_K_M.gguf MODEL_TEST_LANGUAGE=pl npm run test:model
CALENDAR_MODEL_FILE=/workspace/models/LFM2.5-350M-Q4_K_M.gguf ADB=/workspace/android-sdk/platform-tools/adb npm run test:model:android
```

Android debug APK and app instrumentation APK compile successfully with SDK 36/JDK 21 (`:app:assembleDebug :app:assembleDebugAndroidTest`). Both APKs were installed on an Android 15 x86_64 emulator with System WebView 124. The emulator has **no KVM acceleration**, uses software CPU/GPU emulation and took over four minutes to boot. The production compatibility WASM build is bundled for this older WebView. Compilation and installation do not establish successful model inference.

The new Android test runner attempts actual WebView inference in Polish and English with blocked network access, local GGUF import, confirmation and persisted date/time assertions. Use a dedicated debug test installation. The final current-source APK is available at `/workspace/artifacts/kalendarz-ai-debug.apk`; it is a debug artifact, not a published release.


Final Polish run: all eight scenarios passed with the stricter search-response assertion. Response times: **30.48, 5.25, 2.92, 4.16, 5.24, 5.01, 5.41, 26.31 seconds**. Maximum animation-frame gap was 52 ms (English: 53 ms). Same-prefix warm requests took 2.92–5.41 seconds in Polish and 3.25–5.10 seconds in English. Both language runs used real verified weights after offline reload, with no external requests and no JavaScript page errors.

**Android inference remains unverified.** The GGUF transfer completed and the app's WebView debug target appeared at `https://localhost/`, but Playwright could not finish attaching to the page. A direct CDP `Runtime.evaluate` reading `document.readyState` also received no response within ten seconds; the target had an empty title. The attempt did not reach the first model request. The run was bounded to 420 seconds. This is an emulator/WebView attachment/renderer failure before inference, not evidence that the model passed or failed on an actual phone. A physical Android device (or a hardware-accelerated emulator) is still required to validate inference and latency. No Android speed claim is supported by this run.

Follow-up artifacts: `lfm2.5-en-test.log`, `lfm2.5-pl-test.log`, `lfm2.5-en.png`, `lfm2.5-pl.png`, `lfm2.5-android-test.log`, `lfm2.5-android-build.log` and `kalendarz-ai-debug.apk` under `/workspace/artifacts`. Existing work was preserved; no release was published.

## Bundled-model follow-up (1.3.1 source)

Every production build now stages the verified GGUF and license into the application for all platforms. Web/PWA precaches the model. The real browser test starts with a fresh profile and uses packaged weights without importing or downloading them through the setup UI. The signed release APK was inspected directly: its embedded GGUF matches the official SHA-256. Its signing certificate matches the permanent public fingerprint pinned in the repository. Signing secrets could not be uploaded through the managed integration (HTTP 403); see `android-signing.md`. No new public release is claimed by this section.

The follow-up bundled-weight browser runs passed 8/8 Polish and 8/8 English cases; 85 unit tests and lint passed. Packaged Electron also passed real bundled GGUF inference with HTTP blocked in CI run `39668195395`. Android CI run `39667604274` passed the real Polish/English model test; its launcher test exposed an invalid assumption that a disabled alias's background task must resume. The revised launcher regression checks survival while visible, label replacement only after exit and reopening through the new alias with the saved language.

Final Android compatibility run `39668981611` passed all required release WebView checks, including real bundled-model Polish/English proposals and the revised launcher regression. All four languages preserve the visible WebView; exiting updates exactly one launcher name, and reopening through the new alias retains the selected language. Web/packaged Electron CI run `39668981124` also passed. These are CI emulator/Linux measurements, not physical-phone or Windows/macOS inference validation. The permanent-key local APK is at `/workspace/artifacts/Calendar-1.3.1-android.apk`. Public release remains blocked on maintainer configuration of the private signing secrets; the key backup must remain private.
