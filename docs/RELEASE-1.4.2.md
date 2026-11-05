# Kalendarz 1.4.2 release verification

Official targets are the four documented 1.4.1 targets: Android ARM64 APK, Linux x86_64 AppImage, Windows x86_64 portable EXE and Web deployment ZIP. Flatpak is a packaging scaffold, not a verified release target; macOS is not advertised.

All packages are model-free. Private Qwen v2 weights remain in the private depot and are used only for CI inference checks; they are never staged into public assets or release files. Existing installed models/settings/history are retained. New users can import a compatible GGUF or download an available catalogue model.

The Android package reuses the physically accepted Android Test 2 binary from source 663b8ba6e1debe4bde6a15c46408adb3e19239cd. Its SHA-256 is d38b3b78c5c888a9d403aa34f4c0b0fbfdb48b4bea4e179afce192dd5215f8bf; version 1.4.2/10407; ID com.kalendarz.offline.diagnostics; certificate ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143. The source runtime tree must match the tagged application tree. This preserves the diagnostics/1.4.1/Test 1/Test 2 installation, not the separately signed production 1.4.0 app.

Private Actions builds/test-runs Linux and Windows, runs browser/import/export/upgrade checks and records immutable SHA-256/LFS object metadata. After private verification, only release binaries are staged in the application repository's LFS object store without Git pointers or binary commits. The public publisher uses its own repository token and checks ancestry, source equivalence, all file hashes and model-free packaging, then uploads a draft, downloads/verifies its assets, and only then publishes stable v1.4.2. No existing tag or release is overwritten; no APK enters Git history.

The user confirmed Qwen v2 creation/confirmation/save and the null-prefix correction on physical POCO using Test 2. Other platform claims require their actual runner reports. GPU enumeration is not GPU-inference proof. General small-model factual correctness is not guaranteed. Windows packages are not Authenticode-signed.
