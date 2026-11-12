# Changelog

## 1.5.0 — Stable candidate (publication pending approval)

### New Features
- App lock with upgraded PIN/password workflows, attempt limits and Android system biometrics.
- Customizable keyboard shortcuts with context/input protection and conflict checks.
- Compressed single/multipart QR transfers with optional existing password encryption, text-code synchronization and import previews.
- Nine settings categories with search, remembered navigation and scoped preference resets.

### UI/UX Improvements
- Modernized Year, Month, Week, Day and Schedule views, responsive layouts, content-sized month weeks and compact all-day rows.
- Android launcher labels follow the saved English/Polish language selection.
- Optional desktop navigation panels and centered, draggable desktop assistant.
- Eight built-in themes with the approved 104 colors, custom theme editing and live preview.
- Motion levels, speed/effect controls and reduced-motion support.
- Original Android adaptive artwork on desktop/Web and a cache-safe KDE integrator.

### AI and Model Management
- Model-free distribution: download or import compatible GGUF files; retain existing models.
- Compact model management, folder integration, transfer progress/resume and diagnostics.
- Per-model context and token settings; distinguish requested and applied limits/offload.
- Streaming, cancellation with partial responses, assistant history and message copying.
- Calendar proposals for single/batch create, edit, delete and undo with explicit confirmation.
- Native CPU fallback, Linux CPU/CUDA/Vulkan, Windows CPU/Vulkan and Android ARM64 CPU/Vulkan.
  Packaged backends are not a claim of successful acceleration on every device.

### Performance
- Reuse the accepted native runtimes; no new training or bundled model weights.
- Bound generation/transfer lifecycle and preserve configured model/context limits.

### Bug Fixes
- Fix JSON content:null prefixes, date/time/duration parsing and false save confirmations.
- Fix default model installation in model-free packages, recovery and download actions.
- Preserve Android model process shutdown/restart and consistent runtime/backend state.
- Fix unprotected text synchronization and stale AppImage desktop-icon integration.

### Platform Support
- Android ARM64 APK; Linux x86_64 AppImage and Flatpak; Windows x64 Setup and Portable;
  production Web/PWA deployment ZIP. The historical Windows application ZIP is also retained; extract it fully before running Calendar.exe. It uses the normal installed profile and is distinct from Portable EXE.
- Windows executables are unsigned with Authenticode. No replacement certificate is used.
- Android retains com.kalendarz.offline.diagnostics and the existing update certificate;
  versionName 1.5.0, versionCode 10526 (newer than accepted 10525).

### Stability and Compatibility
- Preserve historical data profiles, event IDs/fields, themes, credentials, assistant history
  and model locations. Screen locking is not encryption of the complete application data.
- Preserve older QR formats and validate multipart/decompression limits before import.
- Existing 1.4.2 remains public Latest until final publication is approved.


[Release notes and upgrade instructions](.github/release-notes/v1.5.0.md)

## 1.4.2 — Published Stable

- Fix Android JSON-null stream prefixes and Polish calendar time/duration validation (PR #14/#15).
- Correct single-event/reminder routing; preserve free-form model extraction and explicit save confirmation.
- Add field-presence and finish-reason diagnostics without conversation text.
- Preserve data profiles, GGUF imports and the existing Android update identity; distribute no private weights.
- Verify documented Android, Linux AppImage, Windows portable and Web packages before stable publication.


## 1.4.1 — Previous Stable

- Fix Android GGUF download/import regressions and distinguish successful import from engine compatibility.
- Preserve native CPU inference, experimental GPU backends, explicit processing modes and safe Auto fallback.
- Support external GGUF directories on desktop, diagnostic JSON export and confirmed memory release.
- Preserve existing calendars, settings, assistant history and models on compatible updates.
- Ship model-free Android ARM64, Linux x86_64, Windows x86_64 and production Web packages.
- Publish the original verified packages through a draft-first GitHub Actions workflow; no rebuild or Android private key is needed.
- Retain original Git history and add English release documentation.

Android GPU inference remains unconfirmed on POCO Mali-G720. Linux includes CPU/Vulkan without bundled CUDA. Windows physical execution and physical NVIDIA/AMD/Intel compatibility are not certified. Further GPU work is deferred to 1.4.2; fine-tuning is not part of this release.

[Full release notes](.github/release-notes/v1.4.1.md) · [Known limitations](docs/known-limitations-1.4.1.md)


Earlier releases remain documented in the repository's Git history and GitHub Releases.
