# KALENDARZ 1.4.1 — POCO Vulkan failure evidence and artifact delivery

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. Baseline `8a967b8`; implementation `fd8dd25`. No push, release publication, external upload, model modification or user-data deletion was performed.

## What is and is not established

The user's physical POCO X7 Pro / Android 16 report identifies Mali-G720 MC7, native CPU inference, zero offloaded layers and generic GPU initialization fallback with Qwen3.5 0.8B Q4_K_M. Reported CPU generation is 30.6 tokens/s and total response time 10,464 ms. These are user measurements, not measurements made here.

Auto and CPU use the same actual CPU backend after this fallback. Device enumeration is working, but it does not prove successful compute-device/pipeline creation, model offload, context allocation, warmup or inference.

**The exact device-side Vulkan failure is not established from that generic report.** There is no physical Android or GPU attached here. No speculative Mali workaround, driver setting or shader patch was applied. This package adds the missing evidence needed to identify the failing call, stage and native message on the actual phone. It does not certify a Vulkan fix or GPU acceleration.

A concrete diagnostic defect was confirmed in the wrapper: the failed GPU startup wrote to the same `log` buffer that `start(... CPU ...)` immediately reset. The exported fallback reason therefore lost the native error detail. Vulkan-Hpp errors such as `ErrorOutOfDeviceMemory` also did not match the previous space-separated memory-error checks.

## Implemented diagnostic changes

A separate bounded native GPU attempt record survives CPU fallback, model release and mode selection within the current app process. It is not persisted across force-stop/reboot; export it before closing the app.

- Last known stage and a bounded list of stage transitions with monotonic elapsed milliseconds.
- Wrapper error code, exception type/message, named Vulkan/Vulkan-Hpp error when logged, process exit code if actually available, and last health HTTP status.
- Actual safe arguments passed to the spawned GPU process: device ID, layer limit, context, threads, batch and microbatch. API keys, model paths and full command lines are excluded.
- Requested layers and observed offload count are separate. `999` remains the valid request for all supported layers; it is not reported as an actual offload count.
- A startup-only native log tail retains Vulkan feature/extension/device messages, pipeline/loader errors and exceptions. It is bounded to 64 lines / approximately 12,000 characters. Private paths, URLs and credentials are redacted; chat templates, model metadata and ordinary server request output are excluded.
- Failed records cannot be overwritten by CPU startup, its successful health response, or cleanup errors. Exited GPU stderr is drained before recording the failure.
- Both symbolic `VK_ERROR_OUT_OF_DEVICE_MEMORY` and Vulkan-Hpp `ErrorOutOfDeviceMemory` / `ErrorOutOfHostMemory` classify as insufficient GPU memory. Feature/extension/device errors remain distinct native evidence instead of being flattened into a successful fallback result.
- AI settings expose an expandable **Last native GPU attempt** / **Ostatnia natywna próba GPU** block. Existing Export JSON includes `backend.gpuAttempt`, its arguments, stage history and native log. JSON/memory-release functionality and error feedback remain intact.

`initializing`, `loaded-awaiting-inference` and `inference-confirmed` remain distinct. Native `gpuActive` still requires positive GPU offload and actual generated tokens. GPU-only still fails without silently using CPU. Auto still cleans up the failed GPU process before its existing CPU fallback. No per-manufacturer inference engine was added.

## Native build inspection

The actual packaged native binary was inspected using NDK `llvm-readelf`:

- ELF64 / AArch64, position-independent executable packaged as `libcalendar_llama.so`.
- `GGML_VULKAN=ON`, `BUILD_SHARED_LIBS=OFF`, `GGML_BACKEND_DL=OFF`, ARM64-v8a, Android API 28, static C++ runtime, NDK 29.0.14206865.
- Vulkan backend is compiled into this executable; no separate missing `libggml-vulkan.so` is expected.
- Dynamic dependencies are system `libm.so`, `libdl.so`, `libvulkan.so`, `libc.so`.
- llama.cpp `b11669`, pinned commit `620d2225cc436ab0b001e3200e590e3b286ef9ab`.
- SHA-256 `832842c3d264e227186c2839a470527632a07b3af854e28cdaa10a35558b4402`, matching the build manifest and the previous signed 10404 APK exactly.

The reported successful CPU execution of this same Vulkan-linked executable and detected Mali device make a fundamentally wrong ABI or wholly missing Vulkan loader less likely. They do not rule out required compute features, shader/pipeline compilation, model-specific operations, allocation or driver errors. Actual driver capabilities still require the new device-side log; no extension support was invented.

CPU engine binary and CPU process arguments are unchanged. Import, download, OPFS, model registration and application-data schemas are unchanged. There is no new native C++ build or assumed GPU performance improvement in this package.

## Validation performed in this session

