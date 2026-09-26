#!/usr/bin/env bash
# ==============================================================================
# Skrypt do uruchomienia lub budowania wersji Desktop (Linux / Arch / CachyOS)
# ==============================================================================

set -e

echo "🖥️ Kalendarz Offline — Aplikacja Desktopowa Linux"
echo "1) Uruchom aplikację natywnie (okno Electron)"
echo "2) Zbuduj paczkę .AppImage (dla dowolnej dystrybucji Linux)"
read -p "Wybierz opcję (1 lub 2, domyślnie 1): " choice

npm run build

if [ "$choice" == "2" ]; then
  echo "📦 Budowanie paczki AppImage..."
  npx electron-builder --linux AppImage
  echo "✅ Gotowe! Sprawdź folder 'release/'."
else
  echo "🚀 Uruchamianie aplikacji w osobnym oknie..."
  npx electron electron/main.cjs
fi
