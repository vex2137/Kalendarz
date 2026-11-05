# Part 1 Beta 1 — Android naming and 1.4.2 compatibility

Work continues from `d6ec33f` on a separate beta fix branch. Existing local tag `v1.5.0-part1-beta1` is preserved; a verified rebuild will use `v1.5.0-part1-beta1-android-r2`. Publication is now authorized only as a Pre-release, never Stable/Latest.

## Root-cause comparison

Sources compared: stable 1.4.1 `ded3bdc`, published 1.4.2 `6da3896`, and the incoming beta. `CalendarDevicePlugin` is unchanged between those two stable source revisions. The evidence therefore does not establish that 1.4.2 introduced the native block. It establishes three concrete faults in the distributed diagnostics path:

1. `handleOnStop()` explicitly returned for `.diagnostics`, the ID actually used by published 1.4.2.
2. Alias components were constructed with the suffixed applicationId as their class namespace. The actual APK declares `com.kalendarz.offline.Launcher_*`, not `com.kalendarz.offline.diagnostics.Launcher_*`.
3. Generated model-free/beta resource overlays replaced all language labels with one version label. The main/default diagnostics overlay also flattened all aliases.

The fix preserves component IDs and data paths, copies canonical localized resources, defaults to the English alias, persists the existing native preference, and applies idempotent component changes on background transition. Android 13+ uses the atomic PackageManager operation; older systems enable the new alias before disabling old ones. PackageManager supplies launcher refresh notifications; no protected broadcast is forged.

Framework per-app locales on Android 13+, AppCompat locales on older versions, activity title and recents label follow the selected language. Locale/layoutDirection configuration changes are handled without deliberately recreating the WebView. The native bridge waits for loaded calendar settings. System Settings and notification headers are OS-owned and may follow system locale/cache on older/OEM systems; icon-label correctness is not evidence of universal OS-header behavior. Notification channels and user mute choices are not reset.

## Preservation of 1.4.2

Published 1.4.2 runtime-only changes are copied unchanged: model descriptors/selection migration, conversation and calendar extraction fixes, reminder checks, diagnostics and native completion parsing. Associated regression tests are retained. This is compatibility integration, not retraining or changing Qwen v2. No dataset, training pipeline, weight or protected branch is modified. Existing IndexedDB/localStorage schemas remain intact.

## Signing and publication gate

The official downloaded 1.4.2 APK is `com.kalendarz.offline.diagnostics`, versionCode 10407, certificate SHA-256 `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`. The earlier beta's test key is not compatible.

The new release build requires the existing update private key, matching certificate and versionCode 10506. Missing/wrong key material aborts before assembly. No key is generated, no production secret is replaced, and a test-key control build must never be published as the compatible update.

The existing registered 1.4.2 workflow path is reused on the beta branch only for an independent signing preflight. It reads the four existing `CALENDAR_ANDROID_UPDATE_*` secrets. Default/main and 1.4.2 workflows/branches are not edited. The beta workflow builds only after positive key proof; it does not publish automatically. The final publication step must first verify the APK, upload as Draft, download/hash the asset, then publish with `prerelease=true` and `make_latest=false`.

## Verification scope

Robolectric tests exercise compiled Android resources, PackageManager aliases, PL → EN → PL, persisted preference restoration, default English, namespace correctness, title and API-33 locale changes. They are JVM Android tests, not physical-device or launcher-rendering tests. Browser regressions cover language/settings persistence and the five views. Compatible APK upgrade installation and physical AI inference must be reported separately from storage/schema or parser tests.

The core month/day/week/year/agenda functionality is retained from the earlier part-1 compliance report. Parts 2–4 remain outside scope. Explicit repeated-hour editor choice, full assistive-technology/zoom coverage and physical-device certification remain known limitations, not declared complete.

## Executed results (2026-11-05)

