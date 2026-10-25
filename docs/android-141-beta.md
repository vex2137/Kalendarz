# Calendar 1.4.1 beta test APK

This local test build contains the current 1.4.1 Android/web changes. It uses the
existing `diagnostics` variant and existing debug signing configuration; production
application IDs, signing keys and release verification are unchanged.

- Android version name: `1.4.1 beta`; version code: `10401`.
- Launcher label: `Calendar 1.4.1 beta`.
- Existing diagnostic application ID: `com.kalendarz.offline.diagnostics`.
- Installs separately from the official `com.kalendarz.offline` application.
- Output name: `Calendar-1.4.1-beta-android-test.apk`.

The beta intentionally contains no model weights because Hugging Face downloads
are denied in this workspace. The unchanged Qwen catalogue entry can be downloaded
or imported through AI settings on the device. Both CPU WebAssembly runtimes are
included. Desktop llama.cpp/Vulkan and external directory APIs are desktop features
and are not exposed as Android GPU support.

The beta frontend explicitly marks the default model as not bundled, so it offers
download/import without falsely claiming weights are installed. Production builds
still require verified bundled weights. The no-weights Gradle path is restricted
to `assembleDiagnostics` and requires matching beta frontend metadata.

With Node, JDK 21 and the Android SDK configured:

```sh
node scripts/prepare-beta-apk.cjs
CALENDAR_BETA_APK=true node node_modules/vite/bin/vite.js build
npx cap sync android
cd android
bash ./gradlew :app:assembleDiagnostics -PcalendarBeta=true --no-daemon
```

Local validation: TypeScript passed; 21 focused model/command tests passed; beta
frontend smoke verified the exact version, model download availability and event
persistence. The Android build passed. APK signature, manifest version, label,
embedded build metadata and WebAssembly assets were verified. Physical-device
execution is not claimed. No Git push or release publication was performed.
