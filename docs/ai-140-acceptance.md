# AI Update 1.4.0 diagnostic candidate

This branch continues PR #8 at `f55a7e2575b23f8b276a32281ce65b5aa34facdc`.
It does not release 1.4.0 or merge the stacked PRs. The package version remains
1.3.1; the separate diagnostics build carries this candidate's source commit.

## Changes and acceptance scope

- One AI settings window has Models and Diagnostics tabs. Chat DOM, draft and
  scroll position survive opening/closing it. The phone panel fills the viewport;
  desktop uses a wider window. Esc, close, keyboard tabs and native Android Back
  return through the current panel. Global app settings point to this one entry.
- New conversation from history resets context and input, selects the new ID,
  preserves the previous chat and reuses an empty active draft on repeated taps.
  IndexedDB schema and existing calendar/chat data are retained.
- Hugging Face repository/tree/blob/resolve links find audited catalogue models.
  `main` links select the pinned catalogue revision, not mutable remote weights.
  Qwen repository links expose both quantizations for explicit selection. Other
  repositories/revisions are rejected with an explanation; this is not arbitrary
  GGUF support. No pasted URL is fetched, and no model downloads automatically.
- Android's picker is not restricted to an extension-only MIME filter. Imports
  still require the exact selected model's size and SHA-256 before installation.
- OPFS uses `createWritable` where available and a dedicated synchronous-access
  worker otherwise. Imports/downloads use bounded chunks. An orphan/partial file
  does not count as installed. Retry cleans stale partials; failure/cancel removes
  the current partial. Replaced installed files are removed after metadata commit.
  HTTP, quota, checksum, unsupported-link and engine errors have localized text.
- Explicit PL/EN intervals, spaced/Unicode dashes, shared AM/PM and overnight
  intervals retain the supplied end. Model-generated default ends cannot override
  a recognized interval. Empty/invalid intervals request clarification.
- Natural language switch requests override the UI language. Ordinary chat does
  not inherit calendar intent from a pending draft, date or bare pronoun. Complex
  conversation still uses genuine GGUF inference; quick/rules/model stay distinct.

## Validation and limits

The local environment is Linux cloud Chromium, not a physical POCO. Unit tests,
browser history/navigation and synthetic storage failure probes are run locally.
Synthetic storage bytes test transactions only and do not prove GGUF support.
The Actions workflow checks the actual APK's JavaScript, verifies embedded 350M
bytes/signature/provenance and rechecks all four pinned Hugging Face metadata
records. Its targeted IQ4_XS UI test downloads live, imports the exact real file,
rejects an invalid file and requires native token metrics for the selected model
after installation and offline reload. It forces the OPFS worker path.

Existing eight model/runtime compatibility results and the 200-input development
corpus are retained in `multimodel-progress.md`. No new comparable quality score
or phone performance claim follows from these regression changes. General
semantic/date/title errors in the small model remain; confirmation is mandatory.
Physical Android file-provider behavior, OOM, thermal/battery/renderer memory and
Back gestures must still be checked on the phone. Windows/macOS were not rerun.

## POCO X7 Pro procedure

1. Download the successful **Android AI diagnostics APK** Actions artifact ZIP.
   Check `BUILD-INFO.json` source commit and `SHA256SUMS.txt`. The application ID
   is `com.kalendarz.offline.diagnostics`; official 1.3.1 data is separate. A fresh
   runner can sign with a different debug key. Export diagnostic data before
   uninstalling an old diagnostic build if Android rejects the update. Do not
   uninstall the official app. Stable signing continuity remains a release gate.
2. Open Assistant → AI settings → AI models. Paste the Qwen repository link or
   an exact GGUF link, choose one quantization, press Use model, then Download.
   Confirm verified installation. Close settings, enable airplane mode and send
   an ordinary question. Export diagnostics and verify native model ID/token
   metrics. Repeat with local file import via Android's Files picker.
3. Test 350M fallback, cancel a download, retry, an incorrect GGUF and insufficient
   space. Check no false installation appears. Test 2.6B only with enough free
   RAM/storage; recover to 350M if it fails. Do not compare cloud timings to POCO.
4. Send an old chat message. Open history → New conversation; confirm empty input
   and independent context, then send a new message. Reopen both conversations,
   restart the app and verify both. Repeat New several times before sending;
   only one empty draft should exist. Test rename/search/delete/JSON backup/import.
5. Scroll an older chat and type a draft. Open both settings tabs, scroll their
   contents, close with X/Back and verify the exact chat scroll/draft. Repeat with
   Android Back gesture, landscape, all themes and EN/PL/DE/RU.
6. Test `Add new event workout for today at 18-20 time`, `Dodaj trening dzisiaj
   o 18–20`, `Add workout today at 11 pm - 1 am`, and natural PL/EN chat/language
   switches after a pending event proposal. Review every field before confirming.
   Reopen history and verify old proposals cannot execute. Calendar data must
   remain unchanged until confirmation.

This candidate requires physical POCO acceptance and user approval before any
official 1.4.0 release. It contains none of the planned 1.5.0 features.
