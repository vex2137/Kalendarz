# Android Part 2 Beta 6 manual candidate

Continues the physically accepted Beta 5 Android source 7c4785c. The exact verified
b12189 ARM64 CPU executable is recovered from the private Beta 5 Actions artifact,
with APK certificate, source and SHA-256 verification. Only the executable and
native notices are reused, never old frontend assets. No llama.cpp rebuild, GPU
inference backend or GGUF is added. Shared assistant CRUD/undo/proposal logic is unchanged.

The independent ARM64 Vulkan helper dynamically opens the Android system loader.
Discovery reports loader instance API (not an invented loader build version),
physical devices, IDs/types, raw driver version, optional driver properties,
compute queue families, limits, memory heaps/budgets, relevant extensions/features,
subgroups and storage formats. Heap budgets are explicitly not confirmed dedicated
VRAM. CPU/software devices are distinguished from hardware GPUs. Hardware discovery
never changes requested inference mode, prepares a model, or claims GPU offload.

Compute runs only after the dedicated button is pressed, with native confirmation
required. A Vulkan 1.0 uint shader performs 64 additions in a 768-byte buffer;
host readback checks every result. The logical-device resources are released on
success/error. Fence wait is capped at 2 seconds and the whole isolated process at
6 seconds. On an in-flight timeout the helper exits instead of illegally destroying
resources still in use; process/driver teardown reclaims them. The Java watchdog
also covers stuck driver calls/teardown. Calls are serialized, output is bounded,
and a still-running killed helper blocks repeated process creation. No app UI
thread blocks and no inference process/model files are touched.

QR generation now has explicit password protection, enabled by default. Turning it
off generates the existing KAL2 gzip/checksum format and displays an access warning.
Protected KAL3 remains PBKDF2-SHA256/600000 + AES-256-GCM, with no empty-password
fallback. Encrypted, unprotected and older JSON formats remain readable. Import
still requires explicit confirmation; cancellation does not write data.

The private `build-android-beta5.yml` workflow now has an `android_beta` profile
selector (default 6). Dispatch on private main with the exact current public
`feat/1.5.0-part2` SHA and profile 6. It reuses the existing encrypted one-use signing
handoff; no secrets are changed. Install its template from
`scripts/android-beta5-private-build.yml`. VersionCode is 10517, application ID and
ae055d7e...564143 update certificate are retained. The Beta 6 guard verifies both
ARM64 executables, helper source/shader/binary hashes, unchanged CPU hash, APK
identity/alignment/signature, clean source and current public HEAD. Build metadata
separates the application branch/SHA from the private workflow's main branch/SHA.

Local checks passed: TypeScript, 14 targeted sync/GPU unit tests, 8 helper-process
JVM tests, 11 Beta 5/6 package guards, mobile/desktop GPU panel browser tests with
mock native transport, and real encrypted/plain QR-image scanning plus JSON
export/file-input import browser regression. Full Android JVM and shared assistant
regressions execute in the private build. Actual C++ Vulkan shader tests run with
Mesa's software ICD in Actions, including deliberately corrupted readback and an
unavailable ICD. This is not evidence of phone GPU or GGUF GPU inference.

POCO acceptance remains necessary: in-place installation with retained data/models,
Android loader/vendor driver discovery, opt-in Compute result/timeout, real system
file picker/camera, clipboard, background/orientation, and unchanged offline CPU AI.
No ARM64 phone/emulator is attached to Cloud; device instrumentation is compiled,
not executed. The existing Beta 5 CPU engine was physically accepted by the user;
Beta 6 does not pretend to repeat that physical test.
