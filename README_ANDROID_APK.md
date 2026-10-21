# Android — Calendar 1.3.1 source

The current source bundles LFM2.5 weights, defers launcher-name changes until the app is in the background, and requires the permanent signing identity for public releases. See [signing setup and migration](docs/android-signing.md).

Previous 1.2.x/1.3.0 APKs used ephemeral debug keys. A new permanent key cannot upgrade them: **export calendar data before uninstalling anything**, migrate once, then import the backup. Do not assume `adb install -r` can bypass a certificate mismatch.

## Building

Requirements: Node.js 24, Bun 1.4.3, JDK 21, and Android SDK 36 (Build Tools 35.0.0). The Android platform is already added.

```sh
bun install --frozen-lockfile
# Optional: use existing verified weights instead of fetching the pinned model.
CALENDAR_MODEL_FILE=/path/to/LFM2.5-350M-Q4_K_M.gguf npm run build
npx cap sync android
node scripts/with-android-signing.cjs /path/to/private/signing-backup bash android/gradlew -p android :app:assembleRelease --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. The 229 MB model is inside the APK and its checksum is verified during building and before inference. No separate import/download is required.

Public CI builds restore the existing key from repository Actions secrets and compare the APK certificate against `android/release-certificate.sha256`. Missing secrets fail publication; there is no fallback to a new debug key. Private keys/passwords must never be committed or attached to a public release. Isolated compatibility builds may still opt into `-PcalendarTestSigning=true`; those APKs are not the permanent signed distribution.

Version name/code come from `package.json`: 1.3.1 → 10301. For subsequent versions using the same permanent key:

```sh
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Test event persistence across upgrades, all four languages while the app remains open, launcher names after backgrounding, and model inference in Polish and English offline. Notifications and camera behavior still depend on device permissions and battery settings.
