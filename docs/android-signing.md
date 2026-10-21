# Permanent Android signing

Public APKs must use one permanent private key. Previous releases used ephemeral CI debug keys, so their certificates differ. Their private keys were not retained. A new permanent key cannot upgrade those installations: export calendar data from the installed app first, then migrate to the new signed app and import the backup. Do not uninstall before exporting. Never change the application ID to conceal a signing conflict.

The release build accepts `CALENDAR_KEYSTORE_PATH`, `CALENDAR_KEYSTORE_PASSWORD`, `CALENDAR_KEY_ALIAS` and `CALENDAR_KEY_PASSWORD`. `CALENDAR_REQUIRE_RELEASE_SIGNING=true` rejects builds without a permanent key. The public certificate fingerprint is pinned in `android/release-certificate.sha256`; the publication workflow verifies the APK against it. A different key cannot silently replace the release identity. `calendarTestSigning` remains available only for isolated compatibility tests; it is not a public release fallback.

A private key was generated outside the checkout at `/workspace/calendar-signing`. Its two files (`calendar-release.p12` and `signing.json`) must be backed up together privately. The password is random, and scripts pass it via environment variables rather than command arguments. Neither file belongs in Git, public release assets, CI logs or issue comments. The local path is not a durable off-machine backup.

## Configure GitHub Actions once

Using an account/token allowed to manage repository Actions secrets, run from the project directory:

```sh
node scripts/android-signing.cjs upload /path/to/private/signing-backup
```

This reads the existing key; it never generates a replacement. It sets four repository secrets:

- `CALENDAR_ANDROID_KEYSTORE_BASE64`
- `CALENDAR_ANDROID_STORE_PASSWORD`
- `CALENDAR_ANDROID_KEY_ALIAS`
- `CALENDAR_ANDROID_KEY_PASSWORD`

The release workflow restores the key into a temporary private file and requires its use. The current managed GitHub integration returns HTTP 403 for the repository secrets public-key API, so it could not complete that setup. Ordinary repository pushes/Actions access do not imply permission to manage secrets. Release publication must wait until these secrets are configured. Do not replace the generated key while adding them.

## Local signed builds

```sh
npm run build
npx cap sync android
node scripts/with-android-signing.cjs /path/to/private/signing-backup bash android/gradlew -p android :app:assembleRelease --no-daemon
ANDROID_HOME=/path/to/android-sdk node scripts/verify-android-signature.cjs android/app/build/outputs/apk/release/app-release.apk
```

For a completely new project only, `node scripts/android-signing.cjs generate /private/directory` creates a key and refuses to overwrite existing signing material. Do not use this to create a new key for each release. Test future upgrades with `adb install -r` over the previous permanent-key APK and verify that stored calendar records and settings survive.
