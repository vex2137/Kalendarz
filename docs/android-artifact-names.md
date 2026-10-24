# Android artifact names

Official production releases use **`Calendar-X.Y.Z-android.apk`**. The Android package ID, version and permanent signing certificate are independent of the download filename. Renaming release metadata changes neither installation/update compatibility nor the APK's bytes.

- `release.yml` produces the canonical name after verifying the permanent certificate. `verify-release.cjs` requires that name and rejects additional test/unsigned APKs in the production publication directory. `publish.yml` uses that verifier before uploading the tested packages.
- `feature-compatibility.yml` retains `Calendar-X.Y.Z-android-test.apk`, signed for isolated CI testing. `android-diagnostics.yml` retains `Calendar-AI-diagnostics.apk` and its separate diagnostic application ID. `build-apk.yml` exposes explicitly unsigned outputs. Historical `publish-v1.2.0.yml` retains its genuine development-signed test APK and opts into `verify-release.cjs --android-kind=test`.
- `sign-tested-apk.cjs` accepts one explicitly identified tested input (legacy test or canonical filename), signs it with the existing permanent key and writes only the canonical production filename.
- The Android-only publication path uses the canonical name, its `.apk.sha256` sidecar and the complete `SHA256SUMS.txt`. It refuses to overwrite an existing APK. A different binary needs a new version; naming maintenance never replaces APK contents.

## Existing release audit

Every published APK in the nine existing releases was downloaded, SHA-256 checked against GitHub's upload digest and verified with Android `apksigner`. Nine APKs were found; 1.1.0 has no APK. The permanent certificate is:

```text
b6b7bc0499ab59af54404a90aaa785e3d40f2738e83fdf9e6306f8e210c79a01
```

| Release | Previous name | Correct name / disposition |
| --- | --- | --- |
| 1.4.0 | `Calendar-1.4.0-android-test.apk` | `Calendar-1.4.0-android.apk` — production |
| 1.3.1 | `Calendar-1.3.1-android-assistant-fix.apk` | `Calendar-1.3.1-android.apk` — recommended production fix |
| 1.3.1 | `Calendar-1.3.1-android-test.apk` | `Calendar-1.3.1-android-original.apk` — original production build, archived as explicitly selected by the maintainer |
| 1.3.0 | `Calendar-1.3.0-android-test.apk` | Retained — Android Debug certificate |
| 1.2.3 | `Calendar-1.2.3-android-test.apk` | Retained — Android Debug certificate |
| 1.2.2 | `Kalendarz-Offline-1.2.2-android-test.apk` | Retained — Android Debug certificate |
| 1.2.1 | `Kalendarz-Offline-1.2.1-android-test.apk` | Retained — Android Debug certificate |
| 1.2.0 | `Kalendarz-Offline-1.2.0-android-test.apk` | Retained — Android Debug certificate |
| 1.0.0 | `Calendar.1.0.apk` | Retained historical debug APK |
| 1.1.0 | No APK | Unchanged |

There are two different permanently signed 1.3.1 binaries. Neither is discarded: the later assistant fix is canonical and the earlier binary remains an explicitly named archive. Their hashes are distinct and both belong in 1.3.1's complete checksum file.

Production APK SHA-256 values remain:

```text
b1065426530dd46a2f3bf2790e0571f3bc24d46660271a28a12b34e96dfce674  Calendar-1.4.0-android.apk
b5858d7c57c1a252f9643b3d9aa089a56cb9c757a2869de36d9443e965872080  Calendar-1.3.1-android.apk
2d9e358c3e55e62efa3a129c8675e7214e33d9b8afb07e4d8f671caa5f82f6dd  Calendar-1.3.1-android-original.apk
```

Downloads: [1.4.0](https://github.com/vex2137/Kalendarz/releases/download/v1.4.0/Calendar-1.4.0-android.apk), [1.3.1](https://github.com/vex2137/Kalendarz/releases/download/v1.3.1/Calendar-1.3.1-android.apk). The upgrade fixture and compatibility workflow now use the canonical permanently signed 1.3.1 download.

## Safe release maintenance

`android-artifact-names.yml` runs `maintain-android-assets.py`. Audit mode is read-only; apply mode uses the reviewed asset IDs and hashes in `android-artifact-renames.json`. Before any write it verifies every APK, the planned production signatures/hashes and destination names. APK names are changed with metadata-only PATCH requests; their asset IDs, sizes and upload hashes stay fixed. Each renamed APK is downloaded again and its signature/hash rechecked.

The workflow regenerates complete checksum files from uploaded artifact digests, updates the 1.3.1 APK checksum sidecar and release download instructions, and asserts that all non-Android installer IDs, names, sizes and hashes remain unchanged. Old checksum text and release metadata are backed up in the audit artifact. APKs are never re-uploaded, re-signed or deleted; test/debug and unclassified files are retained. Re-running the reviewed plan is safe.

Application code, package versions and existing Git tags are unchanged. Historical tagged sources retain their historical filenames; current download instructions use the corrected names. No installer builds are needed for this audit.
