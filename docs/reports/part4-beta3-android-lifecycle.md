# Part 4 Beta 3 Android lifecycle regression investigation

## Evidence and scope

Compared Beta 2 `d106d770be213dcd830781cc70e7af8f1f27ba2d` and Beta 3
`a6ded3c1a0d8c15328efc293ed17ea2f65dcb589`. The user's same-device LFM2.5
350M generation regression is accepted. No Android native Java/C++ implementation
changed between these commits. Private Android job reports 129244323184 and
129450901372 prove identical CPU SHA-256 `83949aeb80b5f899e3b6297df2b547379e63570bffe8eb5276bc44516e034ed5`
and Vulkan SHA-256 `bd22254e177969e04820aea1629ef663a0a8635564d7d0380387b2947b7d3f00`.
Changes were shared model commit/recovery, the chat clock, pending proposals and
packaging/test metadata. No evidence supports blaming a missing model or GPU.

## Confirmed defects

- Android libcore UNIXProcess inherits Process.destroyForcibly(), whose default
  implementation calls destroy() again. The native destroyProcess sends SIGTERM;
  it does not guarantee SIGKILL. A child ignoring TERM survives both old steps.
  destroy() also closes live stdout/stderr, explaining the reported interrupted
  log read during shutdown. Closing the log stream is not evidence of a shader error.
- stopProcess cleared loadedId before confirming exit. JS disposeEngine retained
  its loaded flag/handle after shutdown rejection. Together these explain
  backend loaded=false versus runtime loaded=true. The new browser regression
  fails against the actual Beta 3 worktree with `true !== false`, and passes
  with the fix.
- Cleanup exceptions could replace the original inference failure with
  model-stop-timeout. Import, download, folder changes and Load await this same
  shutdown path, so an unkillable previous child blocks these operations too.

Platform source cross-check (mirror, not a POCO runtime trace):
https://github.com/GrapheneOS/platform_libcore/tree/2804897a14425d5e045ff8bc13a14ba7bef5b9bb/ojluni/src/main
The Java Process/UNIXProcess and native UNIXProcess_md.c confirm the inherited
force operation, SIGTERM, stream closure and PID string format. No hidden Android
API or user-supplied PID is used by the fix.

## Changes

Explicit TERM then KILL of the still-owned direct child, bounded exit confirmation,
and descriptor/pipe closure after exit. Escalation runs independently of the busy
inference worker. HTTP cancellation runs outside the UI thread. Old child handles
cannot target a successor. Expected shutdown log interruptions are excluded from
GPU startup errors. Failed shutdown keeps ownership/resources available for retry.

Backend diagnostics distinguish readiness, processAlive, stopping and shutdownError.
Runtime refreshes the authoritative backend after failure; a stale handle is not
presented as loaded. The original inference error survives failed cleanup.
Inference evidence reports only stage, HTTP status, backend, verified text/token
counts, finish reason and safe error type/code; no prompts or message content.
No GGUF, user database, history, preferences, folder grants or model registry is reset.

## Tests before diagnostic build

- PASS: TypeScript.
- PASS: 274 existing unit tests (no failures).
- PASS: 22 targeted Node native/store/stream tests, including Linux model-free
  default import, restart, corruption, duplicate and failed-commit recovery.
- PASS: 6 JVM process lifecycle tests, including actual termination of a
  TERM-ignoring host child. This is Linux process validation, not Android inference.
- PASS: 7 Python tests for historical Beta 3 and diagnostic identity/provenance.
- PASS: browser diagnostic controls/state/first-error regression, backend mode
  switching and GGUF import/restart scripts. Native boundaries are simulated.
- EXPECTED FAIL: the new stale-loaded regression on the unmodified Beta 3 app.
- NOT TESTED: real Android native generation, ARM64 lifecycle instrumentation,
  SAF provider/device picker, Mali inference and Android installation. No attached
  phone/emulator or Android SDK is available in Cloud; Actions compiles device tests.

## Remaining uncertainty and diagnostic delivery

The first cause of LFM generation failing on this POCO has NOT been reproduced.
The confirmed lifecycle bugs mask that failure; do not claim GPU inference repaired
from health HTTP 200, offload counts or CI. The Android diagnostic uses the same
engines, package and update certificate, versionCode 10525, versionName
1.5.0-part4-beta.3-diag.1. Only a private diagnostic APK is built; no new beta,
Release, tag, PR merge or desktop packages are published.

On POCO, install as an update without clearing data. First test the existing
LFM2.5 350M in CPU mode: load, send a short ordinary question, require visible
nonempty streamed tokens, Stop, release memory, reload and generate again.
Then repeat in Vulkan and Auto; GPU success requires tokens and confirmed offload,
not health alone. Test adding a GGUF folder and importing a file, including cancel.
Restart the app and verify existing model registrations/events/history remain.
After a failure export diagnostic JSON before retry: backend.inference,
backend.processAlive/stopping/shutdownError, backend.gpuAttempt and runtime state.
Do not delete/re-download existing models to perform this test.
