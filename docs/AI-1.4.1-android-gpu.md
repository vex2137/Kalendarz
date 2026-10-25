# Android GGUF import, native GPU candidate and performance follow-up

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. This supplements `AI-1.4.1.md` and supersedes its earlier Android SDK/build availability limitation. It does not remove hardware or release verification gates.

## Starting state and scope

All five requested commits (`dd9787a`, `e227a52`, `f105444`, `67989a0`, `8189e33`) exist in this branch, followed by the two prior beta APK commits. The working tree was clean at the start. Existing implementation and model identities were retained. No push, release publication, production signing changes, application ID changes or event schema changes were made.

Implementation commits:

- `c1c4673`: content-addressed GGUF imports, Android native bridge/runtime build and bounded conversational output.
- `0a9099d`: CUDA/Vulkan/Metal selection, optional pinned CUDA staging, source diagnostics and actual inference benchmark runner.
- `6d4f09d`: device packaging and browser import tests, readable metrics, compatibility guards and validation evidence.
- Subsequent UI copy corrections remove the obsolete exact-catalogue import requirement and clarify that the preferred model may need download/import. Validation commits cover the device packaging test, browser imports/restart, readable metrics, compatibility guards and this report. The final APK provenance is in its sidecar build metadata.

## Import failure: confirmed code defects versus device evidence

Previously both web and Android imports selected a descriptor **by exact catalogue byte count** and then required its pinned SHA-256. A different valid conversion or quantization was rejected before the engine saw it. An exact bundled-model import was also rejected as redundant. This explains a reproducible class of failures; without the two device files and exported logs, it does not establish the unique cause of every reported failure.

Imports now inspect bounded GGUF v2/v3 metadata, identify the architecture and `general.file_type`, reject malformed/truncated/multipart input, and compute a chunked SHA-256. Exact known files retain their catalogue identity. Other files get `imported-<sha256>` identities and persisted descriptors. Both Q4_K_M (file type 15) and IQ4_XS (file type 30) are recognized. Tensor/architecture compatibility remains an actual engine-load check; successful selection or storage is not labelled successful inference.

Android SAF continues using transient read grants and opaque tokens for `content://` documents. Metadata queries now run off the UI thread. Model bytes stream to disk, never through a whole-file base64 bridge. Native storage uploads use 256 KiB chunks; native inference opens the private model file directly. A failed replacement does not remove the previous verified copy. Original SAF documents are never written or deleted.

Imported models appear in model selection and survive restart. Descriptors are additive local settings; events, recurrence, reminders, AI history and existing settings are unchanged. Legacy OPFS bytes migrate to native storage only after verified native commit. Auto can still use WASM when native execution is unavailable.

Limitations: import staging plus native upload may temporarily require two model-sized disk copies. Interrupted uncommitted staging can leave temporary bytes. Unknown-size/non-local SAF documents need to be made available locally. The real two Qwen quantization files were unavailable here; synthetic metadata fixtures are storage/parser evidence only.

## Android native engine

The explicit native test build includes llama.cpp **b11669 / 620d2225cc436ab0b001e3200e590e3b286ef9ab**, cross-compiled with NDK 29.0.14206865 for ARM64, Android API 28+, CPU and Vulkan. The PIE executable is packaged as an extracted native library; ELF dependencies and 16 KiB load alignment were checked. Required source and third-party license notices accompany it.

A single authenticated loopback server serves all GPU vendors. Java owns the executable path, model paths and arguments. The WebView cannot supply arbitrary paths or launch commands. Networking permits cleartext only for `127.0.0.1`; other traffic keeps HTTPS defaults.

- CPU bypasses GPU probing.
- Auto probes the actual Vulkan runtime/device, excludes software devices, tries GPU, then releases its process before one CPU fallback.
- GPU-only reports failure and does not silently run CPU/WASM.
- Native model/context loading, token generation and cancellation run outside the UI thread. Cancellation interrupts HTTP and tears down the child process with bounded termination.
- GPU activity requires offloaded layers **and generated tokens**. Enumeration alone never marks GPU active.
- Driver/memory/load failures are handled through child-process isolation and explicit fallback/error status. Portable Android per-process VRAM/utilization counters are unavailable and are not fabricated.

Qualcomm Adreno, MediaTek/Exynos/Tensor Mali, Exynos Xclipse and other devices are candidates based on actual driver capability. **No physical Android GPU was tested.** There is no claim that every device in any vendor family works. The native beta APK contains ARM64 libraries; native execution is gated on Android 9+. Older supported ARM64 Android versions retain WASM. Normal builds without `CALENDAR_ANDROID_NATIVE=true` retain their original packaging.

