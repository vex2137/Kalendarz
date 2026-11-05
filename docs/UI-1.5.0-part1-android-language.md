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
