# KALENDARZ 1.4.1 BETA 3 — download/import regression recovery

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. This resumes the uncommitted Beta 3 changes from Beta 2 commit `049ac2d`; no reset or work replacement was performed.

The interrupted full-file test had already completed successfully. Its evidence was recovered from `/workspace/scratch/beta3-real-transfer.json` and retained in `docs/evidence/ai-141-beta3-real-transfer.json`. The 137 app tests, 24 native tests, two targeted Java identity tests and unfinished Beta 3 build assets were also recovered. The existing APK at the start was still Beta 2; a final Beta 3 APK had not been produced.

## Confirmed regression versus 1.4.0

Official 1.4.0 reference: `228f339e7032209f55193b68938ce6035dcc865d`.

Beta 2's new Android native descriptor check required `[a-z0-9-]{1,90}`. Every catalogue ID contains version dots, for example `qwen3.5-0.8b-q4-k-m` and `lfm2.5-350m-q4-k-m`. Native `info()` therefore rejected all four catalogue entries with `model-input`, before a download could even begin. Imports of exact recognized GGUF files selected these same invalid IDs. The installed-native-model URL handler duplicated the bad check and could return a local 404 for these valid IDs.

Beta 2 also made a native upload mandatory inside `saveModel()` and removed legacy storage after migration. This coupled download success to a backend that 1.4.0 did not need.

`ModelIdentity.valid()` now accepts version dots and underscores, while rejecting slashes, backslashes, leading dot/traversal, `..`, empty and excessive-length IDs. Both native descriptor validation and installed-model URL handling use it. Actual Java/JUnit tests cover all four existing catalogue IDs and arbitrary content-addressed imports. This is an executable validation regression test, not a bridge mock.

## Restored 1.4.0 mechanisms

The existing `fetch` -> response stream -> bounded OPFS writer -> SHA verification -> atomic IndexedDB pointer commit path is retained. Its dedicated sync-access worker fallback for Android WebView is retained. Android installation once again uses this path without requiring native upload. Android reads the committed OPFS copy first; beta-era native-only copies remain readable through the corrected native route.

Native cache preparation occurs at model load. Android retains the verified OPFS source so a native failure or WASM fallback does not require another download. This can require an additional model-sized disk copy. No existing native models, OPFS records, settings, history or event schemas are deleted by this update.

The 1.4.0 LFM2.5 350M URL, revision, filename, size and SHA exactly match the current optional catalogue entry. No URL/checkpoint was replaced speculatively. Historical Qwen source verification was retained. Live Hugging Face endpoints, CDN redirects and any genuinely remote 404s could not be rechecked because the environment's enforced policy excludes Hugging Face. A local route 404 and a remote HTTP error are not interchangeable; actual phone logs remain needed if a remote 404 persists.

## Universal import

Manual imports are identified from GGUF metadata and a computed content hash, independently of catalogue names and preconfigured hashes. Exact known bytes can retain their catalogue ID; other files get a persisted `imported-<computed SHA-256>` identity.

- SAF metadata may omit file size or file-descriptor stat size. The URI stream is now measured during copying instead of rejecting such documents upfront.
- Unknown-size streams use bounded disk storage; the UI shows indeterminate progress. Streaming limits and available-storage errors still apply.
- The source stream is hashed before writes and the copied file is read back and compared. A mismatch rejects the import and removes only its new uncommitted temporary copy.
- Metadata parsing uses a 64 KiB sliding window and skips large tokenizer payloads. The old unconditional 16 MiB buffer limit no longer rejects otherwise valid larger headers. Work remains bounded to 128 MiB of metadata inspection, with an explicit limit error. Safe 64-bit integer metadata is accepted.
- Multi-part, malformed and truncated metadata remain errors. Metadata validity plus verified copying is separate from tensor/architecture support at actual load.
- Logs record lookup, stream opening, copy, metadata, integrity, registration, commit, native cache and load stages. Errors preserve the earliest failing stage, public code, exception type and measured byte counts. They do not include SAF URIs or signed CDN tokens.

