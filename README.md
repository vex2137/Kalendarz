# 📅 Kalendarz Offline

Prywatny, w 100% lokalny kalendarz w stylu Google Calendar na **Androida (APK)**, **Linuxa (CachyOS/Arch/Ubuntu)** oraz **Windowsa**. Działa całkowicie bez internetu, nie wymaga logowania ani konta w chmurze i nie wysyła żadnych danych telemetrycznych.

---

## 🚀 Spis treści
- [1. Szybki start (uruchomienie lokalne)](#1-szybki-start)
- [2. Budowanie pliku APK na telefon (Android)](#2-budowanie-pliku-apk-na-telefon-android)
- [3. Uruchamianie i budowanie na Linux (CachyOS / Arch / Ubuntu)](#3-uruchamianie-i-budowanie-na-linux)
- [4. Uruchamianie i budowanie na Windows (10 / 11)](#4-uruchamianie-i-budowanie-na-windows)
- [5. Główne funkcje kalendarza](#5-główne-funkcje-kalendarza)
- [6. Synchronizacja PC ⇄ Telefon bez chmury](#6-synchronizacja-pc--telefon-bez-chmury)

---

## 1. Szybki start

Wymagany zainstalowany [Node.js](https://nodejs.org/) (wersja 18+).

```bash
# Wejdź do katalogu projektu
cd ~/Pobrane/Kalendarz-main

# Zainstaluj zależności
npm install

# Uruchom wersję przeglądarkową (deweloperską)
npm run dev
```
Aplikacja uruchomi się pod adresem: `http://localhost:3000`.

---

## 2. Budowanie pliku APK na telefon (Android)

Przygotowany został automatyczny skrypt, który sam kompiluje kod, synchronizuje Gradle i kopiuje gotowy plik `.apk` wprost do Twojego folderu `~/Pobrane`:

### Sposób A — Jedna komenda (zalecany):
```bash
npm run build:apk
```
lub:
```bash
bash build-apk.sh
```

**Gdzie znajdziesz gotowy plik APK?**
* `~/Pobrane/Kalendarz.apk`
* `./Kalendarz-Offline.apk` (w głównym folderze projektu)

Możesz przesłać ten plik na telefon (np. przez kabel USB, Bluetooth, KDE Connect lub komunikator) i zainstalować.

### Sposób B — Otwarcie w Android Studio:
Jeśli wolisz graficzne środowisko Android Studio:
```bash
npm run build
npx cap sync android
npx cap open android
```
W menu Android Studio kliknij: **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.

---

## 3. Uruchamianie i budowanie na Linux

Aplikacja posiada natywną integrację z silnikiem **Electron**. Działa jako standardowy program okienkowy na pulpicie (z osobną ikoną na pasku zadań, obsługą powiadomień i bez zbędnych pasków przeglądarki).

### Uruchomienie programu od razu w oknie:
```bash
npm run desktop
```

### Zbudowanie samodzielnej paczki `.AppImage`:
```bash
npm run dist:linux
```
Gotowy plik wykonywalny znajdziesz w katalogu `release/Kalendarz Offline.AppImage`. Możesz nadać mu uprawnienia do uruchamiania i odpalać na dowolnej dystrybucji Linuksa.

### Interaktywne menu wyboru:
```bash
bash build-desktop.sh
```

---

## 4. Uruchamianie i budowanie na Windows

Dla użytkowników Windowsa dostępny jest plik wsadowy `.bat`.

### Uruchomienie dwuklikiem:
W folderze projektu kliknij dwukrotnie w plik **`build-windows.bat`**.

### Uruchomienie przez terminal (PowerShell / CMD):
```powershell
npm run desktop
```

### Zbudowanie instalatora `.exe` dla Windowsa:
```powershell
npm run dist:win
```
Instalator `Kalendarz Offline Setup.exe` zostanie zapisany w folderze `release\`.

---

## 5. Główne funkcje kalendarza

* **100% Offline & Zero Telemetrii:** Wszystkie wydarzenia przechowywane są lokalnie w bezpiecznej pamięci Twojego urządzenia (`localStorage` / `IndexedDB`).
* **Lokalny Asystent NLP:** Potrafi odpowiadać na pytania o Twój plan (*„Co mam dzisiaj?”*), wyszukiwać spotkania (*„Kiedy mam dentystę?”*), wyliczać wolne okienka (*„Kiedy mam wolny czas?”*), wykrywać kolizje terminów oraz tworzyć wydarzenia ze zdań po polsku.
* **Wyszukiwarka z filtrami (`Ctrl + F` / `Ctrl + K`):** Błyskawiczne przeszukiwanie całego kalendarza z filtrowaniem po kolorach oraz czasie (wszystkie, nadchodzące, przeszłe).
* **Oficjalne Polskie Święta:** W Ustawieniach jednym kliknięciem można zaimportować polskie dni ustawowo wolne od pracy (z automatycznym wyliczaniem świąt ruchomych takich jak Wielkanoc czy Boże Ciało).
* **Blokada kodem PIN:** Możliwość zabezpieczenia kalendarza 4-cyfrowym kodem PIN.
* **System Motywów Kolorystycznych:** Ciemny OLED, Nord Frost, Szmaragdowy, Zachód słońca, Lawenda oraz Mokka.
* **Format i Kopia .ICS:** Pełna zgodność z Google Calendar, Outlookiem i Thunderbirdem.

---

## 6. Synchronizacja PC ⇄ Telefon bez chmury

Aplikacja pozwala synchronizować dane między komputerem a telefonem bez zakładania jakichkolwiek kont:
1. W aplikacji na komputerze kliknij przycisk **Synchronizuj** na górnym pasku.
2. Na ekranie pojawi się wygenerowany kod QR z zaszyfrowaną bazą Twoich wydarzeń.
3. W aplikacji na telefonie wejdź w **Synchronizuj** -> zakładka **Skanuj kod** i skieruj aparat na monitor.
4. Cały kalendarz oraz wybrany motyw graficzny zostaną natychmiast przeniesione!
