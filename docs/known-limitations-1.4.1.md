# KALENDARZ 1.4.1 — known limitations and 1.4.2 follow-up

The maintainer has accepted the core features after physical POCO X7 Pro testing and explicitly approved finalizing 1.4.1 without making Android Vulkan acceleration a release gate. Historical validation reports retain their original observations; this decision supersedes their proposed GPU gate for this release.

Release targets are Android ARM64, Linux x86_64, Windows x64 and Web. No other platform is being built or configured.

Known limitations in 1.4.1:

- Android Vulkan is experimental. POCO Mali-G720 MC7 enumeration is confirmed by the user; successful GPU inference is not confirmed. Auto retains safe CPU fallback and truthful backend/layer reporting. GPU-only reports failure rather than silently running CPU.
- Exact Android driver/shader/allocation failure needs the retained native GPU diagnostic JSON. GPU detection alone is not acceleration evidence. No RTX 4060, AMD or Intel hardware compatibility is certified here.
- These distributions do not bundle model weights. Previously installed models are retained; new installations download or import one. Native architecture/quantization support depends on pinned llama.cpp. This environment cannot check live Hugging Face CDN behavior; local real-file transfer tests and the user's physical download acceptance are separate evidence.
- The Android file continues the existing Beta/diagnostic install identity and certificate to preserve update compatibility. It does not replace the separately signed official 1.4.0 production package. Install over Beta 3/10404/10405 without uninstalling or clearing data.
- Linux ships CPU and Vulkan. CUDA remains an optional separately staged backend, not part of this AppImage. Physical CachyOS/RTX 4060 inference remains unverified.
- Direct binary attachment/export is unavailable in this session. The user has authorized an unpublished GitHub draft with the four target artifacts; working release-upload authentication is still required. No remote download link exists yet.

Deferred to 1.4.2, without blocking 1.4.1:

1. Diagnose the physical POCO Vulkan failure from native stage/code/log evidence; verify compatible driver features and allocation behavior.
2. Validate and optimize partial/full GPU offload, memory limits and CPU/GPU timings on POCO, the identified Motorola, and CachyOS/RTX 4060.
3. Validate optional CUDA packaging and inference on NVIDIA and Vulkan on AMD/Intel.
4. Broaden actual GGUF architecture/quantization compatibility and driver regression coverage using real devices and model files.

No fine-tuning or other new functionality is included in this finalization.
