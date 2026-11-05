# KALENDARZ 1.4.2 — Latest Stable

A local calendar for **Android ARM64, Linux x86_64, Windows x86_64 and Web**.
Calendar data and local AI inference stay on your device. No cloud AI account is required.

[Polska dokumentacja](README.pl.md) · [Release v1.4.2](https://github.com/vex2137/Kalendarz/releases/tag/v1.4.2) · [Changelog](CHANGELOG.md)

## Downloads

| Platform | Download | Package |
| --- | --- | --- |
| Android ARM64 | [KALENDARZ-1.4.2-ANDROID.apk](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/KALENDARZ-1.4.2-ANDROID.apk) | Signed APK, version code **10407** |
| Linux x86_64 | [KALENDARZ-1.4.2-linux-x86_64.AppImage](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/KALENDARZ-1.4.2-linux-x86_64.AppImage) | AppImage |
| Windows x86_64 | [KALENDARZ-1.4.2-WINDOWS-x86_64.exe](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/KALENDARZ-1.4.2-WINDOWS-x86_64.exe) | Portable EXE |
| Web | [KALENDARZ-1.4.2-WEB.zip](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/KALENDARZ-1.4.2-WEB.zip) | Production deployment files |

Download [SHA256SUMS.txt](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/SHA256SUMS.txt) to verify the packages. Release assets are the verified binaries; publication verifies their SHA-256 without rebuilding. The Web archive is ready for self-hosting; publishing the archive does not deploy a website.

### Installation and updates

- **Android:** install the signed APK over the existing Beta 3 / diagnostic / 1.4.2 diagnostic installation. It retains application ID `com.kalendarz.offline.diagnostics` and the original update certificate. Do not uninstall the existing app or clear its data. The separately signed production 1.4.0 installation has a different identity; this APK does not replace it. See the [Android guide](README_ANDROID_APK.md).
- **Linux:** make the downloaded file executable with `chmod +x KALENDARZ-1.4.2-linux-x86_64.AppImage`, then run it. Existing user data stays in its application profile.
- **Windows:** run the portable EXE. The package is unsigned; it was checked for package and native-runtime integrity, but not launched on a physical Windows machine in the release environment.
- **Web:** extract the ZIP and serve its contents over HTTPS or localhost. Keep the same browser origin/profile to retain local data. Opening `index.html` directly is not the supported deployment method.

## Calendar features

- Month, week, day, year and agenda views, with touch and keyboard navigation.
- Events, recurrence, reminders, Polish public holidays and custom holidays.
- ICS import/export and JSON backups, preserving supported event fields.
- Local assistant conversation history and persisted preferences.
- Seven built-in themes, editable custom palettes and an optional PIN screen.
- Encrypted, compressed multipart QR synchronization between devices, without a synchronization server. See the [sync guide](docs/NAVIGATION_THEMES_SYNC.md).
- English, Polish, Russian and German interfaces. English is the existing default for new installations; this release publication does not change application language settings.

Events are stored locally in IndexedDB; preferences and existing migration mechanisms are retained. The PIN screen does not encrypt the event database. Plain JSON exports are unencrypted. Browser reminders require the app to remain open; Android notification behavior also depends on system permissions and battery settings.

## Local AI and models

These 1.4.2 packages **do not bundle model weights**. Previously installed models are retained. On a new installation, download a supported model in the app or import a compatible GGUF file. Model downloads require network access; once installed, local inference can run offline.

- Android and desktop provide native llama.cpp inference. Web uses the browser WebAssembly CPU runtime.
- Manual GGUF import is not restricted to catalog names or pre-known checksums. Import validation and successful engine loading are separate stages: architecture and quantization support depend on the packaged engine.
- Desktop can scan user-selected external GGUF folders without moving or deleting other applications' model files.
- Auto, CPU-only and GPU-only modes report the actual active backend. Auto keeps CPU fallback; GPU-only reports an error when acceleration cannot start.
- AI diagnostics, JSON export and confirmed memory release are available. Review proposed calendar changes before confirming them.

### Known limitations

- Android Vulkan remains experimental. The maintainer accepted core functionality on a physical POCO X7 Pro, but successful Mali-G720 GPU inference is **not confirmed**. GPU detection alone does not prove acceleration.
- The Linux AppImage includes CPU and Vulkan runtimes. CUDA is not bundled in this AppImage; RTX 4060, AMD and Intel GPU compatibility is not certified by this release's testing.
- GGUF compatibility, download availability, performance and memory usage vary by model, runtime and driver. No universal model or GPU support is claimed.
- The private fine-tuned Qwen v2 is compatible with local import; weights are not distributed. General 0.8B answers may contain factual errors.

See [known limitations and 1.4.2 follow-up](docs/known-limitations-1.4.1.md) and [release verification](docs/RELEASE-1.4.2.md).

## Source and development

The `v1.4.2` tag identifies the integrated source. Binary source commits and checksums are recorded in the verified release manifest; the accepted Android Test 2 binary is reused unchanged.

Development requires Node.js 24 and Bun 1.4.3:

```sh
bun install --frozen-lockfile
npm run dev
```

Relevant checks:

```sh
npm run check
npm run test:native
npx playwright install chromium
npm run test:e2e
```

Publication uses the dedicated 1.4.2 workflow after private platform checks pass. No private weights or signing keys are published.

See [development notes](docs/DEVELOPMENT.md) and [assistant documentation](docs/ASSISTANT.md).

## License

The project is distributed under the MIT license declared by the project documentation. Dependencies, inference runtimes and model weights retain their respective licenses; verify a model's license before use.
