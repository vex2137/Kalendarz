# Beta 2 SAF import repair

## Finding and limits

The reported `stream-open` diagnostic is emitted by `downloadModel` immediately before opening the document transport in `src/utils/localModelStore.ts`. In that stage, `model-import-file` means the local `/_calendar_model_import/<token>` HTTP proxy returned a non-success response. It does not establish an Android permission failure. Previously the native proxy converted an absent token, a denied URI, a missing document, and any other provider exception into the same HTTP 404; JavaScript then replaced that response with the same generic error.

Comparison of tag `v1.4.1` with application commit `b25d7e7` found identical picker, URI URL builder, WebView interceptor, service-worker interceptor and `ContentResolver.openInputStream` implementation. The new resumable HTTP download branch explicitly excludes the SAF proxy URL. No source change in that branch explains the POCO failure. Without its native log, it is not possible to distinguish provider failure from a missing token or request-routing failure on that device.

A concrete lifecycle defect was present: the static token map was cleared whenever **any** importer plugin instance was destroyed. An older Activity could invalidate a replacement Activity's tokens. Cleanup is now limited to tokens owned by that instance. This race was found in code; it has not been reproduced on the physical POCO.

## Repair

The system `ACTION_OPEN_DOCUMENT` picker still returns an opaque token. URI and filesystem paths remain native. Local import now opens and reads the `ContentResolver` stream through the Capacitor plugin, without requiring the WebView or service-worker HTTP interceptor to open it. Native reads are capped at 256 KiB and issued only when the OPFS consumer requests the next chunk. Base64 exists only for that bounded bridge chunk; the complete model is never buffered in JavaScript or native RAM.

The native session rejects invalid GGUF magic/version (versions 2 and 3 are accepted), detects premature EOF against a declared size, measures unknown sizes, and caps input at 16 GiB. Existing bounded metadata inspection, source/copy SHA-256 comparison, independent stored-file verification and transactional OPFS registration remain in place. Import does not modify the selected source document. Failure discards only staging data; existing models remain installed.

The original HTTP proxy remains compatible and now reports a safe error-code header. New diagnostics distinguish expired sessions, permission denial, unavailable provider files, incomplete reads, invalid GGUF and other read failures. Logs contain stage, safe code and exception type, without provider messages, document URIs or private paths. The existing transient SAF read grant is sufficient for an active import; imports interrupted by process death require selecting the source again. No broad storage permission is requested.

## Regression coverage

- `tests/native-model-import.test.ts`: backpressure, 256 KiB bridge chunks, exact provider error codes, cancellation, oversize-chunk rejection and local-token routing boundaries.
- `tests/gguf-import.test.ts`: GGUF identification, hostile/truncated/multipart rejection, large metadata windows, SHA-256 and independent content-addressed storage.
- `tests/model-actions-browser.cjs`: a forced HTTP 404 import proxy still permits successful native-bridge import; unknown size, provider/permission failures preserve the previous model; picker cancellation remains visible.
- Android JVM `SafImportSessionTest`: generated 128 MiB input with bounded source reads and identical hash, short reads, invalid/truncated headers, missing provider, incomplete declared size and cancellation.
- Android instrumentation `GgufSafImportTest#importNonCatalogueGgufThroughSafAndRetainAfterRestart`: actual picker callback, content URI, native chunk bridge, OPFS, failed-import preservation and Activity recreation; the HTTP import route is deliberately forced to 404.
- `GgufSafImportTest#nativeBridgeReportsExpiredTokensWithoutPrivatePaths`: actual plugin rejection is the safe session-expired code.
- Existing `CalendarSmokeTest#safPickerStreamsContentUriAndReleasesAccess` retains coverage of the legacy proxy and token release.

Fixtures are synthetic metadata/storage fixtures, not inference weights. Consult the session report/CI for actual execution results; the presence of these tests is not a claim that all ran on a physical device.

## Required POCO Android 16 acceptance

1. Install the signed update over the existing app without clearing data. Check events, settings, security credentials, chat history and existing models.
2. Use the actual system picker to select `kalendarz-qwen35-v2-q4_k_m.gguf` in phone storage. Confirm import completes, bytes match the source, the model is installed/verified, and the source file remains unchanged. Test the same file through Downloads and the phone's document provider.
3. Repeat with a large GGUF and watch memory/storage behavior. Close model settings while importing, return and confirm the real result. Insufficient storage or a revoked/unavailable document must leave the old model usable.
4. Select a non-GGUF file renamed `.gguf`, a truncated GGUF and cancel the picker. Confirm meaningful errors/cancellation and preservation of existing models.
5. Capture only the relevant native diagnostics when a failure occurs:

   ```sh
   adb logcat -c
   adb logcat -v threadtime CalendarModelImport:I Capacitor/Console:E '*:S'
   ```

   Reproduce once and retain the safe stage/code/type. Do not publish full unrestricted logcat, document URIs or private paths. A successful import does not establish Vulkan/CUDA inference.
