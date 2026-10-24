# POCO follow-up: persistent model lifecycle and preferred Q4_K_M

This continues PR #9 after the physical POCO report against APK `944f82d`.
No model is removed and no official release or PR merge is authorized here.

## Diagnosed failure and fix

The runtime had an observable race: foreground inference could overtake the
initial IndexedDB/OPFS check. A successful engine load set `phase=ready` but did
not set `installed=true`. The slower check then ignored its result because the
phase was no longer `checking`. A model could therefore be in RAM while marked
uninstalled. Idle disposal only changed phase when `installed` was true, retaining
the inconsistency. The chat catch handler read the stale render-time status and
turned any inference/cancellation/storage error into an installation suggestion.
This is a reproducible code defect; without the phone's exported diagnostics it
does not establish the only cause of the reported physical occurrence.

Successful load now confirms disk installation and RAM residency separately.
Unload/cancel preserve installation and clear only `loaded`. Foreground resume
rechecks/reloads safe installed models; engine errors remain errors until an
explicit retry instead of silently requesting another download. Error codes,
initialization detail and cold/loading/warm engine state are exported. Android
also emits a native resume event. Check results cannot overwrite a newer load.
If metadata is missing but OPFS still contains an exact, hash-verified GGUF, the
registry is repaired without downloading or deleting that file. A true missing
file is distinguished from unavailable storage or a failed engine load.

## Model choice and interface

Qwen3.5 0.8B Q4_K_M is the preferred optional model. A fresh installation can use
the bundled 350M immediately and offers Q4 in settings. When Q4 is installed and
no explicit choice exists it is selected; every saved manual choice, including
IQ4_XS or 350M, wins across restarts. Both Qwen quantizations and LFM 2.6B retain
their exact sources/bytes/hashes. Only 350M is bundled. No optional download is
automatic and switching still awaits disposal of the previous engine.

The assistant header uses short actual model names, one Offline indicator and
44-pixel touch targets with wrapping. Full quantization and separate installed/
RAM states remain in settings and diagnostics. Tabs share a single segmented
container. Chat/draft/scroll and history navigation are retained.

Named titles (`called`, `named`, `o nazwie`, `pod tytułem`) are preserved.
An unknown two-letter suffix adjacent to a time, such as `4-5 pk`, triggers a
time clarification while retaining title/date. An explicit AM/PM answer or a
replacement date/time completes the same draft. The existing 18–20 and midnight
handling remains. A model-generated saved claim is guarded; trusted “Changes
saved” still follows explicit approval and a successful calendar transaction.

## Validation scope

Keep the prior 200-input results and eight-runtime compatibility matrix; do not
replace them with this follow-up. Targeted tests exercise the first-check race,
disk/RAM distinction, reload, metadata repair, cancellation, repeated fallback
switches, restart, idle release and foreground/memory events with real models.
The persistence check also closes Chromium and relaunches the same disk profile,
then requires a genuine response from the previously installed selected model.
Both Q4 and IQ4 use real APK UI download/import/offline inference. A bounded
subset of the existing corpus (`001`, `009`, `016`, PL and EN) compares rules,
native JSON extraction and the complete assistant. Generated outputs and checks
are retained even when incorrect. These six inputs per mode are not a general
quality score or a replacement 200-input benchmark. Timer-controlled idle tests
are excluded from performance comparisons.
Each model also carries context through twelve mixed conversation/proposal turns
without executing calendar changes. Physical sustained long-session/OOM behavior
still requires POCO testing. Uninstalling a diagnostics package clears its OPFS
weights as well as its database; export calendar/history first and retain any
local GGUF source files. This differs from an ordinary restart or RAM release.

All new timing measurements are Linux cloud Chromium measurements, not POCO
measurements. The user's approximately three-second phone response cannot be
attributed to Qwen without its route and native token metric. `quick`/`rules`
remain separate from `model`; native metrics include model ID, quantization,
initial engine state, load/prompt/generation/total times and native tokens/s.

## Physical POCO acceptance

1. Back up the old diagnostic app's history/calendar. Verify the ZIP checksum and
   BUILD-INFO source commit. A new debug certificate can require reinstalling only
   the diagnostics package; do not uninstall the official 1.3.1 application.
2. Select/download Qwen **Q4_K_M** explicitly. Verify its full quantization and
   installed state. Enable airplane mode. Send a normal PL/EN conversation query;
   export diagnostics and require route `model`, the same ID and native tokens.
3. Release RAM in diagnostics. Confirm installed=yes, loaded=no. Send another
   message without downloading. Close/open assistant, switch chats/settings,
   background/return and restart the app; repeat the query at every step.
4. Switch Qwen ↔ 350M repeatedly, then restart with each manually selected model.
   Repeat for IQ4_XS, keeping Q4 and IQ4 distinct. If a load fails, capture the
   actual error and retry loading; do not delete/reinstall verified weights.
5. Test the reported `called studying tomorrow at 4-5 pk`, clarify with `pm`,
   review studying/tomorrow/16:00–17:00 and explicitly confirm. Test 18–20 and
   midnight. Verify no save notice/event before approval and no replay in history.
6. Check 44-pixel header actions, tabs, Back, draft and chat scroll in all themes
   and languages. Record WebView/Android versions, battery/thermal conditions and
   actual native timings. OOM, sustained heat and physical Files-provider/Back
   behavior remain phone acceptance requirements.

Release remains diagnostic only until these physical checks and human quality
review support stable 1.4.0 and the user explicitly approves it.
