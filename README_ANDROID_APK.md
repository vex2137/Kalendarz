# Android 1.4.2 — signed update and downloads

[Download KALENDARZ-1.4.2-ANDROID.apk](https://github.com/vex2137/Kalendarz/releases/download/v1.4.2/KALENDARZ-1.4.2-ANDROID.apk) · [Release notes](.github/release-notes/v1.4.2.md)

The official 1.4.2 asset is the existing signed ARM64 APK, version name `1.4.2`, code `10407`. It retains `com.kalendarz.offline.diagnostics` and the original Beta 3 / diagnostic certificate:

```text
ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143
```

Install it over the same Beta/diagnostic application without uninstalling or clearing data. It does not replace the separately signed production 1.4.0 application. Never generate a new signing key to work around an update mismatch.

The package does not bundle model weights. Existing downloaded/imported models are retained; new installations download or import a supported GGUF model. It includes the native ARM64 CPU/Vulkan runtime. Vulkan remains experimental on POCO; Auto keeps safe CPU fallback.

Publication uses the dedicated [verified 1.4.2 publisher](.github/workflows/publish-142.yml). It reuses the accepted Android Test 2 bytes from source `663b8ba6e1debe4bde6a15c46408adb3e19239cd`; SHA-256 `d38b3b78c5c888a9d403aa34f4c0b0fbfdb48b4bea4e179afce192dd5215f8bf`. The user confirmed Qwen v2 event interpretation, confirmation and save on POCO. Publishing does not rebuild or re-sign the APK and does not require a signing secret.

Android Test 1/2 and 1.4.1 belong to the same compatible update line. An existing Test 2 installation already contains these application bytes. The private Qwen v2 weights are not published; keep/import the existing GGUF. General small-model factual correctness and universal GPU support are not claimed.

Historical production-signing instructions in [docs/android-signing.md](docs/android-signing.md) describe another identity; do not substitute it for diagnostics updates. Build-specific private keys and passwords never belong in release assets.
