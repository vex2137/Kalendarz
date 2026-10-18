#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm run build:android
printf '%s\n' 'Unsigned release APK: android/app/build/outputs/apk/release/app-release-unsigned.apk' 'Sign the release with your own Android signing key before distributing it.'
