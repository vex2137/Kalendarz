# KALENDARZ 1.4.1 — final package validation

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. No push, merge or release publication was performed. The clean Beta 3 baseline is preserved by local tag `checkpoint/1.4.1-beta3-tested` at `bb3e047`. The user confirmed all five Beta 3 blockers fixed on a physical POCO X7 Pro; this is user-provided evidence for Beta 3, not a new GPU or 1.4.1 device test.

**Packages are built and ready for device acceptance. Full STABLE certification is still gated by physical Android/GPU tests.** No physical GPU, connected Android, Windows or macOS execution environment was available in this session. No compatibility or acceleration claim is made for the POCO, unknown Motorola, RTX 4060, AMD, Intel or Apple hardware.

## Processing-mode regression and correction

The original HTML select was disabled throughout automatic checking/loading as well as foreground work. Long model preloads therefore prevented changing CPU/GPU. GPU selection was also disabled whenever the native bridge was unavailable, without giving an actionable selection error.

The old handler called generic unload followed immediately by mode application. Aborting startup invoked a fire-and-forget native stop before a JS engine handle existed. Waiting for the rejected load alone did not guarantee that this stop had finished. The new browser regression reproduced the race as a mode acknowledgement occurring while the simulated process was still resident.

- Accessible, touch-sized Auto/CPU/GPU buttons replace the select. Committed selection uses `aria-pressed`. Automatic preload can be interrupted; foreground inference, import and verification remain protected.
- A shared transition pauses preloading, waits for JS disposal **and explicit native stop/status confirmation**, then applies the mode. No additional automatic reload is scheduled. The next explicit request loads the model; success feedback explains this.
- Mode and GPU-layer policy persist. Failed storage or native acknowledgement restores the previous policy; failed rollback has a separate error code. Selecting GPU without a native runtime gives a visible error and preserves the previous selection.
- Mode clicks, start, success and errors enter the bounded diagnostic log. Current native snapshots clear obsolete model/memory/error fields. JSON includes the persisted requested mode/layer limit separately from actual backend state.
- Native Android and desktop accept an integer GPU-layer limit from 1 to 999, where 999 requests all supported layers. CPU always passes zero layers and `--device none`. Partial offload is attempted through the existing engine, with normal allocation checks and bounded fallback; it is not assumed successful from an estimate of full-model RAM.
- Native snapshots include OS/CPU architecture, packaged backends and enumerated GPU backends. Packaged binaries, enumerated devices, loaded layers and confirmed token generation remain separate facts.

The existing pinned llama.cpp engine, Vulkan device/driver initialization, software-device exclusion, authenticated loopback API, one-attempt fallback and strict GPU-only semantics were retained. An unavailable GPU in Auto falls back after cleanup; GPU-only never silently runs CPU. GPU activation still requires offloaded layers and actual generated tokens.

A packaging audit also found that refreshing CPU/Vulkan rewrote the native manifest and lost an explicitly staged optional CUDA backend. The staging script now retains it only after matching the pinned commit and rechecking every CUDA file checksum. Corruption, stale versions and unsafe entries fail before refreshing assets. Tests use small packaging fixtures, not CUDA execution.

## Platform status

| Platform | Implementation / package | Actual validation here |
| --- | --- | --- |
| Android ARM64 | Native CPU + Vulkan; Auto/CPU/GPU; bounded teardown/fallback; partial layers | Java/frontend/native artifacts packaged, JVM tests and instrumentation compilation. New APK not installed on a phone. GPU unverified. |
| Linux x64 | Native CPU + Vulkan in AppImage. Optional CUDA staging supported; CUDA not included | Actual AppImage startup; packaged Electron UI, model discovery, CPU cold/warm inference, real strict-GPU failure and CPU recovery, restart and IPC isolation. No physical GPU. |
| Windows x64 | Native CPU + Vulkan in ZIP. Optional CUDA staging supported; CUDA not included | Actual cross-built Electron ZIP; ZIP CRC, PE executable, build metadata and all 63 native file hashes verified. No Windows launch or GPU execution. Unsigned Windows executable. |
| macOS | Existing CPU/Metal path and pinned staging retained | Existing mock boundary tests pass. No macOS build/package or physical Metal execution in this session. |
| Web | Existing CPU WebAssembly | Real local GGUF import/download/storage/restart/inference; GPU-only selection without native bridge errors visibly. |