## Desktop GPU selection

- CUDA is preferred when a pinned, checksummed optional CUDA runtime has been staged. Vulkan is tried as an alternative before Auto falls back to CPU.
- Vulkan remains the common NVIDIA/AMD/Intel path on Linux/Windows.
- macOS now probes/selects Metal from the existing verified macOS runtime; previous startup always disabled GPU with `--device none`.
- GPU-only never starts CPU. Each GPU backend is tried at most once per preparation.
- CUDA and Metal diagnostics preserve their actual backend identities. macOS process RSS collection was added when available.

`stage-cuda-runtime.py` pins the published b11669 Linux CUDA 12.8 and Windows CUDA 12.4 server/runtime archive digests. It is opt-in because NVIDIA redistributables can be large. It was syntax-checked, not downloaded/staged or executed here. ROCm was not added. Windows/macOS execution and CUDA/Metal hardware remain unverified.

## Performance findings

There was no evidence that the resident engine reloads on every request: it already reuses a loaded model and prompt cache. The WASM runtime is CPU-only and can be single-threaded if WebView isolation/shared memory support is missing. Its installed model is fully verified at cold load. These are measurable contributors, not a conclusive diagnosis of the reported 60-second phone response.

Plain chat now defaults to at most 96 output tokens instead of 256. Structured commands retain their established budgets; explicit benchmark overrides still win. Qwen thinking was already disabled and remains disabled. The five-minute active-assistant residency policy is retained. A native committed upload's verification cache survives its atomic rename, avoiding another full SHA pass immediately before first load.

Diagnostics now show model/quantization/bytes, disk versus RAM state, selected and active backend, actual GPU/layers, fallback, errors, storage/verification/backend initialization/prompt/generation/total times, first token, input/output tokens, context, thread count, tokens/s, and measured memory when available. Missing counters display as unavailable. JS heap is labelled separately from native process RAM.

### Actual CPU benchmark

Evidence: `docs/evidence/ai-141-native-cpu-benchmark.json`.

Environment: Debian Linux x64, Intel Xeon Platinum 8573C, two available CPU threads; LFM2.5 350M Q4_K_M, 229,312,224 bytes, SHA-256 `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`, obtained from the verified official 1.4.0 Web artifact. These are **not Android or Qwen 0.8B results** and not a speedup comparison.

| CPU mode | Input/output tokens | Response excluding model load | First token | Decode tokens/s |
| --- | --- | --- | --- | --- |
| Short, first prompt | 40 / 6 | 420 ms | 217 ms | 26.0 |
| Short, repeated prompt | 40 / 6 | 254 ms | 60 ms | 30.6 |
| Longer, first prompt | 444 / 119 | 8,426 ms | 3,657 ms | 24.8 |
| Longer, repeated prompt | 444 / 119 | 2,000 ms | 31 ms | 60.0 |

Initial CPU model preparation took 979 ms, separately measured. Warm requests reused real cached tokens. Auto also selected CPU, with results recorded in the evidence file; scheduling variability prevents attributing differences to a backend change. Eight actual CPU completions finished normally. GPU-only returned `model-gpu-unavailable`; the physical device probe returned `(none)`. **No CPU/GPU speed comparison or GPU throughput measurement was possible.**

## Downloads / HTTP 404

HTTP 404/410 (missing file/revision), 401/403 (access denied), network failure, truncated download, checksum mismatch, storage/quota error and unsupported GGUF now have separate paths/messages. Short HTTP bodies are classified as incomplete downloads. Expired local SAF streams produce import errors, not misleading remote-download errors. SHA checks and transactional writes remain mandatory. Automatic partial resume was not added; retries start safely from scratch.

The existing URLs were checked against the available historical source-verification report; their checkpoints were not replaced speculatively. Live Hugging Face verification is **blocked by this environment's explicit network policy**. Therefore the reported remote 404 is **not declared fixed**. Run `node --import tsx scripts/diagnose-model-downloads.ts` on an allowed network; it checks each pinned revision, filename, size, SHA metadata and a bounded download header, then writes `model-download-diagnostics.json`. It never downloads full weights or sends calendar content.

## Verification