- TypeScript: passed.
- Application unit suite: **171 passed, 0 failed**. Native host/control suite: **26 passed, 0 failed**. These include the preserved 1.4.2 command/model-selection/response-parsing behavior; they do not prove private Qwen v2 inference.
- Android JVM: **29 passed, 0 failed**, including **10 launcher/title/locale tests** across API 28 and 33. Robolectric fetched its SDK through the required proxy and trusted system CA store; the first dependency fetch failed before that test-process configuration was supplied.
- Browser: five views, 4–6-row months, multi-day bars, overlaps, time boundaries, eight responsive sizes, accessibility/dirty forms, PL → EN → PL persistence, native bridge selection and notification state checks passed. Bridge OS replies are controlled browser fixtures; they are not real Android notifications.
- Official 1.4.2 Web archive → candidate, same browser origin: event fields, settings/language, Qwen v2 selection, AI history and JSON export/import passed. The archive was verified against official SHA-256 `2af8054115f0f688b700611718275a26a2d241e4dc54b13e8f378be50b5cc676`. This is a storage/browser upgrade test, not `adb install -r`.
- Actual offline assistant/history UI test passed commands, reviewable proposals, restart/history order, model selection, rename/search and settings navigation without external requests. No private-model inference was performed.
- Web/PWA control build passed. The first sandboxed Git-provenance subprocess was blocked; the approved local build succeeded.
- Negative publication build passed: missing update key aborts assembly; no key or new candidate APK was generated.
- No connected Android device or emulator was available. Physical launcher refresh latency, OS Settings/notification header rendering, in-place APK installation and device inference remain unverified.

Captured check excerpts and full-log hashes: [verification results](verification/ui-part1-android-language-results.txt). Local full logs and reference archives are under `release/part1-beta1-final/`.

## Signing outcome — publication blocked

Fresh beta preflight: [Actions run 42017702957](https://github.com/vex2137/Kalendarz/actions/runs/42017702957), application source `c2cd8a59ab1a841abbd1f00639662f4a522f8ac2`. It failed; the Android build job was skipped. The four mapped signing inputs were empty in the runner, and repository environments were checked: none are configured. No secret value was read or printed. The missing inputs are:

1. `CALENDAR_ANDROID_UPDATE_KEYSTORE_BASE64`
2. `CALENDAR_ANDROID_UPDATE_STORE_PASSWORD`
3. `CALENDAR_ANDROID_UPDATE_KEY_ALIAS`
4. `CALENDAR_ANDROID_UPDATE_KEY_PASSWORD`

They must refer to the **existing private key** whose certificate SHA-256 is `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`. A certificate or old public APK alone cannot recover that private key. Repository secret enumeration returned HTTP 403; the actual CI preflight established that these values are unavailable to this workflow. An older 1.4.2 preflight had instead received the different production certificate (`b6b7bc…9a01`); it is not an acceptable substitute either.

The owner must restore the existing update-key backup (`calendar-update-142.p12` plus its private signing configuration) into those four Actions secrets, or provide its private workspace path to the existing signing helper. The known 1.4.2 setup helper can validate that backup before configuring the update-specific secrets; production secrets must remain untouched. After positive preflight, run the beta workflow with `preflight_only=false`, verify the resulting APK, then perform the authorized Pre-release publication and download/hash confirmation.

**No new compatible APK, new APK size/SHA-256, public Pre-release or direct download URL exists from this task.** No incompatible/test-key APK was published, no stable release changed, and existing tags/releases were preserved. The old October beta artifacts are historical test-key builds, not this compatible candidate. The proposed new tag is not created while signing is blocked.

## Readiness for part 2

The five-view UI base, naming implementation and 1.4.2 runtime compatibility are implemented and pass the stated tests. Part 1 is **not cleared for a compatible APK release** until signing and actual upgrade acceptance are resolved. Keep the known repeated-hour/accessibility/device limits explicit. Part 2 was not started and must inherit this combined source, not start a separate application.
