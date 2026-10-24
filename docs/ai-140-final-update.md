# 1.4.0 final update and acceptance

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
