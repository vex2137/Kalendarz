# Android Part 2 Beta 5 manual candidate

Based on the shared desktop Beta 5 assistant (e83a268). Calendar command parsing,
PL/EN CRUD, multi-event previews/conflicts, confirmation/cancellation, atomic
IndexedDB writes, diagnostics JSON and per-model generation settings are shared;
there is no Android-specific command parser. Existing model files/data are retained.

The Android-only manual build uses a fresh, checksum-pinned b12189 ARM64 CPU
runtime, not Linux binaries or the old b11669 cache. GPU is not packaged/claimed
by this profile. Runtime metadata drives diagnostics. Startup logging is explicit;
context has an Android safety ceiling of 32768 (not the model's declared maximum),
and Android memory pressure rejects a new load before spawning. Unknown model KV
requirements are not presented as a proven RAM capacity guarantee.

VersionCode 10516 supersedes the previous 10515 candidate. Diagnostics package ID
and the ae055d7e...564143 update certificate are mandatory. The independent Beta 5
guard preserves the existing paired Beta 2 checks unchanged. Both checkout and
live branch HEAD must match; the APK embeds clean source metadata and the runtime
hash/pin. ZIP integrity, ELF64 AArch64 PIE, 16 KiB alignment and signature are checked.

Dispatch `.github/workflows/publish-142.yml` on `feat/1.5.0-part2`, target
`android-beta5`. It uses existing `CALENDAR_ANDROID_UPDATE_*` secrets, then transfers
the signed APK to the private `vex2137/Kalendarz-private-builds` LFS object store
without committing any binary or pointer. `CALENDAR_MODEL_DEPOT_TOKEN` needs
Contents read/write on that private repository (LFS upload and repository_dispatch).
Install `scripts/android-beta5-private-delivery.yml` as
`.github/workflows/deliver-android-beta5.yml` in that private repository's main branch.
The receiver independently verifies bytes, source and certificate before uploading
an authenticated private Actions artifact, retained 30 days. No Release is created.
Never upload the APK as an artifact of the public application repository.

Local checks: 28 focused Android-compatible JVM tests, 5 Android package guards,
14 existing paired-candidate guards, TypeScript, and one Capacitor adapter browser
scenario passed. The adapter transport is mocked; it exercises import byte encoding,
prepare/context, 1500 output tokens, literal `null`, stop/remove/abort and invalid IDs.
Existing desktop Beta 5 assistant tests remain applicable to unchanged shared code;
the Actions build also runs its Beta 4/5 browser regressions and all Android JVM tests.

No ARM64 emulator or phone is connected to this Cloud session. Device tests are
compiled by Actions but not represented as executed. On POCO verify an in-place
update, retained settings/history/GGUF, real offline Qwen/LFM inference, cancellation,
SAF import/removal, PL/EN two/three-event proposals, edits, conflicts and no writes
before confirmation. Verify orientation, keyboard and background/resume. Screen
rotation/lifecycle and physical memory/inference remain device acceptance checks.
