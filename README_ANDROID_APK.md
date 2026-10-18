# Android — Kalendarz Offline 1.2.0

Gotowy instalowalny APK testowy znajdziesz w [wydaniu v1.2.0](https://github.com/vex2137/Kalendarz/releases/tag/v1.2.0).
Jest podpisany kluczem deweloperskim Androida; nie jest wydaniem Google Play.
Przed instalacją wyeksportuj kopię kalendarza. Aktualizacja APK podpisanego innym
kluczem wymaga odinstalowania starej aplikacji, co usuwa jej lokalne dane.

## Budowanie

Wymagania: Node.js 24, Bun 1.4.3, JDK 21 i Android SDK 36 (Build Tools 35.0.0).
Platforma Android jest już dodana; nie uruchamiaj ponownie `cap add android`.

```bash
bun install --frozen-lockfile
npm run build
npx cap sync android
cd android
# Instalowalna paczka do testów, z włączonym R8 i podpisem deweloperskim:
./gradlew assembleRelease -PcalendarTestSigning=true --no-daemon
# Windows: gradlew.bat assembleRelease -PcalendarTestSigning=true --no-daemon
```

Wynik: `android/app/build/outputs/apk/release/app-release.apk`.
Bez `-PcalendarTestSigning=true` powstaje niepodpisany `app-release-unsigned.apk`;
nie można go bezpośrednio zainstalować. Do dystrybucji produkcyjnej użyj własnego,
trwale przechowywanego klucza podpisującego poza repozytorium. Nie dodawaj kluczy
ani haseł do Git.

Numery `versionName` i rosnący `versionCode` wynikają z `package.json`:
1.2.0 → 10200. Instalacja na urządzeniu przez ADB:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

Sprawdź tworzenie i edycję wydarzeń, ponowne uruchomienie, import, przypomnienia
po przyznaniu uprawnień oraz skanowanie QR. Powiadomienia zależą także od
ustawień oszczędzania baterii telefonu.
