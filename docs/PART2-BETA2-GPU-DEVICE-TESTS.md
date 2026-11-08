# Part 2 Beta 2 — physical GPU acceptance

The POCO report establishes Mali-G720 MC7 enumeration and a GPU failure at
`native-startup`. It does not establish the failing Vulkan call or successful
Vulkan inference. This Cloud session has no physical POCO or RTX 4060. No driver,
kernel, Limine or GPU Unlock changes are required or included.

## What was inspected and changed

The Android runtime recovered from the checksum-verified previous Beta 2 APK is
ELF64, little endian, AArch64, PIE, Android API 28, NDK r29, with interpreter
`/system/bin/linker64`. Its SHA-256 is
`e71d0e57a398c5dc0f158f04162388847e5cba82112a89de2c9cfb375dc0bd5b`, matching
`android-native-runtime.json`. Dynamic dependencies are only `libm.so`,
`libdl.so`, `libvulkan.so` and `libc.so`. The Vulkan backend and C++ runtime are
statically linked; a separate `libggml-vulkan.so` or `libc++_shared.so` is not
expected. The inference binary and pinned llama.cpp b11669 commit
`620d2225cc436ab0b001e3200e590e3b286ef9ab` are unchanged.

Android starts this extracted executable through `ProcessBuilder`, with the
app's native-library directory as `LD_LIBRARY_PATH`, and connects to a keyed
loopback HTTP server. Only an enumerated hardware `VulkanN` device is selected;
software Vulkan is excluded. Model verification precedes loading. A positive
observed offload count is required to accept GPU loading, and generated tokens
are additionally required for `gpuActive=true`. Auto retains CPU fallback;
explicit GPU mode reports failure without silently generating on CPU.

The bounded diagnostic trace now retains model-loader error lines that were
previously discarded, distinguishes native-linker and Vulkan-instance failures,
and captures the first inference's filtered native errors. A later generic
model-load failure preserves an earlier shader/device stage. Runtime diagnostics
include executable presence/permissions and supported Android ABIs without paths.
Tokens, prompts, templates, API keys and full command lines are excluded. Desktop
fallback classification now also recognizes Vulkan-Hpp host/device memory errors.
These are diagnostic/control-flow fixes, not evidence of a Mali driver fix.

## POCO / Android 16

1. Install the new signed APK as an update. Keep app data and the same verified
   local GGUF. Record the model's SHA-256, context setting and APK version code.
2. Select **CPU**, run a short synthetic prompt, then export the AI diagnostics
   JSON. Require successful generated text and `backend=cpu-native`.
3. Select **GPU**, layer limit **999**, and run the same cold/warm test. Export
   JSON immediately after success or failure, while the process is still open.
   The bounded GPU trace survives CPU fallback but is not persisted across app
   process termination or reboot.
4. Inspect `backend.nativeRuntime` (`binaryPresent`, `binaryExecutable`,
   `supportedAbis`, `abi`, version/commit), `backend.gpuAttempt` (`status`, `stage`,
   `nativeCode`, `exceptionType`, `message`, `exitCode`, `healthHttpStatus`,
   `nativeLog`, `arguments`, `stages`) and observed offload count. Distinguish a
   `native-loader` failure from device/instance creation, tensor offload, context,
   shader creation or inference. Missing evidence remains unknown.
5. Repeat GPU with **8** layers and export a separate JSON. This compares resource
   demand; reduced layers are not a promised fix for unsupported features/shaders.
6. Repeat **Auto**. If Vulkan fails, require successful CPU output, a visible
   fallback reason, `gpuActive=false` and the original failed GPU trace. Explicit
   GPU failure must remain an error. Compare existing event/model/history data.

Optional crash evidence from a computer with existing Android platform tools:

```sh
adb shell getprop ro.build.version.release
adb shell getprop ro.product.cpu.abilist
adb logcat -b crash -v threadtime > poco-native-crash.txt
```

Start capture before the failing GPU attempt, then stop it with Ctrl+C. Exported
in-app JSON is the primary evidence: the subprocess stderr is piped into the
app's bounded trace and need not appear in logcat. Review crash output for private
paths or unrelated app crashes before sharing. Do not clear app data or log
buffers. A host/device instrumentation build can additionally run:

```sh
adb shell am instrument -w \
  -e class com.kalendarz.offline.NativeRuntimePackagingTest \
  com.kalendarz.offline.diagnostics.test/androidx.test.runner.AndroidJUnitRunner
```

Use a matching signed test APK on a disposable test profile/device. The test
checks extracted ELF ABI, the production launch environment, pinned `--version`
and `--list-devices`. It accepts an empty GPU list. It is not an inference test
and is not executed in this Cloud session.

Accept Vulkan only when the physical phone produces text, reports
`backend=vulkan`, positive `offloadedLayers`, and `gpuActive=true`; the GPU attempt
must reach `inference-confirmed`. Mali enumeration alone is insufficient.

## RTX 4060 / CachyOS

Use the existing driver setup. Launch the supplied CPU/Vulkan/CUDA AppImage and
keep the same verified GGUF, context and synthetic prompt for comparisons.

1. Run CPU cold/warm benchmarks and export JSON.
2. Run **GPU**, initially **8** layers and then **999**. Run a short and a longer
   synthetic prompt twice at each setting; export separate results. Record
   actual backend/device, requested and observed GPU layers, generated-token
   count, `timings.predicted_per_second` (tokens/s), `firstTokenMs` (TTFT), load
   time and total time. Unavailable counters must remain unavailable.
3. Require the actual result's backend to be **cuda**, with RTX 4060 device,
   positive observed layers, generated text and `gpuActive=true`. Auto/GPU tries
   CUDA before Vulkan; a successful `vulkan` result does not establish CUDA.
   Merely listing CUDA as packaged or detecting the RTX is also insufficient.
4. Repeat **Auto** and CPU, verify normal shutdown, preferences, events, models
   and chat history. A genuine GPU failure in Auto must produce CPU fallback;
   explicit GPU mode must never present CPU execution as GPU success.
5. Optionally observe the native server process with `nvidia-smi` during the
   request. VRAM/process visibility corroborates diagnostics but does not replace
   generated-token/offload evidence.

The existing `tests/benchmark-backends.cjs` can produce the same metrics from a
source checkout and staged native runtimes using `CALENDAR_MODEL_FILE`; it uses
local weights only. The app's exported benchmark JSON is sufficient for normal
manual acceptance. No physical CUDA/offload performance result is claimed here.