Driver features and model operations are validated by actual llama.cpp backend initialization/load/inference, not manufacturer names or merely the Android Vulkan feature flag. Portable VRAM counters remain unavailable on Android and on non-NVIDIA configurations without a counter; no usage is invented. The CPU architecture/OS and backend data are included in diagnostic JSON. Enumeration does not certify driver compatibility.

## Tests actually completed

Final relevant checks: **138 application tests + 25 Node native/folder tests + 3 JVM tests + 3 Python staging tests = 169 unit tests passed**, zero outstanding failures or reported skips in those suites. The JVM total includes two targeted model-identity regressions and the existing example test. TypeScript and `git diff --check` passed. No tests were disabled or generation assertions removed.

Integration and regression checks passed:

1. Mouse and emulated touch on production React handlers: select during preload, awaited stop, explicit success/error, mode/layer persistence, restart synchronization, rollback, invalid layers, CPU recovery, unavailable native GPU and no preload loop. Native boundary fault injection only.
2. Existing JSON export and memory-release UI regressions, including native proxy save/cancel/error/missing bridge, failed stop/retry and suppression of immediate preload.
3. Model-manager import/download action tests, including picker proxy, unknown size, expired grant, cancellation, HTTP 404 and preservation of an existing model.
4. Both real OPFS writers: streaming, unknown size, failed replacement, HTTP/network/truncation/checksum/quota/cancellation and injected copy-corruption cases.
5. Synthetic Q4_K_M and IQ4_XS GGUF metadata import, independent hashes, source preservation and persistence after restart. Metadata fixtures do not prove tensor/architecture execution.
6. Same-origin official 1.4.0 → 1.4.1 upgrade and restart; separately, actual Web assets extracted from the signed Beta 3 APK → 1.4.1. Recurrence/reminders, events, custom themes, language/settings, chat history, model selection, saved CPU mode and OPFS bytes were unchanged. This is browser storage evidence, not Android package-manager evidence.
7. Full actual LFM2.5 350M Q4_K_M transfer through local HTTP 302 → 200, complete OPFS write/hash, retry without another download, catalogue import, out-of-catalogue import, restart and actual WASM output. See `evidence/ai-141-stable-real-transfer.json`.
8. Real native LFM350 smoke (quick compatibility scope), cancel/unload/reload; injected stuck GPU process terminated before real CPU retry and tokens; actual native invalid-GGUF rejection without a lingering process. Injected GPU failure is not hardware acceleration evidence.
9. Actual Linux package: file-origin startup, indexed event persistence, keyboard navigation, encrypted QR, real cold/warm native inference with HTTP blocked, sandbox/context isolation and rejection of another renderer's native IPC.
10. Actual packaged folder discovery, model selection and cold/warm CPU inference, restart persistence and removal without modifying model bytes. Additional UI CPU → GPU-only → visible `model-gpu-unavailable` with no resident CPU fallback → CPU recovery with actual tokens passed on this GPU-less host.
11. Actual AppImage extraction/startup, app version and native CPU/Vulkan resource availability.
12. Android frontend, main Java, instrumentation and JVM test compilation/build. Existing SAF/export/native packaging tests plus new `BackendModeTest` are included in the test APK. Instrumentation was **not executed** on a device/emulator.

The original packaged desktop test expected bundled weights and initially stopped at “model installed” for this intentionally model-free package. Its setup now selects a real external GGUF through the existing folder UI; all real inference and warm-cache assertions remain. No model was replaced with a fixture to make this pass.

## Actual models and benchmarks

Only actual **LFM2.5 350M Q4_K_M**, 229,312,224 bytes, SHA-256 `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`, was available for model inference. It comes from the previously verified official 1.4.0 Web artifact.

The out-of-catalogue full GGUF changes one byte in `general.name`, has SHA-256 `8a0731e7052e413018f0dc4e0c3d3ef9dbdccd398de5ac47e536932241e5f0e9`, and retains exactly the same LFM2 architecture and tensor weights. It proves arbitrary identity handling, not support for a second architecture.

Actual Qwen3.5 Q4_K_M/IQ4_XS, LFM2.5 2.6B, TinyLlama and SmolLM weights were unavailable. Hugging Face remains blocked by enforced network policy. Their execution/download endpoints were not reverified here. Existing catalogue hashes/URLs were not replaced speculatively. User-provided Beta 3 device acceptance remains separate evidence.

Measured host: Linux x64, Intel Xeon Platinum 8573C, two available CPU threads, context 2048. Native benchmark results are in `evidence/ai-141-stable-cpu-benchmark.json`.