## Actual model files and evidence

1. **LFM2.5 350M Q4_K_M**, 229,312,224 bytes, SHA-256 `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`, from the verified official 1.4.0 Web artifact.
2. An equally sized GGUF made from that same real file by changing only the first byte of `general.name` from `LFM2.5-350M` to `XFM2.5-350M`. SHA-256 `8a0731e7052e413018f0dc4e0c3d3ef9dbdccd398de5ac47e536932241e5f0e9`. Tensor weights and architecture were unchanged. It is outside the catalogue but **does not demonstrate a different architecture**.

The actual full-file test used a real local HTTP server returning 302 -> 200, real response streaming and real OPFS/IndexedDB operations. A second install reused the verified file without another network transfer (`downloadCount=1`). It imported the catalogue file, registered the out-of-catalogue variant, restarted, verified persisted bytes and generated three real output tokens with the WASM CPU engine. An unavailable native-upload boundary was injected to prove it cannot gate Android installation. Therefore this is real file/HTTP/storage/WASM evidence on Linux Chromium; it is not a Hugging Face download or physical Android test.

Qwen3.5 Q4_K_M/IQ4_XS and other families such as llama/smollm3 were exercised only as metadata fixtures. No actual Qwen, TinyLlama or SmolLM weights were available or newly downloaded. No cross-architecture inference or newly tuned model is claimed.

## Regression results

- 137 application tests and 24 native/folder/backend tests passed, no failures/skips.
- Two targeted JVM tests passed against the actual Android identity helper (plus the existing Gradle example test).
- TypeScript check passed.
- Actual full GGUF transfer/import/restart/WASM test passed as described above.
- Both OPFS writer implementations passed HTTP 403/404, network failure, incomplete body, checksum, cancellation, quota, failed replacement, unknown-size SAF stream and injected copy-readback corruption cases. The injected failures are explicitly fault tests, not device evidence.
- Model-manager regression passed picker proxy import, unknown size, cancellation, expired token, error display and preservation of an installed prior copy.
- Beta 2 diagnostic-button regression passed export dispatch, native proxy save/cancel/error/missing bridge, memory release/error/retry and prevention of immediate reload after manual release.
- Same-origin official Web 1.4.0 -> Beta 3 upgrade/restart preserved events/recurrence/reminders, themes, language/settings, conversation history, model identity and OPFS bytes.
- Native CPU smoke with the original real 350M file passed; no GPU implementation was rewritten. Existing CPU/GPU mode/fallback unit regressions passed. No physical GPU is claimed.
- Android device tests include `GgufSafImportTest` for actual content URI -> WebView stream -> OPFS -> registration/restart with a synthetic metadata fixture and an injected picker result. It must be run on a disposable Android device. Compilation is checked during APK assembly; it is not a completed physical-device test here.

The user's physical POCO X7 Pro results for Beta 2 (export JSON, release memory and update/data retention) are retained as user-provided evidence. This environment has no connected physical Android/emulator. Beta 3 import, live HF downloads and final native loading on that phone still require acceptance testing.

## Package and final acceptance

APK: `release/KALENDARZ-1.4.1-BETA-3.apk`.

Label: **KALENDARZ 1.4.1 BETA 3**; version name `1.4.1 beta 3`; version code **10403**. Existing diagnostic ID `com.kalendarz.offline.diagnostics` and test signing are retained. Install over Beta 2, without uninstalling or clearing app data. Production identifiers/signing/version settings remain unchanged. No weights are bundled in the test APK.

On POCO X7 Pro: retry LFM download, Qwen catalogue downloads and both original Qwen imports; also import a genuinely different compatible architecture if available. Distinguish “installed on disk” from “loaded in RAM”. Restart and check model/history retention, then check export and memory release. Export JSON for any failure; it now reports the failing transfer/load stage and cause. These checks precede any stable 1.4.1 release. No fine-tuning, push or publication was performed.
