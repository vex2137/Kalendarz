#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
# One maintained manifest is used both locally and by the private workflow.
export CALENDAR_MODEL_FREE=true CALENDAR_ANDROID_NATIVE=false
export CALENDAR_INCLUDE_CUDA="${CALENDAR_INCLUDE_CUDA:-true}"
flatpak remote-add --user --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y --noninteractive flathub org.freedesktop.Platform//25.08 org.freedesktop.Sdk//25.08 org.electronjs.Electron2.BaseApp//25.08
node scripts/prepare-model-free.cjs
node node_modules/vite/bin/vite.js build --mode production
npx --no-install electron-builder --linux dir --x64 --publish never
flatpak-builder --user --force-clean --repo=build/flatpak-repo --default-branch=beta build/flatpak-root com.vex2137.kalendarz.yml
flatpak build-bundle build/flatpak-repo release/Calendar-1.5.0-linux-x64.flatpak com.vex2137.kalendarz beta --runtime-repo=https://flathub.org/repo/flathub.flatpakrepo
