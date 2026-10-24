# 1.4.0 final update and acceptance

> **Released:** [Calendar v1.4.0](https://github.com/vex2137/Kalendarz/releases/tag/v1.4.0), source `228f339e7032209f55193b68938ce6035dcc865d`. Production signing, official in-place upgrade and all platform gates passed in [run 40130580030](https://github.com/vex2137/Kalendarz/actions/runs/40130580030). Earlier blocker entries below record historical validation stages.

## Recovered interrupted validation

The previously interrupted run [40112106321](https://github.com/vex2137/Kalendarz/actions/runs/40112106321) **completed successfully** at source `bbf81dab43ca5fc6cc489360ebe3191554770b58`. Its retained [diagnostic artifact](https://github.com/vex2137/Kalendarz/actions/runs/40112106321/artifacts/12568915092) has ZIP SHA-256 `9bb6130d66b4754a3511ea865aa7fa8edbabe031bf2b5bb6b4a503d9126170c2`.

Both exact Qwen variants passed genuine UI download/import/offline inference and the lifecycle checks: foreground load overtaking disk discovery, RAM release/reload, cancellation, OPFS metadata recovery, two fallback switches, mixed conversation, browser process restart and idle/resume/memory-pressure handling. These are Linux Chromium tests, not physical POCO results. Q4's warm native probe took 2.887 s; IQ4_XS took 10.533 s on that runner. This does not establish a phone performance guarantee.

The bounded quality comparison retained failures: raw model JSON could invent dates or misclassify ordinary conversation. The production assistant's deterministic calendar route preserved the tested title/date/time, and its native conversational route answered the small PL/EN subset. Engine success does not establish general semantic accuracy. Existing larger benchmark reports are retained unchanged.

## Final implementation

- Android local import uses `ACTION_OPEN_DOCUMENT`, a granted `content://` URI and an ephemeral, same-origin streaming endpoint. No ordinary path, base64 bridge transfer or whole-model JavaScript allocation is required. The web/desktop picker remains available. Exact size and SHA-256 identify catalogue models; installation is committed after disk storage succeeds. Failure/cancellation retains an existing installation. Downloads retain their working implementation.
- The accepted settings/header references are implemented with theme variables: active-model card, real disk/RAM badges, three actions, model cards, source/license details, six framed 44 px header buttons, real quantization and compact prompt chips. All four models remain; bundled 350M has no removal action.
- Minimized assistant state remains mounted, including messages, draft and scroll. Background work is opt-in and means continuing while the calendar remains usable. Android visibility/memory-pressure policy can stop inference after leaving the application. There is no foreground service or native inference backend, and no claim of execution after process death. Close cancels current generation; minimization follows the setting. Single-flight runtime guards remain.
- Quick switching lists installed models, preserves the conversation, disposes the old engine and prepares the selected one. Actual loading/error states remain visible.
- General conversational prefixes and trailing named titles preserve the supplied Polish event title and 08:00–16:00 range. Existing ambiguous `pk` clarification and 18–20 handling remain covered.

## Release safeguards

Production builds require the existing permanent key and pinned public certificate. They cannot fall back to a debug identity. Android package ID and WebView origin remain unchanged, as do calendar IndexedDB and settings keys. Desktop profile remains `Kalendarz Offline`. The upgrade check installs the official 1.3.1 assistant-fix APK, seeds an event/settings/custom palette, then uses `adb install -r` for 1.4.0 and checks preservation, without uninstalling between stages.

The release workflow builds Android, Windows, AppImage, Flatpak and Web/PWA. Publication must wait for successful permanent signing, upgrade preservation and platform checks. Signing credentials never enter source or artifacts. A failed signing gate is a release blocker, not grounds to replace the key.

## POCO acceptance for this exact candidate

1. Export calendar/history backups. Install only an official, matching-certificate APK over official 1.3.1. Do not uninstall or clear data. A `.diagnostics` APK is separate and cannot update the primary calendar.
2. In AI settings choose Download for Qwen3.5 0.8B **Q4_K_M** once, or Import GGUF and select the exact supported local file from Downloads. Wait for verification; check installed status and quantization. A mismatched file should show an error and preserve existing models.
3. Enable airplane mode, send an ordinary conversational question and inspect `route=model`, token count, model ID and quantization. Release RAM, reopen, restart the app and switch Qwen ↔ 350M; installed weights should not need another download.
4. Enable background work, send a question, minimize, use the calendar and reopen. Expect the same response/job; draft and scroll should survive. Leaving the Android app may stop generation. Disable background work to stop generation when minimizing.
5. Check `18-20`, `studying ... 4-5 pk` → `pm`, and `O jak super dodaj wydarzenie na jutro od 8 do 16 o nazwie "nauka rozprawki"`. Confirm the proposed date/time before saving. Reopen history and ensure no old action can replay.
6. Export diagnostics for any failure. Physical POCO acceptance of this final compilation remains a user/device check; cloud results must not be presented as that check.

## Production signing blocker observed

[Release run 40126056209](https://github.com/vex2137/Kalendarz/actions/runs/40126056209), Android job `120967591313`, failed its early signing gate: `Missing CALENDAR_ANDROID_KEYSTORE_BASE64: public APKs must use the permanent signing key, never a fresh debug key`. The managed environment also has no configured signing credential. No replacement key was generated and no official 1.4.0 APK or release was published.

To resume, restore the **existing 1.3.1 key**, not a new identity, in repository Actions secrets: `CALENDAR_ANDROID_KEYSTORE_BASE64`, `CALENDAR_ANDROID_STORE_PASSWORD`, `CALENDAR_ANDROID_KEY_ALIAS`, `CALENDAR_ANDROID_KEY_PASSWORD`. Then run the production workflow on the final commit, require the certificate check and in-place update test to pass, and publish only the verified package set. The private key belongs in the repository's secret configuration, never in Git or release assets.

## Observed final validation

- TypeScript/build and **121 unit tests passed**. The three requested command cases are covered, including the new general Polish prefix/trailing-title case.
- Local browser calendar creation/edit/readback, failed writes, imports, cross-tab updates, offline reload and 10,000-event agenda checks passed. History/new-chat/JSON/model selection and confirmation-only write checks passed. A search test now waits for its debounced search result rather than counting stale rows. A local model preload exceeded the former 30-second test limit; the bounded wait is now 90 seconds, and the test passed.
- Settings passed eight EN/PL/DE/RU × phone/desktop combinations, including all six 44 px targets, draft/scroll preservation on minimize, tabs, Escape/Back and focus restoration. All seven palette accents were checked against computed button colors. Existing custom palette variables are used directly.
- OPFS passed both `createWritable` and forced synchronous-worker modes, including import/download, metadata recovery, HTTP/truncation/hash/quota/cancellation failures. A damaged replacement retained the previous verified file. Reimport of the already bundled 350M is explained without creating another OPFS copy.
- [Android compatibility run 40126279139](https://github.com/vex2137/Kalendarz/actions/runs/40126279139) at `8c048cc6e6cdb117ef7d1a1f5212abfd7c9e1d47` passed **7 instrumented tests**. SAF acceptance returned a real Downloads `content://` URI through a controlled picker-result fixture, streamed 8 MiB with matching SHA-256, and denied the endpoint after token release. Other tests exercised events, native notifications, language/launcher behavior, custom theme/sync, touch navigation, and real bundled-model PL/EN inference. This is emulator coverage, not an end-to-end physical POCO picker test. The test APK uses a test certificate and must not replace the user's official APK.
- The same run downloaded the actual official 1.3.1 assistant-fix APK and verified certificate SHA-256 `b6b7bc0499ab59af54404a90aaa785e3d40f2738e83fdf9e6306f8e210c79a01`, package `com.kalendarz.offline`, versionCode `10301`. Candidate versionCode is `10400`. The **production** 1.4.0 signature and `install -r` migration remain blocked by the missing private key. Calendar store, settings storage, Capacitor origin/config and Electron profile code are unchanged from the official 1.3.1 source.
- [Diagnostic run 40126279141](https://github.com/vex2137/Kalendarz/actions/runs/40126279141) at `8c048cc…` passed APK provenance/signature/assets, routing, history, settings, real background/minimized 350M output, real preferred-Q4 download/import/offline UI use, Q4 disk reload and native 350M fallback. Its [ZIP](https://github.com/vex2137/Kalendarz/actions/runs/40126279141/artifacts/12573787436) SHA-256 is `81a6d0ae7284e7369e41fe93afd6b0fe1406fb509ce55e7cfcba5b3835f4f6ac`. Later documentation/import-guard changes are recorded separately; this source is explicit.
- The bounded native smoke produced `4` from Q4 after a browser reload (11.395 s), `4` after RAM unload/reload from existing OPFS (11.343 s), and `Two plus two equals four.` from 350M (11.583 s). These include cold load/verification on Linux CI. The Q4 UI conversation took about 17.3 s including load; genuine 350M work continued while the panel was minimized. Native metrics include real tokens; no parser reply is counted as LLM performance.
- [Platform packaging run 40126056209](https://github.com/vex2137/Kalendarz/actions/runs/40126056209) at `7b0873892483b7980e870366840e8927766ac1de` passed Web/PWA, packaged Windows, AppImage and installable Flatpak checks. These are preflight packages; the final minor UI/import-guard changes require a final production build after signing is restored. Overall release conclusion is failure solely at the signing gate; publication was skipped.

The final branch contains PR #7 source `cc2cbfbd4715bfafa359ad65fba3fdbf4019641d`, PR #8 source `f55a7e2575b23f8b276a32281ce65b5aa34facdc`, and PR #9 as ancestors. No force-push or merge was used.

## Background and resource boundary

The engine runs in a WebAssembly worker, with bounded context/output, at most four CPU threads and idle memory release. Android memory-pressure signals dispose/cancel the engine without deleting weights; app visibility changes stop current work and allow safe reload on return. System thermal throttling still applies; there is no calibrated app-level thermal controller or physical thermal validation. A foreground service alone would not make this WebView worker a reliable native inference service. A full native backend/service migration is deferred; the delivered switch controls real continuation inside the running calendar.

## Final downloadable candidate

[Run 40127458201](https://github.com/vex2137/Kalendarz/actions/runs/40127458201) **passed every step** at source `22180dc8006d640c2d549556e8d0b5a56d57d520`, including the final bundled-import guard and single offline indicator. [Download diagnostic ZIP](https://github.com/vex2137/Kalendarz/actions/runs/40127458201/artifacts/12574185276) (236,167,429 bytes), SHA-256:

```text
ec366c4a47e6de44912c605b604a27595f43434d09065dc230a19ca501870cfb
```

The ZIP contains the APK and its own checksum/provenance files. APK signature, separate diagnostic application ID, version, embedded GGUF hash and license were verified; APK size is 236,059,839 bytes. It is a **debug-signed diagnostic candidate**, not an official update for 1.3.1. Existing diagnostic builds may have a different test certificate; do not remove or clear the primary calendar to install this candidate.

Final checks passed: 37 routed messages across all UI languages, durable history/JSON/write-failure protection, eight settings combinations, real 350M generation across minimization, exact Q4 download/import/rejected-incompatible-file/offline conversation, Q4 reuse after browser and RAM reload, and native fallback to 350M. Native cold probes (Linux runner, including load/verification) took 14.628 s for Q4 after browser reload, 14.512 s for Q4 reloading existing OPFS, and 14.613 s for bundled 350M. Both Q4 probes answered `4`; 350M answered `Two plus two equals four.` The UI Q4 reply took about 21.5 s including load. These are genuine native completions, not quick/rules timings or physical POCO measurements.

Web and Linux Electron checks also passed at the same source. Subsequent documentation-only commits do not change the embedded APK source. **Official v1.4.0 remains unpublished because the permanent Android signing key is unavailable; production signature compatibility and the prepared official in-place migration test remain unverified.**

## Official production release — 2026-10-24

The user restored all four original Android signing secrets. The workflow checked their presence without printing values and built the APK with the existing key. The original official 1.3.1 assistant-fix APK and production 1.4.0 APK both verified against certificate SHA-256 `b6b7bc0499ab59af54404a90aaa785e3d40f2738e83fdf9e6306f8e210c79a01`. Package ID remains `com.kalendarz.offline`; versionCode increases from `10301` to `10400`.

On the Android emulator, `seedOfficial131` passed against the actual official 1.3.1 APK. `adb install -r` then installed production 1.4.0 without uninstalling between stages. `verifyUpgrade140` passed, retaining the event and its 08:00–16:00 times, settings, Polish language and custom palette. All seven additional release WebView/SAF/model/notification/navigation tests passed. Physical POCO validation of this exact build remains unperformed.

The first attempt stopped before installation because `aapt | head` received SIGPIPE under `pipefail`. Commit `228f339` makes the filter consume the full output; a local regression reproduced exit 141 and verified the correction. Application code and packaging configuration are unchanged from the previously validated AI candidate. The successful production run used the corrected test and the original signing key.

The final production gates passed: TypeScript/build, 121 unit tests, Web/PWA persistence/offline/language/theme/navigation checks, packaged Windows and Linux AppImage application tests, Flatpak build and installation, signed Android update and seven Android functional checks. The workflow published all seven packages and [SHA256SUMS.txt](https://github.com/vex2137/Kalendarz/releases/download/v1.4.0/SHA256SUMS.txt). Downloaded checksums match the GitHub upload digests for every package. The release is public, stable and marked latest; remote tag `v1.4.0` resolves to `228f339e7032209f55193b68938ce6035dcc865d`.

Official APK: [Calendar-1.4.0-android.apk](https://github.com/vex2137/Kalendarz/releases/download/v1.4.0/Calendar-1.4.0-android.apk), 231,995,170 bytes. The production APK was renamed in place after the artifact audit; its bytes, signature and SHA-256 are unchanged. APK SHA-256:

```text
b1065426530dd46a2f3bf2790e0571f3bc24d46660271a28a12b34e96dfce674
```

Install the official APK over official 1.3.1; keep application data. Qwen Q4_K_M remains an optional separate download and 350M remains bundled. No new key or long AI benchmark was used for this release continuation.
