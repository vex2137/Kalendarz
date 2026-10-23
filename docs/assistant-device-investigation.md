# POCO greeting and language investigation

## Evidence and limits

The previously published diagnostic artifact came from Actions run
`40024330652`, source `e6d4353b1635c7444fa013f528ac3a929e82ade3`.
The checkout log records this SHA, and Git ancestry confirms it contains
`d359188`. The APK build, bundled GGUF/license verification and upload succeeded.
This establishes build provenance; it does not independently identify bytes or
JavaScript running on a phone. That APK did not expose an in-app commit stamp.

In that source, plain NFC `Cześć` reaches `assistantQuickReply`, even with English
UI. It returns an English greeting because the response locale was passed from
the UI. A visually identical NFD string (`Czes\u0301c\u0301`) and an appended
U+200B fail the quick match. With no calendar rule match they fall through to
real GGUF inference. The reported English sentence originates in
`resolveModelCommand` when an update/delete lacks a unique existing event.
It is not a quick greeting response.

Thus the source has a reproduced normalization defect and a confirmed locale
coupling defect. We have **not established that the phone's exact input was NFD**,
or explained a failure for plain NFC on that device. A device trace is required
before closing the reported bug. No additional canned replies were added.

## Diagnostic changes

- NFC normalization and removal of U+200B/U+FEFF before routing.
- Message-language detection from command/date vocabulary outside quoted names;
  ambiguous fragments retain the conversation language, then the UI fallback.
  Quick replies, rules, resolver text and the model prompt share that language.
- Source commit compiled into JavaScript and `build-info.json`; Android embeds
  the same build commit as a resource and exposes its package/version/commit
  independently through the native plugin. Diagnostics flag a mismatch.
- Per-message quick/rules/model path, quick checked/matched, rule match, language,
  Unicode normalization evidence, model action, total handling time and time to
  React UI commit. No complete request text is stored in the app's diagnostics.
- Session metadata-readiness time, longest frame gap and long-task observations;
  separate storage/hash/init/prompt/generation timings remain available. These
  measurements help distinguish UI stalls from inference; they are not physical
  device measurements until exported from the phone.
- CI verifies the commit inside the assembled APK and runs the production drawer
  regression using JavaScript **extracted from that APK** before upload.

## Cloud regression observations

100 unit tests and the desktop-size drawer routing regression passed (28 messages,
four UI languages, including NFC/NFD/U+200B Polish greetings). A real offline
GGUF request in English UI returned a Polish create proposal via `model`:
approximately 43.8 seconds interaction time, 12.1 seconds waiting for initialization,
28.3 seconds prompt processing and 3.1 seconds generation, on the shared two-core
cloud executor. These are not POCO timings.

An initial browser regression failed its two-second greeting limit. The trace
showed the quick pipeline taking 7–8 ms and UI commit 8–10 ms, while Playwright's
click took about 12.5 seconds. The input's top coordinate was 751.5 in a 720-high
viewport: expanded diagnostics plus the flex message layout pushed the input
off-screen. Bounding diagnostics height and allowing the message area to shrink
keeps the input visible. The same 28-message regression then passed at roughly
133–224 ms interaction time. This fixes a reproduced layout issue; it does not
establish the cause of the phone's reported delay.

The same 28-message regression also passed at a 393×851 touch viewport (74–164 ms
interaction times) with the input kept on-screen and no calendar records saved.
This is browser viewport emulation, not a physical Android test.
The 28-message phone-viewport test also passed against files extracted from the
locally assembled APK; CI repeats the routing test, including localized schedule
shortcuts and a direct model-route request, before
publishing each diagnostic artifact.

## Physical acceptance remains pending

Use the new diagnostic artifact, not the earlier ZIP. If Android rejects an
update because debug certificates differ, first export diagnostic results, then
uninstall only **Calendar AI diagnostics** and install the new APK. The regular
calendar uses a separate package and data.

1. With English UI, open AI diagnostics. Record `build.commit`, `nativeBuild`,
   `buildMismatch` (must be false) and the APK checksum from the ZIP.
2. Force-stop/reopen the diagnostic app. Open the assistant and immediately type
   `Cześć` using the phone keyboard. Repeat after clearing the conversation and
   with a pasted `Cześć`. Expect Polish greeting, `quick`, `quickChecked: true`,
   `quickMatched: true`, no event proposal. Export JSON after a failure before
   further messages can replace its trace.
3. Still with English UI, send `Dodaj wydarzenie Kontrola jutro o 15:00`.
   Expect Polish response, `rules`, correctly dated proposal and no automatic save.
   With Polish UI send `Add event Checkup tomorrow at 15:00`; expect English.
4. With English UI, send `Dodaj wydarzenie Pomiar jutro o 14:15 z opisem spokojna wizyta`.
   This unsupported rule structure must reach `model`, use Polish and execute
   real offline GGUF inference. Check the proposal rather than assuming the
   model must extract every command correctly.
5. In airplane mode, run **Device test: cold + warm**, then repeat with
   **Compare with one CPU thread**. Export JSON, recording Android/System WebView
   versions, thermal/battery state and perceived first-response delay. Cold
   loading, prompt processing and generation are different phases.

A successful cloud/browser/CI run does not complete these POCO acceptance steps.
