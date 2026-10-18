#!/usr/bin/env bash
set -euo pipefail

# Uses the same maintained electron-builder configuration as release CI.
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user -y --noninteractive flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08
npm run build:flatpak
