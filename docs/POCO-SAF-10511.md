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

## Built candidate

Source: `1f9da700792f4156bc57c297913096fd273eb632`. APK: `Kalendarz-1.5.0-Part-2-Beta-2-SAF-10511.apk`, 24050827 bytes, SHA-256 `38c0fe24de552413389641f228ce8c440f65890b3d633a6298296c9749cd555f`. Existing package/certificate preserved; versionCode 10511. Local TypeScript, 8 bridge/diagnostic tests, browser import regression, 43 Android JVM tests and instrumentation APK compilation passed. Native regression execution is tracked in source CI; no physical POCO reproduction is claimed. No AppImage rebuild or official release.

## Final emulator result

Corrected-fixture CI passed web, desktop and Android 16: https://github.com/vex2137/Kalendarz/actions/runs/42184733603 . The required-test verifier confirms all five native methods ran, including pickerAcquiresStreamBeforeReturningToken and the 8 MiB streaming/checksum/release regression. Initial 1f9da70 CI failed only because the older random-byte fixture had no GGUF header; test-only commit 3f9f4a8 adds that header without removing assertions. Production application sources remain identical to the signed APK source.

Download: https://github.com/vex2137/Kalendarz/actions/runs/42184224491/artifacts/13486013853 (GitHub login, 30-day retention). Artifact verification/upload succeeded. POCO behavior and the precise physical SecurityException origin still require this device test.
