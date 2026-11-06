# POCO X7 Pro / Android 16 — Downloads raw document open, APK 10512

## Evidence and exact API dispatch

Physical 10511 logs report resolver-open, java.lang.SecurityException, Downloads provider, readFlag/persistableFlag/readGranted=true and ContentProviderProxy.openTypedAssetFile. This identifies a provider rejection of the typed-asset call, not evidence of a missing app URI grant. The provider's internal reason remains unknown without device-specific provider evidence.

The application called ContentResolver.openInputStream on the unmodified content URI. Android 16 AOSP dispatches this to openAssetFileDescriptor("r"), then openTypedAssetFileDescriptor("*/*"). Critically, ContentResolver.openFileDescriptor("r") also dispatches via openAssetFileDescriptor: simply replacing openInputStream with that API would retain the same failing route.

Reference: https://github.com/aosp-mirror/platform_frameworks_base/blob/android-16.0.0_r1/core/java/android/content/ContentResolver.java (openInputStream, openFileDescriptor and openAssetFileDescriptor).

## Scoped change

For non-virtual DocumentsContract document URIs from com.android.providers.downloads.documents, use ContentResolver.acquireContentProviderClient with that exact URI, then public ContentProviderClient.openFile(uri,"r",null). It dispatches the provider's raw openFile API using the resolver's application attribution and URI grant. This is a regular SAF access route, not a privilege bypass: a raw provider SecurityException still fails the import. No broad storage access, URI rewriting, media-ID extraction, filesystem conversion, permission escalation or package change.

Keep the provider client alive with its AutoCloseInputStream and close both on completion/cancel/error. Pipes and large files remain sequential 256 KiB reads. Other provider types retain asset-stream semantics (including offsets); virtual documents are rejected rather than treated as whole GGUF files. Unknown size is measured during streaming, avoiding an extra resolver stat open through the same failing typed path.

Picker result uses getData unchanged, with a single ClipData URI fallback. URI scheme/authority are validated. Opening still occurs in the result handler before returning the opaque token. The Activity resolver, application UID, package and grant check are retained; no import service or other process receives the URI. Diagnostics expose safe booleans for DocumentsContract/virtual status, ClipData source, UID match, known package identity, opening method, native exception type/stage and redacted frames. No URI, authority outside an allowlist, document ID, filename or provider message is exported.

Compared directly to v1.4.1: picker/read flag and URI retention are unchanged; that version also used openInputStream and hence the typed route. The working older-device observation does not establish that typed opening works on this POCO/provider/version today. 10511 eager opening did not fix the confirmed typed-API rejection; this candidate changes the API dispatch itself.

## Regression and acceptance

A test-APK-only provider rejects typed opens while allowing raw openFile. The regression checks both resolver input-stream and resolver PFD routes fail, then runs the production raw opener plus bounded GGUF reader over 8 MiB. Another regression preserves raw provider denial and rejects file://. Existing callback/unlink regression now supplies only ClipData. Existing GGUF/checksum/installed-model protection tests remain.

This models the API mismatch, not Xiaomi's internal implementation. Physical POCO success remains unconfirmed. Update without uninstalling/clearing data, import the same local Downloads GGUF and export diagnostics on failure. The expected new opening method/stage is provider-open-file; a failure there means the raw provider also refused access. uri-validation identifies invalid/unsupported selection; resolver-open indicates the asset route was chosen for another provider/URI type. A granted URI is never treated as proof that an open must succeed.

Package remains com.kalendarz.offline.diagnostics, pinned update certificate ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143, versionCode 10512. No Vulkan/CUDA/UI redesign or AppImage build.

## Built artifact

Source `9c7ac0d7c940ccb851c2fd9d2db9d9ae0dd39f68`, file `Kalendarz-1.5.0-Part-2-Beta-2-SAF-10512.apk`, 24345246 bytes, SHA-256 `424a81f647702add5e3321b15847047acef29c1fa30c5995499a9ad2a28bc1bc`. Signature/alignment/package/version/clean provenance and absence of weights/test provider verified. TypeScript, 9 targeted bridge/diagnostic tests, 43 JVM tests and instrumentation compilation passed locally. Initial test compilation exposed a chained void Intent.setClipData setter; test-only commit 9c7ac0d corrects it. Actual provider-route regression execution is tracked by source CI; no physical POCO success is claimed.

## Final verification

Source CI passed web, desktop and Android 16, with the verifier requiring all seven native methods: https://github.com/vex2137/Kalendarz/actions/runs/42213420161 . PR CI also passed: https://github.com/vex2137/Kalendarz/actions/runs/42213426854 . The provider regression demonstrates the reported typed/raw API distinction on an emulator, not a confirmed POCO fix.

Signed APK download: https://github.com/vex2137/Kalendarz/actions/runs/42213661650/artifacts/13499264430 (GitHub login, retained 30 days). Verification/upload: https://github.com/vex2137/Kalendarz/actions/runs/42213661650 . Source comparison against v1.4.1 also found no difference in android/variables.gradle or capacitor.config.ts; the diagnostics applicationId suffix already existed and the old manifest did not request broad storage access.
