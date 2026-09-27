# Jak zbudować plik APK z tego projektu (Android)

Projekt został skonfigurowany pod Capacitor, dzięki czemu budowa APK jest w 100% zautomatyzowana.

## Wymagania na Twoim komputerze:
1. Zainstalowany **Node.js** (wersja 18+)
2. Zainstalowane **Android Studio** (z Android SDK)

---

## Krok 1: Przygotowanie
Wypakuj pobrane archiwum ZIP i otwórz ten folder w terminalu / konsoli (np. CMD, PowerShell lub Terminal na Mac/Linux):

```bash
npm install
npm run build
```

---

## Krok 2: Dodanie platformy Android i kompilacja APK

Uruchom:
```bash
npx cap add android
npx cap copy android
npx cap open android
```

Otworzy się program **Android Studio**:
1. Poczekaj chwilę, aż skończy się wstępna synchronizacja Gradle (na dole okna).
2. W górnym menu wybierz:
   **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
3. Gdy kompilacja się skończy, w prawym dolnym rogu pojawi się dymek:
   *„APK(s) generated successfully”* z linkiem **locate**.
4. Kliknij **locate** – zobaczysz gotowy plik **`app-debug.apk`**!

Prześlij go na telefon (np. przez kabel USB, Bluetooth, Telegram lub Dysk Google) i zainstaluj.