- 25 existing Node backend/folder tests passed, zero failures/skips.
- 12 JVM tests passed: nine new real diagnostic-helper tests, two model-identity regressions and the existing example. Fault examples prove evidence handling, not physical GPU execution.
- Production browser diagnostic regression passed, including detailed GPU failure display/export, JSON export save/cancel/error, memory release/error/retry and suppression of unwanted preload.
- Mouse/emulated-touch mode regression passed: preload interruption, mode/layer persistence, restart, rollback, clear failures and no reload loop. Native boundaries are injected in these browser tests.
- TypeScript passed. Android main, JVM and instrumentation sources compiled; diagnostic APK and test APK built offline successfully. Instrumentation/device installation was not executed.
- `apksigner` verified the new APK and certificate equality with 10404. Package ID is unchanged and version code increases to 10405. `zipalign -c -P 16 4` passed. Packaged build provenance is clean commit `fd8dd25`; native binary is unchanged byte for byte.

The full application suite and hardware benchmarks were not rerun because application logic and the inference binary are unchanged. No physical GPU, Android, CachyOS or RTX 4060 test is claimed here.

## Local artifacts

`release/KALENDARZ-1.4.1-ANDROID-vulkan-diagnostics.apk`:

- 24,005,289 bytes.
- SHA-256 `576bf11ccb48150b2b49fc0ed55cc85262a69c8ffe88f132dd1a89ef1d70d5c0`.
- Version name `1.4.1`, version code **10405**, same `com.kalendarz.offline.diagnostics` ID and diagnostic signing as 10404 / Beta 3. It is prepared for an in-place update without uninstalling or clearing data; actual installation remains a device test.
- Existing models remain external to the model-free APK and are not removed.

`release/KALENDARZ-1.4.1-ANDROID-vulkan-diagnostics-tests.apk` is compiled instrumentation, intended only for disposable device/profile testing.

`release/KALENDARZ-1.4.1-linux-x86_64.AppImage`:

- **165,035,840 bytes** (157.39 MiB).
- SHA-256 **`1dd853fc8e64d62337ad0dcee7119a34d7c07b969d8c979ce8f0f01a0564d7ad`**.
- Executable permissions preserved; ELF64 x86_64, AppImage type 2.
- SquashFS magic and bounds verified: image offset 188,392, filesystem bytes 164,672,280, entirely within the artifact.
- Exact byte-for-byte match, by SHA-256, to the AppImage successfully started in the preceding session. That session also exercised actual packaged native CPU inference. A valid existing artifact was reused, not rebuilt.
- Existing native CPU/Vulkan resources are retained. Optional CUDA is not included; RTX 4060/Vulkan execution remains unverified.

Checksums and a machine-readable report are saved beside the artifacts and in `docs/evidence/ai-141-poco-vulkan-diagnostics.json`.

## Delivery status — blocked, not a confirmed download

**No working attachment/download transport could be confirmed in this managed session. The binaries currently exist only in its workspace.** An absolute path or the previously unsuccessful `sandbox:/workspace/...` link is not presented as successful delivery.

The active tool catalogue has no generic file upload, attachment or artifact-export action. Its file downloader is inbound-only; GitHub artifact tools only retrieve existing remote artifacts. The environment reports no configured artifact-storage capability, credentials or outbound identity. The inspected Codex CLI cloud/app-server/exec-server help offers task diff/apply or authenticated execution transports, not a ready binary attachment/export command. A local HTTP server would not establish access from the user's CachyOS machine, so it was not advertised as a solution. Unrelated upload tools and unapproved public hosting were not used.

A confirmed delivery route needs an attachment-enabled interface or an explicitly provided and authorized artifact-storage destination. No upload, public URL, GitHub push or release publication has been made. The delivery requirement remains incomplete; there is no verified remote download URL to report.

## POCO acceptance procedure once the APK can be delivered

1. Install code 10405 over the existing diagnostic APK without uninstalling or clearing app data. Keep the same Qwen file and settings.
2. Select GPU with limit 999 and run the existing cold/warm test. After failure or success, open **Ostatnia natywna próba GPU**, then Export JSON while the app is still running.
3. Inspect `backend.gpuAttempt.stage`, `code`, `nativeCode`, `exitCode`, `healthHttpStatus`, `nativeLog`, `stages` and `arguments`. Confirm `--device=Vulkan0` and the requested `--n-gpu-layers=999` in the actual argument record. A missing native code remains unknown, not a fabricated driver diagnosis.
4. If the evidence identifies allocation failure, repeat with a conservative layer limit such as 8 and export a separate report. Reducing layers is a diagnostic comparison, not a claimed fix for a feature/shader error.
5. Repeat Auto and CPU. Auto must retain the failed GPU attempt while actual backend becomes CPU; GPU-only must show its error without CPU inference. Verify existing import/download/export/release/data behavior.
6. Accept GPU only when the actual backend is Vulkan, observed offloaded layers are positive, `gpuActive=true` follows generated tokens, and inference succeeds on the physical POCO. No such success has yet been established by this session.
