# Part 2 Beta 2 — manual-test candidates, not a release

Application source: b25d7e7f54e47e4d74185651048769038dd89ccc. Source CI passed 4/4; local HTTP tests cover durable transfer recovery, validators, cancellation, errors and verified installation. Do not infer public Hugging Face availability or physical CUDA correctness from these tests.

The APK and AppImage contain no GGUF. Keep an existing installed model or manually import a trusted local GGUF. The public Vex909 file's exact size, checksum, access and inference remain unverified because Cloud blocks huggingface.co. No guessed URL/checksum was enabled in the catalogue. This blocks an approved Beta 2 release.

## Before running (fish-compatible)

In the extracted artifact directory, verify the supplied checksum:

```fish
sha256sum -c Kalendarz-1.5.0-Part-2-Beta-2.apk.sha256
```

For Linux, use the corresponding AppImage checksum filename.

## POCO

APK identity: com.kalendarz.offline.diagnostics; versionCode 10509, above Beta 1's 10508; certificate SHA-256 ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143.

Install as an update using the Android installer, or explicitly from your computer:

```fish
adb install -r Kalendarz-1.5.0-Part-2-Beta-2.apk
```

Check existing events, settings/language, PIN/password, chat history and the installed/imported GGUF. Test a catalogue model transfer: cancel, close/restart the app, resume, then confirm verified installation and inference. Test network loss and panel/view switches. Check actual Android storage behavior, permission errors and free space. Native biometric behavior is still a physical-device check. Do not uninstall, clear app data or force a downgrade.

## CachyOS

```fish
chmod +x Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage
./Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage
```

Verify existing settings, model folders and history. Test downloads/resume after restart and the five views/toolbar. With a compatible NVIDIA driver already installed, compare CPU, Auto and GPU modes using the same model/prompt. For 999 layers, require diagnostics showing the actual backend, device, nonzero offloaded layers and generated tokens; discovery alone is not successful GPU inference. Auto should fall back to CPU on device/runtime failure; explicit GPU mode should report failure visibly. No driver, kernel or system configuration changes are part of this build.

The AppImage includes checked CPU/Vulkan/CUDA libraries. It passed extraction and Xvfb smoke tests for views, themes, event persistence, native bridge presence and shutdown. This Cloud host reports no physical GPU and gpuActive=false. Xvfb is not a physical desktop test. Installation uses bounded copies and may need temporary extra disk space. Checkpoint recovery was tested after an abrupt document restart; verify actual Android force-close/reboot separately.

Actions artifacts are retained for 30 days. PR #20 stays Draft/unmerged; no Beta 2 tag or release is authorized by successful manual-artifact upload alone.
