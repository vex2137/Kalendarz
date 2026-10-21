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

## Manual publication when the integration cannot manage secrets

The release workflow also supports `manual_publish` with existing successful platform artifacts and a successful Android compatibility run. It verifies that Android application sources match the release source, then re-signs the tested APK with the permanent key and checks the pinned certificate, version, bundled weights/license and full package checksums before publication.

The temporary signing exchange uses a newly generated RSA-OAEP public key per runner. Only that public key and an AES-256-GCM envelope bound to repository/run/source are committed to a short-lived transport branch; the permanent keystore and password are encrypted together. The ephemeral private key remains inside the runner process, is never committed/logged/uploaded, and the transport branch is deleted after receipt. Plaintext signing files exist only in private runner temporary storage and are removed after publication. This does not configure persistent repository secrets; future automatic builds still need the four secrets above, or another explicit one-use handoff with the same permanent backup.

Client command after the runner publishes its public key:

```sh
node scripts/signing-exchange.cjs send RUN_ID /path/to/private/signing-backup EXACT_SOURCE_SHA
```

Never send a key to an untrusted workflow. The helper checks the active workflow identity and binds the envelope to the selected source/run; the publication job checks the resulting certificate against the pinned release identity.
