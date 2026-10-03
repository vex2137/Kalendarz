#!/usr/bin/env bash
# ==============================================================================
# Skrypt do budowania paczki Flatpak (.flatpak bundle)
# Wymaga zainstalowanego flatpak i flatpak-builder w systemie Linux
# ==============================================================================
set -e

echo "📦 Budowanie wersji Flatpak dla Kalendarz Offline..."

# 1. Upewnij się, że projekt jest skompilowany
npm run build
npx electron-builder --linux dir

# 2. Zainstaluj niezbędne runtime i SDK (jeśli nie istnieją)
echo "📥 Sprawdzanie runtime Flathub..."
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || true
flatpak install -y --noninteractive flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08 || true

# 3. Zbuduj Flatpak za pomocą flatpak-builder
echo "🔨 Kompilacja Flatpak..."
rm -rf .flatpak-builder build-flatpak repo
flatpak-builder --force-clean build-flatpak com.vex2137.kalendarz.yml --repo=repo

# 4. Wygeneruj samodzielny pojedynczy plik .flatpak
mkdir -p release
flatpak build-bundle repo release/Kalendarz-Offline.flatpak com.vex2137.kalendarz

echo "✅ Gotowe! Plik paczki znajduje się w: release/Kalendarz-Offline.flatpak"
