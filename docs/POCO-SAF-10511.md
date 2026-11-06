# POCO local Downloads SAF follow-up — candidate 10511

Physical POCO Android 16 still fails on 10510. This candidate does not claim a confirmed physical-device fix.

The precise previous native catch covered both `ContentResolver.openInputStream(contentUri)` and the `SafImportSession` constructor's initial eight-byte read. Every SecurityException was mapped to model-import-permission; therefore that code alone did not prove that the system withheld a URI grant. Java exception details were discarded when rejecting the bridge call, and the UI showed the JavaScript Error type. No content URI is converted into a filesystem path, and imports use the Activity plugin's executor, not the transfer foreground service.

Compared directly with tag v1.4.1: ACTION_OPEN_DOCUMENT, CATEGORY_OPENABLE, READ flag, callback getData().getData(), ContentResolver metadata/stat operations and exact URI retention are unchanged. 1.4.1 opened through a WebView interceptor; 10510 opened later through the native bridge. Neither obtained a permanent grant. A read grant from the real system result belongs to the application UID and should be usable by its threads. Existing emulator tests inject a same-UID FileProvider result; they do not reproduce POCO Downloads-provider grant enforcement.

Minimal candidate: acquire and retain the bounded SAF reader inside the picker result handler before resolving its token to JavaScript. The bridge then consumes this already-open reader. Keep the temporary read grant, request no storage-wide permissions and do not retain permanent access. File format, SHA-256, OPFS copying and installed-model protection are unchanged.

Safe failure diagnostics now include resolver-open vs header-read vs copy, full exception class and up to eight class/method stack frames (no messages, URI, filenames or paths), READ/PERSISTABLE result flags, checkUriPermission result and an allowlisted provider category. The UI and exported JSON retain these fields rather than asserting that any SecurityException proves a missing grant.

Regression: pickerAcquiresStreamBeforeReturningToken unlinks the fixture after the picker returns; the retained descriptor must still yield GGUF bytes. This fails with the deferred-open implementation. Native exception-stage/redaction and TS bridge/export tests cover safe failure reporting. This fixture tests descriptor acquisition, not a real cross-UID Downloads grant.

## Next POCO test

Install 10511 as an update without clearing data. Select the same local Downloads GGUF. If it fails, copy the displayed native stage/type and export AI diagnostics JSON. The `nativeSaf` field in import error actions contains the safe grant/stack evidence. Optional log capture:

```sh
adb logcat -c
# Select the GGUF once, then:
adb logcat -d -s CalendarModelImport:I > poco-saf-10511.log
```

These application log entries exclude document URIs and provider exception messages. Do not send unrestricted logcat or a private file path. Success on an emulator does not establish that the physical POCO issue is fixed.
