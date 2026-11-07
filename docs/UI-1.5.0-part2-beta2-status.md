# Part 2 Beta 2 — incomplete

- Desktop toolbar uses a single wide row at >=1280px, labels beside icons, 44px actions and compact narrow layouts. Existing app-download action stays labelled App rather than falsely implying model management.
- Existing download progress includes actual written bytes, smoothed MB/s and ETA. OPFS transfers now persist across restart with strong ETag/If-Range validation, bounded 4 MiB checkpoints, idle timeout and full SHA-256 verification before registration. Cancel retains valid data; retry resumes it. Servers ignoring Range restart safely. A fully verified public recommended-model URL remains unavailable.
- Compared OmniCore b69b318c18ac222f260eb5ce2b64eb10f97e8ecc native.py, nvidia.py and build_llama.py. Reused its subprocess library-isolation principle without changing Kalendarz's pinned llama.cpp version or importing OmniCore's backend.
- Staged and SHA-256-verified upstream CUDA runtime locally; native probing returned no physical devices and gpuActive=false, as expected. Added optional CALENDAR_INCLUDE_CUDA=true packaging using the existing pinned/checksummed CUDA staging script; CPU/Vulkan remain. Actual NVIDIA inference is not verified in this environment. Auto fallback remains tested; explicit GPU mode still fails visibly rather than silently switching to CPU.
- Hugging Face metadata verification is blocked by Cloud network policy: huggingface.co is absent from allowed hosts, requests return HTTP 403. The public GGUF filename, bytes and checksum have NOT been independently verified. The model manifest URL remains unchanged; no guessed checksum or URL was installed.
- Required environment configuration: add huggingface.co to network_policy.allowed_hosts through the supported Cloud environment configuration UI. The agent has read-only environment tools and cannot confirm the client's exact menu labels. Further CDN hosts can only be determined after access is granted; do not bypass the policy.
- Local HTTP integration covers resume after cancellation and abrupt document restart, 200/206/416, malformed Content-Range, changed/missing ETag, HTTP 503, disconnect, idle timeout, quota/space failures, checksum rejection without touching the installed model, exclusive transfer locks, and complete-file reuse offline. Both transactional and worker OPFS paths are exercised.
- Verified transfers are copied to an independent installation file before registration, preserving previous installed data; installation may therefore require temporary extra disk space.
- Tests: TypeScript; 170 unit tests including three download-meter tests; 28 native tests; three CUDA-staging state tests; toolbar at 1920/1366/1024/768/390 in EN/PL/DE/RU; existing mobile navigation across five views. Full release regression/builds are deferred until public-model verification is complete.

Manual-test APK and CUDA AppImage were generated from b25d7e7 after source CI passed 4/4. No Beta 2 tag/release has been created. See PART2-BETA2-MANUAL-TESTS.md for device checks; public-model validation remains blocking. PR #20 must remain Draft and unmerged; stable 1.4.2 and Part 1 Beta 3 are unchanged. Continue with verified HF metadata and real public-model download/inference tests, final CUDA AppImage packaging validation and real GPU testing on CachyOS before claiming the Beta 2 scope is complete.

## Manual candidate verification

APK: versionCode 10509, matching existing package and update certificate; 24023506 bytes; SHA-256 9ce239d51d3703aad2d69cb5773bdef7e79f6f3dc32b1bb0eea97d2f75756605.

CUDA AppImage: 935366111 bytes; SHA-256 3f4a4df2b87b0e389aa3648528ef57dda06b81ce9e60adc6e4004587880ada19. Extracted AppImage smoke passed under Xvfb; CPU/Vulkan/CUDA files were checksum-verified against the packaged manifest. No devices detected and gpuActive=false; no physical NVIDIA inference claim. Existing completed tests were not rerun for manual-artifact preparation.

The branch's existing registered manual workflow entry publishes only logged-in Actions test artifacts with read-only repository permissions; it does not create tags or Releases. Both artifact source hashes are pinned and checked before upload.
