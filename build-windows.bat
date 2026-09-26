@echo off
:: ==============================================================================
:: Skrypt do uruchomienia lub budowania wersji Desktop (Windows)
:: ==============================================================================
title Kalendarz Offline - Desktop Windows

echo [1/2] Kompilacja aplikacji webowej...
call npm run build

echo.
echo Wybierz akcje:
echo 1. Uruchom natywne okno programu (Electron)
echo 2. Zbuduj instalator instalacyjny .exe (electron-builder)
set /p opt="Wybierz (1 lub 2, domyslnie 1): "

if "%opt%"=="2" (
  echo [2/2] Budowanie instalatora Windows .exe...
  call npx electron-builder --win nsis
  echo Gotowe! Plik instalacyjny .exe znajduje sie w folderze 'release\'.
) else (
  echo [2/2] Uruchamianie okna programu...
  call npx electron electron/main.cjs
)
pause
