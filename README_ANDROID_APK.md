# Android 1.4.1 — signed update and downloads

[Download KALENDARZ-1.4.1-ANDROID.apk](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/KALENDARZ-1.4.1-ANDROID.apk) · [Release notes](.github/release-notes/v1.4.1.md)

The official 1.4.1 asset is the existing signed ARM64 APK, version name `1.4.1`, code `10406`. It retains `com.kalendarz.offline.diagnostics` and the original Beta 3 / diagnostic certificate:

```text
ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143
```

Install it over the same Beta/diagnostic application without uninstalling or clearing data. It does not replace the separately signed production 1.4.0 application. Never generate a new signing key to work around an update mismatch.

The package does not bundle model weights. Existing downloaded/imported models are retained; new installations download or import a supported GGUF model. It includes the native ARM64 CPU/Vulkan runtime. Vulkan remains experimental on POCO; Auto keeps safe CPU fallback.

Publication uses the [recovered-package workflow](.github/workflows/publish-recovered-141.yml). It restores the APK from immutable commit `7f55cdabc9baaea2f752fe60f551ff98f509b7c1`, verifies its SHA-256, and publishes it without rebuilding or re-signing. No Android signing secret is used by this publication workflow.

The separate [manual build workflow](.github/workflows/build-apk.yml) remains available for future explicitly approved builds. Its signing preflight requires the original update key. Historical production-signing instructions in [docs/android-signing.md](docs/android-signing.md) describe another signing identity; do not substitute that identity for Beta/diagnostic updates.
