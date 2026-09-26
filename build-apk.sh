#!/usr/bin/env bash
# ==============================================================================
# Skrypt do szybkiego i automatycznego budowania pliku APK dla aplikacji
# "Kalendarz Offline" na systemach Linux (w tym CachyOS / Arch / Ubuntu)
# ==============================================================================

set -e

echo "🚀 [1/4] Kompilacja aplikacji webowej (Vite)..."
npm run build

echo "🔄 [2/4] Synchronizacja z platformą Android (Capacitor)..."
if [ ! -d "android" ]; then
  echo "📱 Inicjalizacja platformy Android..."
  npx cap add android
fi
npx cap sync android

echo "⚙️ [3/4] Budowanie pliku APK przez Gradle..."
cd android

# Upewnij się, że gradlew ma uprawnienia do wykonywania
chmod +x gradlew
./gradlew assembleDebug

cd ..

APK_SOURCE="android/app/build/outputs/apk/debug/app-debug.apk"
APK_TARGET="./Kalendarz-Offline.apk"

if [ -f "$APK_SOURCE" ]; then
  echo "✅ [4/4] Gotowe! Kopiowanie pliku APK..."
  cp "$APK_SOURCE" "$APK_TARGET"
  
  # Jeśli istnieje folder Pobrane (np. w polskiej wersji Linuxa) lub Downloads
  if [ -d "$HOME/Pobrane" ]; then
    cp "$APK_SOURCE" "$HOME/Pobrane/Kalendarz.apk"
    echo "📁 Skopiowano również do: $HOME/Pobrane/Kalendarz.apk"
  elif [ -d "$HOME/Downloads" ]; then
    cp "$APK_SOURCE" "$HOME/Downloads/Kalendarz.apk"
    echo "📁 Skopiowano również do: $HOME/Downloads/Kalendarz.apk"
  fi

  echo "=================================================================="
  echo "🎉 SUKCES! Plik APK został pomyślnie zbudowany:"
  echo "📍 Lokalny plik: $(pwd)/Kalendarz-Offline.apk"
  echo "📲 Możesz go teraz przesłać na telefon i zainstalować."
  echo "=================================================================="
else
  echo "❌ Błąd: Nie znaleziono wygenerowanego pliku APK w $APK_SOURCE."
  exit 1
fi
