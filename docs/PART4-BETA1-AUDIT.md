# Kalendarz 1.5.0 Part 4 Beta 1 audit

This checkpoint is based on accepted Part 3 Beta 2 `5e4ed1718cc40c2c57d44e437fa23ac9cc48d643` (Draft PR #21, private run 42563978670, verified successful). The candidate remains a beta. No public release, merge, dependency update, model weight change or inference backend rewrite is authorized.

Status meanings: PASS = executed in the stated environment; FAIL = reproduced failure; NOT TESTED = unavailable or still awaiting final candidate CI; NOT APPLICABLE = absent feature. The final private manifest includes `AUDIT.md` with an evidence appendix and artifact hashes. Compilation alone is not a PASS for behavior.

## A. Integration and confirmed fixes

PASS — existing Parts 1–3 code is retained by ancestry. The application identity, storage names and native runtime pins are unchanged.

FAIL → PASS — fault injection reproduced partial commits on synchronous failures: legacy event migration, calendar import, AI history save/import/delete/clear. IndexedDB does not implicitly abort a transaction just because application JavaScript throws. Explicit abort, transaction settlement and rethrow now prevent earlier requests committing independently. Five event integrity and five history regressions cover synchronous quota failures, asynchronous abort, retry, retained backups, exact records, deletion/clear and 1000-message history. No schema bump or conversion is necessary.

FAIL → PASS — unreadable preference JSON previously escaped the root without a recovery screen. A root boundary now fails closed, preserves raw storage, reports `app-startup-failed` and offers restart. Caught error text is never logged/rendered because parse errors can contain credentials. A real browser test verifies no secret-marker logging and recovery after explicit storage repair; corrupt event migration cannot render a successful empty calendar.

## B. Calendar and responsiveness

PASS — deterministic 10/500/5000-event profiles exercise all five views, 12 year months, repeated navigation, search, agenda scroll and repeated dialogs without renderer errors or lost records. The large profile includes 100 weekly series and 264 same-time starts.

NOT TESTED — FINAL_CI_PENDING: detailed calendar regressions (`calendar-layout.test.ts`, `calendar.test.ts`, calendar/month browser suites): 4/5/6 month rows, year/month boundaries, leap days/DST, multiday spans, recurrence, overlap positions, all-day/timed events, CRUD and search. Existing responsive suites cover 320/390/768/1280/1366/1920/2560/3840 widths, enlarged text and reduced motion. Browser emulation is not physical hardware.

## C. PIN, password and biometrics

PASS — actual published 1.4.2 initializes and migrates its legacy PIN using its own implementation; the new application unlocks the same stored credential and remains locked on restart.

NOT TESTED — FINAL_CI_PENDING: PIN 4–16, password 8–64, confirmation/change/old credential checks, persistent throttling, wrong attempts, animations-off and keyboard/input isolation, via existing unit and browser suites. Lock-screen protection is not encryption of application data.

NOT TESTED — physical fingerprint/face prompt, enrollment changes, Android lifecycle under real device pressure. Native availability/success/cancellation/error paths are simulated by bridge fixtures. No adb, emulator or /dev/kvm is present in Cloud.

## D. Themes and animations

PASS — unchanged `builtinThemes.json` is compared against all 104 approved HEX values and the ordered 13 roles by `builtin-themes-part2.test.ts`. Legacy built-in theme aliases and all previously valid six-digit custom colors remain accepted.

NOT TESTED — FINAL_CI_PENDING: custom create/edit/duplicate/save/delete/reset/reload and eight-theme UI checks; off/subtle/full, 50/100/200 speed, effect switches, interrupted dialog transitions and reduced motion, via existing Part 2/3 suites. No palette values were modified.

## E. Desktop and shortcuts

NOT TESTED — FINAL_CI_PENDING: centered/bounded draggable AI, side-by-side history, compact copy controls, clipboard/context menu, optional persisted/resizable Overview and small-window behavior. Part 3 browser tests exercise 13 actions/14 defaults (`1–5,S,A,Q,/,U,I,E,T,D`), context settings/search, custom modifiers/arrows, disable/conflict/reset/restart and editable-field isolation.

NOT TESTED — native Windows execution and platform-reserved OS key interception. Existing cross-platform configuration is preserved; only Android and Linux are candidate packages.

## F. Import, export and QR

PASS — targeted atomic calendar/import and history failure tests verify original IDs/data survive interrupted writes and retry succeeds. Event validation rejects invalid structures/duplicate IDs before writes. LWW synchronization uses IDs/timestamps with deletion tie precedence; it does not overwrite by similar titles. Sync theme rollback preserves concurrent preference changes.

NOT TESTED — FINAL_CI_PENDING: JSON/ICS valid/invalid/truncated data, exact fields and Unicode, empty/many events, cancellation, legacy/encrypted/plain transport, compression-before-encryption, whole/frame checksum, arbitrary/duplicate/missing/damaged/foreign QR pieces, wrong password, decompression limits and preview-before-confirm. Existing QR wire formats and cryptography are unchanged.

NOT APPLICABLE — independent modified-occurrence records: the data model has `rrule`, `exdates` and optional `timeZone`, but no separate recurrence-override identifier. Unsupported ICS constructs must be rejected, not represented as supported features. Event JSON preserves optional/unknown event properties; ICS is an interoperability format, not an application/settings/AI backup. QR transfers events, tombstones and optional theme, never credentials or GGUF weights. AI history has its own JSON backup.

NOT TESTED — physical camera/scanning and Android system file-picker/SAF instrumentation. Browser real PNG decoding and file input are separate automated coverage.

## G. Settings

PASS — actual upgrade retains explicit language, custom theme/colors, AI preference, reminders and security. Failure recovery does not overwrite unreadable raw settings with defaults.

NOT TESTED — FINAL_CI_PENDING: nine categories, mobile/desktop navigation, option search, live preview, autosave/quota handling, category reset, preserved custom themes/history/models and persisted sidebar choice via existing Part 3 suites.

## H. Published 1.4.2 upgrade: schema and evidence

PASS — downloaded the actual public `KALENDARZ-1.4.2-WEB.zip`; SHA-256 `2af8054115f0f688b700611718275a26a2d241e4dc54b13e8f378be50b5cc676` matches published `SHA256SUMS.txt`. Its build-info identifies source `abb9f20157f333b9f2ee5a3a5a18c02a684dcb0c`, not an assumed tag HEAD.

The old executable assets create a populated browser profile, then the current assets replace them at the SAME origin and browser context. Records, logical settings, every chat/message, selected model/backend, imported-model catalogue, installed OPFS metadata and bytes are compared by deep equality and SHA-256; restart repeats the comparison. Final CI additionally requires exact clean candidate source/channel in the target build-info.

Local result: **6 → 6 event records, 3 → 3 chats (two fixture chats plus the old application's empty draft), 8 → 8 messages, 1 → 1 custom theme, 1 → 1 model metadata reference and 64 → 64 OPFS bytes**. Complete snapshots match. Fixtures include timed/all-day/multiday/cross-year, weekly/custom recurrence, RRULE/EXDATE/timezone, Unicode/description/location/completion and an unknown extension field. OPFS content is explicitly a synthetic byte-preservation fixture, not a valid inference model. No large GGUF is copied.

Real formats (unchanged):
- `offline-calendar` IndexedDB v1: `records` keyed by event ID, envelopes `{id,updatedAt,event?}`, tombstones omit event; `meta.migrated` protects the legacy `offline_calendar_events_v2` conversion. The raw legacy localStorage remains a backup.
- `offline_calendar_settings_v2`: JSON preferences, themes, hashed credentials and AI options; new defaults merge with explicit saved choices. PIN/password derive with salted PBKDF2-SHA256; no clear credential is introduced.
- `calendar-ai-chats` IndexedDB v1: `chats` and `messages`, stable IDs, sequence/order indexes; reopening proposals is deliberately read-only. Windowed history reads 200 by default without deleting older messages.
- `calendar-local-model` IndexedDB v1 `models`: installed Blob/OPFS metadata; model catalogues/selection and per-model preferences use their existing `calendar_*` keys. Browser OPFS stores `calendar-models`. Native Android/desktop paths remain native-managed and are not rewritten by these changes.

NOT TESTED — an actual Android APK upgrade from 1.4.2/Part 3 on a physical device; native filesystem/Secure Storage migration with real multi-GB models. Signature/package/version checks establish installation compatibility, not proof of a physical upgrade.

## I. Test ledger

PASS — before fixes, 2/5 new calendar fault tests failed and 4 history mutation fault cases failed; after fixes all 10 new integrity/history cases pass, including 1000 retained messages. Existing chat/store regression cases pass. The long-history test initially used the wrong paging argument and was corrected to the documented `(id, before, limit)` API; no application paging behavior changed.

PASS — TypeScript; local broad unit run 258/258 before the additional five history cases; 65/65 Python policies. Final candidate workflow reruns the complete unit set, existing native/stream/browser regressions, Android JVM/device-test compilation and actual packaged Electron acceptance. Exact final results are the workflow and delivery appendix, not inferred from local counts.

NOT TESTED — FINAL_CI_PENDING: complete candidate workflow and package behavior until it actually succeeds. Android device tests are compiled, not declared executed. Native engine architectures/binary inventory and CPU acceptance are distinct from real CUDA/Vulkan offload.

## J. Measured performance

PASS — Linux headless Chromium 1366×768, animations off, deterministic dev-server profiles. Wall time includes Playwright overhead and measures DOM readiness, not completed animation/production frame time. Local measurements:

| Events | Startup ms | Year / month / week / day / agenda ms | Search ms | 10 navigations ms | JS heap bytes |
|---:|---:|---|---:|---:|---:|
| 10 | 1426 | 261 / 139 / 127 / 95 / 125 | 879 | 827 | 32137180 |
| 500 | 1337 | 308 / 184 / 190 / 126 / 143 | 419 | 911 | 29746864 |
| 5000 | 4198 | 1372 / 175 / 269 / 208 / 124 | 877 | 1220 | 53865048 |

Agenda scroll was 54/59/55 ms; DOM after operations 218/229/235 elements. Renderer JavaScript heap is not total RAM or GPU memory. CI repeats and stores its own measurements. The 5000-event year/startup latency remains a known limitation; no speculative architecture rewrite was made.

NOT TESTED — whole-process long-session RAM/leak proof, real POCO/RTX 4060 performance and background pressure across days.

## K. Git and packaging

PASS — stacked `feat/1.5.0-part4` from Part 3, no reset/force/merge. First checkpoint `babb209` contains atomic data fixes and tests. Native/backend sources, weights, dependencies and previous policies are unchanged. New files add the recovery screen, targeted tests, private candidate policy/guards/workflow and this report. Generated evidence is ignored by Git.

Candidate: `1.5.0-part4-beta.1`, code **10522 > 10521**, package `com.kalendarz.offline.diagnostics`, original certificate `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`. Both model-free artifacts must prove one identical live application SHA. Historical Part 3 policies remain intact. The existing one-use encrypted signing transport is allowlisted for the exact new private workflow path; no new Android certificate is generated.

NOT TESTED — FINAL_CI_PENDING: final APK/AppImage bytes, certificate, runtime inventory, startup/inference, download integrity and private artifact URLs until delivery completes. Stable 1.4.2 Latest is not modified.

## L. Remaining risks and manual acceptance

NOT TESTED — POCO installation/data update, actual biometrics/enrollment changes, native picker/camera, background Android memory pressure and hardware Vulkan; CachyOS/RTX CUDA/Vulkan offload; native Windows. Existing accepted hardware behavior is retained, not claimed retested.

NOT APPLICABLE — stable 1.5.0 publication: this is Part 4 Beta 1 only. No public Release or automatic merge. No package may be described ready if a critical test or integrity gate fails.

Workflow preflight correction: the first private validation attempt stopped before packaging because the copied template accidentally renamed the existing Part 3 Beta 2 UI regression path. Only that path was restored; referenced test-file existence is now checked before redeployment. One public desktop job also hit an HTTP 504 during packaging; its failed job was retried without a code change. These are not application-data test failures.

Packaging preflight correction: the existing Electron hook did not recognize the new Part 4 channel and correctly failed closed through the older guard. It now selects the Part 4 policy explicitly, with regression coverage for all retained channels and a profile flag without a source SHA. The workflow/source checks were not disabled. The affected run was cancelled before signing/build output; no update key was transmitted for it.

Network blocker handling: repeated GitHub release-download HTTP 504 responses prevented both the published-upgrade fixture and pinned native archives from downloading. Build-time downloading now falls back to the public GitHub REST asset endpoint for the exact repository/tag/file/size. Both routes require the original SHA-256 and byte count; oversized/mismatching files are rejected and existing verified files remain untouched. No token is forwarded to redirected download hosts; native versions, archives and checksums are unchanged.

PASS — the REST fallback was also exercised live against the published 1.4.2 WEB asset in Cloud, producing the exact approved 6,955,172 bytes and SHA-256. Four new isolated downloader tests cover success, fallback, changed origin and checksum rejection/preservation. Linux CUDA staging uses the same fallback only for assets already pinned with their byte count; legacy Windows handling is unchanged.
