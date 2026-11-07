# Android model transfer acceptance

The Android download path uses `CalendarModelTransferService`, a user-started
`dataSync` foreground service. Its network reads, 256 KiB copy buffer, 4 MiB
durability checkpoints, SHA-256 verification and atomic installation do not
depend on a mounted React view or an executing WebView timer. The WebView polls
the service for current state and can reconnect after recreation. A wake lock is
held while the native operation runs. Neither weights nor signed download URLs
are written to logs or notifications.

The notification shows actual bytes/percentage, a verification phase, and Pause.
Tapping it reopens the application. Android can hide ordinary notification UI
when notification permission is denied; foreground-service visibility then
follows the system's Active apps UI. The application still exposes Cancel.

A private journal saves the strong ETag before body data. Actual partial-file
length determines the next Range offset. Changed/missing validators, ignored
Range, malformed Content-Range and 416 use a bounded safe restart. Completion
requires the pinned size, GGUF magic and full SHA-256 before an atomic rename
into the existing native model directory. Failed verification preserves the
previous installation. Prior OPFS checkpoints are copied in bounded chunks and
retained until native installation succeeds.

Android 15/16 can impose the background `dataSync` time budget. `onTimeout`
pauses and checkpoints work, removes foreground state, and stops the service.
Process death leaves the partial file and journal for explicit resume. The
service uses `START_NOT_STICKY`; it makes no promise of automatic continuation
after force stop, device reboot, quota exhaustion or vendor battery restrictions.

## Completed Cloud validation

`ModelTransferCoreTest` passed 11 isolated JVM tests with Android-compatible
`org.json`: bounded streaming, complete installation, cancellation and a new
engine resuming from disk, strong ETag/If-Range, changed validator, ignored Range,
416, malformed Range, checksum rejection without replacing an installed file,
GGUF magic, verification receipt consistency, metadata/notification failures,
and a real loopback HTTP disconnect followed by Range resume.

`ModelTransferServiceTest` is an Android instrumentation test for the actual
service against a slow loopback HTTP server. It stops the Activity, observes
continued native progress, pauses through the notification action's handler,
recreates the Activity, resumes with Range and checks final verified bytes. It
requires a disposable API 29+ device and has not been executed in Cloud. The
test fixture is synthetic storage data, not an inference model.

## POCO / Android 16 acceptance

1. Update the existing diagnostics application without uninstalling it. Confirm
   retained events, settings, AI history, model selection and installed models.
2. Start a real GGUF download while the app is visible. Check increasing bytes,
   speed, ETA and the notification percentage. Visit the calendar, AI chat and
   settings, then return to models: progress must reflect the native transfer.
3. Minimize the app, then lock the screen for several minutes. Reopen it and
   compare received bytes. Record any POCO battery restriction or system pause;
   do not infer background reliability from the JVM tests.
4. Pause from the notification. Check that received bytes remain saved and the
   app offers Resume. Resume and confirm the initial byte baseline is retained.
5. Disconnect networking during transfer, restore it and explicitly resume.
   Verify the final model only gains Installed/Use after checksum validation.
6. Kill the process from a test shell while downloading, reopen and resume. A
   manual Settings → Force stop is a separate system action: continuation is not
   expected until the user opens the app and resumes.
7. Test notification denial and low free space. Existing installed weights must
   remain usable after a failed transfer. Check that PIN/password and background
   lock continue to work while a transfer is active.
8. On a disposable device, run `ModelTransferServiceTest` and the SAF import
   instrumentation tests from the matching test APK. Keep actual system-picker
   selection, screen locking and vendor battery behavior as separate manual
   acceptance checks.

Use `adb shell dumpsys activity services com.kalendarz.offline.diagnostics` to
inspect the running service's foreground type/lifecycle. Capture application
diagnostics and byte baselines before and after each step. Do not share private
journal contents: they can contain the original download URL.
