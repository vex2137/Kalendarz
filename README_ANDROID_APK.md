# Android — Calendar 1.2.3

A ready-to-install test APK is available in the [v1.2.3 release](https://github.com/vex2137/Kalendarz/releases/tag/v1.2.3).
It is signed with an Android development key; it is not a Google Play release.
Export a calendar backup before installing. If your existing APK was signed with a different
key, you must uninstall the old app first, which deletes its local data.

## Building

Requirements: Node.js 24, Bun 1.4.3, JDK 21, and Android SDK 36 (Build Tools 35.0.0).
The Android platform has already been added; do not run `cap add android` again.

```bash
bun install --frozen-lockfile
npm run build
npx cap sync android
cd android
# Installable test package with R8 enabled and development signing:
./gradlew assembleRelease -PcalendarTestSigning=true --no-daemon
# Windows: gradlew.bat assembleRelease -PcalendarTestSigning=true --no-daemon
```

Output: `android/app/build/outputs/apk/release/app-release.apk`.
Without `-PcalendarTestSigning=true`, the build produces an unsigned `app-release-unsigned.apk`,
which cannot be installed directly. For production distribution, use your own
signing key and keep it stored securely outside the repository. Do not commit keys
or passwords to Git.

The `versionName` and increasing `versionCode` are derived from `package.json`:
1.2.3 → 10203. To install on a device using ADB:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Check event creation and editing, restarting the app, importing, reminders
after granting permissions, and QR scanning. Notifications also depend on
the phone's battery-saving settings.
