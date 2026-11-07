# Part 2 Beta 3: native AI fixes (no application packages built)

Based on `dc7ce45`, including all startup ownership, cancellation, shared prepare,
classification and diagnostic fixes from `388980c`. PR #20 remains Draft.

## Confirmed causes and changes

- Linux CPU/CUDA/Vulkan used llama.cpp b11669 (`620d2225cc`). That build did not
  recognize the user's `lfm3` architecture. Linux now pins official b12189,
  commit `80d2c0c2c56e4a1bbf74be98f64b99927bf230bc`, for all three backends.
  Per-target overrides preserve the existing Windows/macOS/Android pins.
  Release archive sizes and SHA-256 come from the official GitHub release API.
  CPU and Vulkan archive SHA-256 were also checked against downloaded bytes.
- Upstream evidence: [architecture table](https://github.com/ggml-org/llama.cpp/blob/80d2c0c2c56e4a1bbf74be98f64b99927bf230bc/src/llama-arch.cpp)
  contains `lfm3`, `qwen35`, and `qwen35moe`; the LFM3 implementation is in
  `src/models/lfm3.cpp`. A real, checksum-verified CPU binary recognizes LFM3 and
  Qwen3.5 header fixtures and reaches architecture-specific hyperparameter loading.
  These fixtures contain no tensors: this is NOT a full model inference test.
- Upstream `common/log.cpp` maps library INFO messages to verbosity 4, including
  the explicit `offloaded N/M layers to GPU` report in `src/llama-model.cpp`.
  Server defaults hid those reports despite HTTP 200. Launch now explicitly uses
  `--log-verbosity 4`; privacy-filtered diagnostics still retain startup lines only.
  `--fit off` preserves the application's explicit context/offload plan.
- GPU layer limits use actual GGUF `architecture.block_count + 1` (output layer).
  The slider and exact field share that bound. Preferences persist per content
  identity, old 999 becomes Auto, and oversized saved manual values are clamped.
  Unknown block count stays unknown, with an explicit one-layer fallback.
- Native preflight independently reads bounded GGUF metadata from verified files.
  It uses GGUF weight bytes, actual layer limits, context/KV allowance, 384 MiB
  backend overhead and a separate 256 MiB reserve, rather than a host RAM estimate.
  Auto reduces offload when needed. Unknown/hybrid KV layouts and nonuniform
  tensor placement remain explicitly approximate; native allocation can still fail.
  Diagnostic attempts include requested/effective layers, required/free VRAM and
  reserve. A 4.62 GB/32-block Qwen fixture at 2048 fits 6.6 GiB in this estimate.
- GPU readiness still requires an explicit nonzero offload report, followed by
  generated tokens for active inference. Wait up to 3 seconds after health;
  distinguish explicit zero from absent confirmation. CUDA → Vulkan → CPU fallback,
  cancellation and log isolation remain covered.

## Verification performed

- 52 Node tests, 10 TypeScript tests, 3 Python staging-state tests: passed.
- TypeScript typecheck, Python syntax checks and `git diff --check`: passed.
- Browser scripts: backend settings (mouse/touch), model context/compact rows,
  and startup diagnostics/export: passed. Native boundaries are simulated.
- Actual upstream CPU and Vulkan staging: 90 file hashes, pinned commit,
  `--version` startup and shared-library resolution: passed.
- CPU architecture dispatch checked with the actual staged b12189 binary.
- Old tests updated where they assumed a universal 999-layer ceiling, bypassed
  the memory reserve for partial offload, or called transformer blocks total layers.

CUDA archives are pinned with official release hashes; their large payloads were
not downloaded or executed in this session. No actual LFM3/Qwen tensor loading,
RTX 4060 inference, Android device test, APK or AppImage build was performed.
The commit skips automatic CI to avoid triggering prohibited package builds.

## Next physical RTX 4060 test

Repackage all Linux backends from this source/pin; do not reuse b11669 native
payloads. Stale staged CUDA is rejected by the existing cross-commit guard: use
a clean generated native staging directory. No model weights or drivers change.

1. Load the same Qwen3.5 4B at context 2048, Auto layers. Check the true block
   count, bounded effective limit and VRAM estimate/reserve in diagnostics.
2. Generate one reply on CUDA, then Vulkan separately. Require a nonzero engine
   offload count and GPU-active status after generated tokens, not just HTTP 200.
3. Repeat with a manual 5-layer limit, then CPU. Inspect process VRAM separately.
4. Load LFM3 on CPU first, then GPU. Export sanitized `nativeAttempts` on failure.
5. Restart and switch models; confirm independent layer/context preferences.

This is source progress, not a published or hardware-validated Beta 3 release.