- **133 application tests passed; 24 native/storage/folder tests passed; zero final failures or skips.**
- TypeScript check and beta frontend production build passed.
- Browser GGUF import UI: both quantization metadata fixtures, SHA identities, native OPFS writer and sync worker, original-file preservation and restart passed. No inference claim for synthetic files.
- OPFS downloads/imports: HTTP, incomplete body, checksum, cancel, quota, failed replacement and orphan recovery passed with both writer implementations.
- Calendar browser regression suite passed: CRUD, non-destructive import, settings, PIN/lock, cross-tab writes/deletion, responsive layouts, 10k agenda and offline reload.
- Official 1.4.0 Web artifact → beta same-origin upgrade/restart passed: recurring event, reminders, custom theme/language/settings, AI history, model identity and OPFS bytes preserved. This is a Web migration check, not a signed Android production upgrade test.
- Real 350M native CPU smoke passed model load, generation, cache, cancellation, unload/reload. This is a lifecycle check, not broad model-quality certification.
- Injected failing GPU process exited before real CPU inference; bounded fallback/cancellation/cleanup passed. Shutdown-timeout tests additionally verify that a still-live child remains owned and CPU startup is blocked. This is fault injection, **not physical GPU proof**. Real runtime also rejected invalid GGUF without leaving a child process.
- Android C++ CPU/Vulkan cross-build passed; beta APK and instrumentation APK compiled successfully. `NativeRuntimePackagingTest` is prepared to verify installed executable permissions and pinned runtime version on ARM64 Android; it was **not run on a device**.
- No physical GPUs tested. No physical Android/emulator available. Windows and macOS were not executed. No new remote CI run exists because nothing was pushed. New CI jobs prepare cross-compilation and import regressions; their remote results remain pending.

## Test APK and device procedure

Artifact: `release/Calendar-1.4.1-beta-android-native-test.apk`; instrumentation package: `release/Calendar-1.4.1-beta-android-native-device-tests.apk`. Version name remains **1.4.1 beta**, version code 10401, application ID `com.kalendarz.offline.diagnostics`, existing test signing. It updates the previous beta when the same test key is used and installs alongside the official application. Do not uninstall or clear the official app's data.

No model weights are bundled. Import the existing Qwen GGUF or download/import a catalogue model explicitly. Desktop folder support and the previous APK remain available.

```sh
adb install -r release/Calendar-1.4.1-beta-android-native-test.apk
adb install -r release/Calendar-1.4.1-beta-android-native-device-tests.apk
adb shell am instrument -w -e class com.kalendarz.offline.NativeRuntimePackagingTest com.kalendarz.offline.diagnostics.test/androidx.test.runner.AndroidJUnitRunner
```

In AI settings import each Qwen quantization, run the diagnostic cold/warm test in CPU, Auto, then GPU-only, and export JSON. Confirm actual `vulkan`, `gpuActive=true`, positive offloaded layers and generated tokens before claiming GPU success. Reopen the app to verify disk/model/mode persistence; test cancellation and switching models. If GPU-only fails, its error is evidence to investigate, not a CPU benchmark. Auto should expose the cause and use CPU.

## Reproduction

```sh
# Install Android SDK, Java 21, host g++/make, NDK and CMake first.
sdkmanager 'ndk;29.0.14206865' 'cmake;3.31.6'
python3 scripts/build-android-native.py --sdk "$ANDROID_HOME" --jobs 2
node scripts/prepare-beta-apk.cjs
CALENDAR_BETA_APK=true CALENDAR_ANDROID_NATIVE=true node node_modules/vite/bin/vite.js build
npx cap sync android
cd android
bash gradlew :app:assembleDiagnostics :app:assembleDiagnosticsAndroidTest -PcalendarBeta=true -PcalendarAndroidTestBuildType=diagnostics --no-daemon --max-workers=2
```

Desktop optional CUDA staging: `python3 scripts/stage-cuda-runtime.py --target linux-x64` (or `win-x64`) after preparing the default runtime. Actual desktop benchmark: `CALENDAR_MODEL_FILE=/path/to/model.gguf node tests/benchmark-backends.cjs`. These operations do not publish anything.

## Remaining release gates

Physical ARM64 Android installation, native server execution, both actual Qwen quantizations, GPU offload/driver errors, thermal/memory behavior and CPU/WASM/Vulkan comparison still require device evidence. Live download URLs require an allowed network and the offending 404 URL/log. CUDA staging and hardware, Metal/macOS and Windows builds require their platforms. Production signing/upgrades and existing Flatpak/CI gates remain. This candidate is **not certified ready for a public release**.