| Requested mode / prompt | Total ms | First token ms | Generated tokens/s |
| --- | ---: | ---: | ---: |
| CPU / short cold prompt | 3104 | 2214 | 6.0 |
| CPU / short warm prompt | 701 | 152 | 9.2 |
| CPU / long cold prompt | 25291 | 11756 | 8.7 |
| CPU / long warm prompt | 4825 | 59 | 24.8 |
| Auto (actual CPU) / short cold prompt | 1168 | 773 | 12.7 |
| Auto (actual CPU) / short warm prompt | 221 | 38 | 27.7 |
| GPU-only | No result: `model-gpu-unavailable` | — | — |

These measurements ran on a shared host alongside regression work. Scheduling contention and prompt caching explain variability; they are not a CPU/GPU comparison or a prediction for the POCO. Full JSON retains load times, prompt/generation timing, token counts and actual process RAM. No GPU benchmark or speedup is claimed.

## Packages and update identity

Application content in all three packages comes from clean commit **`641f00e608e4e3a264a7730ba4d484d9fd7c52d9`**, including mode fix `baddf5c`. Subsequent commits concern staging verification, desktop regression tests and this report. Checksums, sizes and signing verification are recorded in `evidence/ai-141-stable-packages.json` and `release/KALENDARZ-1.4.1-validation.json`.

- `release/KALENDARZ-1.4.1-ANDROID.apk` — 24,294,344 bytes. Label/version **KALENDARZ 1.4.1 / 1.4.1**, version code **10404**. Same `com.kalendarz.offline.diagnostics` ID and same certificate as Beta 3. Signature and 16 KiB alignment verified. It is the update for the existing diagnostic Beta line, not a change to production signing/ID. Install over Beta 3 without uninstalling or clearing data; installation itself remains to be checked on a phone.
- `release/KALENDARZ-1.4.1-ANDROID-device-tests.apk` — compiled instrumentation; run only on a disposable test device/profile, not the primary user's data.
- `release/KALENDARZ-1.4.1-LINUX-x64.AppImage` — actual x64 Linux package, tested both unpacked and through AppImage startup. Enable executable permission; if FUSE is unavailable, use `APPIMAGE_EXTRACT_AND_RUN=1 ./KALENDARZ-1.4.1-LINUX-x64.AppImage`.
- `release/KALENDARZ-1.4.1-WINDOWS-x64.zip` — actual cross-built Windows x64 archive; extract and launch `Calendar.exe`. No Windows execution/signing claim.
- No macOS package was fabricated.

All are explicit **model-free** packages: existing downloaded/imported models are retained; a new installation must download/import a model. Ordinary bundled-model build verification remains mandatory by default. Only explicit `CALENDAR_MODEL_FREE=true` and Android `-PcalendarStableUpdate=true` opt into this distribution. No model weights, signing keys or large datasets were added to Git.

Implementation commits: `baddf5c` (processing modes/lifecycle/diagnostics/partial layers), `641f00e` (explicit packages and Beta-compatible update), `228475f` (preserve verified optional CUDA), `cd3e272` (packaged desktop regression and recovery). Final evidence is saved in the validation commit following these.

## Device acceptance before publication

1. On POCO, install the new APK over Beta 3 without uninstalling/clearing storage. Check existing events, reminders, models, settings and history; repeat import, download, JSON export and memory release.
2. Choose CPU while automatic preload is underway. Confirm visible saved selection, unload, retention after app restart, then run the existing cold/warm device test and export JSON.
3. With the same model/quantization/context, select GPU and a conservative layer limit, for example 8. Run the same device test. Confirm actual backend `vulkan`, positive offloaded layers and `gpuActive=true` after generated tokens. Increase layers only after successful measurements; 999 requests all. If GPU is unavailable, require a clear error and no CPU execution in GPU-only.
4. Select Auto, repeat cold/warm, export a separate JSON. Check that driver/load/generation failures produce a bounded, cleaned-up CPU fallback. Repeat load/release/mode changes and restart. Exported model, requested mode/layers, actual backend, timings, RAM and error/fallback reason must agree.
5. Repeat on the Motorola after recording its actual model and detected GPU; do not infer the SoC from a product family. On CachyOS/RTX 4060, repeat with this AppImage (Vulkan); CUDA needs the optional pinned build and a separate real test. Repeat on actual Windows/macOS hardware before claiming those platforms' GPU support.

No physical GPUs were tested. GPU confirmation on POCO/Motorola/RTX 4060, Android installation/data retention for this exact APK, Windows launch and macOS build/Metal are outstanding acceptance gates. The available CPU and software regression results support device testing; they do not certify universal GPU compatibility or authorize publication.
