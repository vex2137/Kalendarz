# Part 2 Beta 2 repair candidate — manual acceptance

Source: a2a8fd730dc7cf942a38e2a85fbb409f04549885. PR #20 remains Draft/unmerged. No Beta 2 tag or Release is created. These packages contain no GGUF.

Android update identity: `com.kalendarz.offline.diagnostics`, versionCode **10510**, existing certificate SHA-256 `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`. Install as an update without uninstalling or clearing data. Verify events, language/theme, PIN/password, history, model selection and installed models survive.

## POCO / Android 16

1. Import an existing local GGUF through the actual system picker. Test a large file, cancellation, invalid/truncated file and unavailable provider. Existing installed models must survive failed imports.
2. Start a catalogue download; visit calendar/chat/settings, minimize and lock the screen. Check notification bytes/Pause and current progress after returning. Test immediate Pause → Resume, network interruption and process death, then explicit resume. Android dataSync time limits and vendor restrictions can pause work; force stop does not promise automatic restart.
3. Open a locked app with biometrics enabled: expect one automatic system prompt, no loop after cancellation, a working manual retry and PIN/password alternative. Test Home and screen lock while a prompt is open; no stale callback may unlock the app.
4. Require verified installation before Use model; Used requires an actually loaded model. A saved preference alone is Selected.
5. Test CPU first, then Auto and explicit Vulkan using a real model. GPU discovery is insufficient: require generated tokens and nonzero observed offload. Export safe diagnostics on failure.

Detailed procedures: [SAF/import](PART2-BETA2-GGUF-IMPORT.md), [native transfers](PART2-BETA2-ANDROID-TRANSFERS.md), [POCO Vulkan and RTX CUDA](PART2-BETA2-GPU-DEVICE-TESTS.md).

## CachyOS / RTX 4060

Verify the supplied SHA-256, make the AppImage executable and launch normally. Confirm existing settings/history/model folders and event persistence. Compare CPU, Auto and GPU with the same model/prompt; record backend/device, requested and observed GPU layers, generated tokens, tok/s and TTFT. Auto must retain CPU fallback. Do not modify drivers, kernel, bootloader or GPU Unlock. Physical CUDA offload remains unverified in Cloud.

## Public Vex909 model

Cloud policy excludes huggingface.co; no public checksum is guessed or activated. On an unrestricted machine, download into a new empty directory:

```sh
curl --fail --location --output kalendarz-qwen35-v2-q4_k_m.gguf https://huggingface.co/Vex909/Qwen-3.5-v2-Q4_K_M/resolve/main/kalendarz-qwen35-v2-q4_k_m.gguf
sha256sum kalendarz-qwen35-v2-q4_k_m.gguf
wc -c kalendarz-qwen35-v2-q4_k_m.gguf
od -An -tx1 -N8 kalendarz-qwen35-v2-q4_k_m.gguf
```

Record actual bytes and checksum; GGUF begins `47 47 55 46` with supported version 2 or 3. Import the file, export diagnostics and test CPU inference before GPU. Successful header/download alone does not establish correct inference or identity with private training weights.

Actions artifacts require GitHub login and expire after 30 days. Use only links/checksums in the repair report; earlier b25d7e7 packages do not contain these repairs.
