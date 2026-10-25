# KALENDARZ 1.4.1 — najnowsza wersja stabilna

[English documentation](README.md) · [Wydanie v1.4.1](https://github.com/vex2137/Kalendarz/releases/tag/v1.4.1) · [Changelog](CHANGELOG.md)

Lokalny kalendarz na Android ARM64, Linux x86_64, Windows x86_64 oraz Web. Dane kalendarza i lokalne generowanie AI pozostają na urządzeniu. Konto chmurowego AI nie jest wymagane.

## Pobieranie

- [Android — podpisany APK](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/KALENDARZ-1.4.1-ANDROID.apk)
- [Linux — AppImage x86_64](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/KALENDARZ-1.4.1-linux-x86_64.AppImage)
- [Windows — przenośny EXE x86_64](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/KALENDARZ-1.4.1-WINDOWS-x86_64.exe)
- [Web — produkcyjny ZIP do wdrożenia](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/KALENDARZ-1.4.1-WEB.zip)
- [Sumy SHA-256](https://github.com/vex2137/Kalendarz/releases/download/v1.4.1/SHA256SUMS.txt)

Publikowane są oryginalne, zweryfikowane paczki 1.4.1, bez ponownej kompilacji.

## Instalacja i aktualizacja

APK ma kod wersji 10406, identyfikator `com.kalendarz.offline.diagnostics` i oryginalny certyfikat Beta 3 / diagnostic. Instaluj go na tę samą linię aplikacji, bez odinstalowywania i czyszczenia danych. Nie zastępuje osobno podpisanej wersji produkcyjnej 1.4.0. [Szczegóły Androida](README_ANDROID_APK.md).

Na Linuxie nadaj AppImage uprawnienie wykonywania przez `chmod +x`. Windows otrzymuje niepodpisany przenośny EXE; sprawdzono strukturę paczki i bibliotek, ale nie uruchomiono go na fizycznym Windowsie w środowisku wydania. Web ZIP należy rozpakować i udostępnić przez HTTPS albo localhost; zachowaj tę samą domenę i profil przeglądarki, aby zachować dane. Publikacja ZIP nie wdraża strony automatycznie.

## Funkcje

Widoki miesiąca, tygodnia, dnia, roku i agendy; wydarzenia, powtarzalność, przypomnienia i święta; import/eksport ICS i kopie JSON; historia asystenta; ustawienia, motywy, własne palety, PIN oraz szyfrowana synchronizacja QR. Interfejs obsługuje angielski, polski, rosyjski i niemiecki. Publikacja nie zmienia ustawień języka aplikacji.

Paczki nie zawierają wag modeli. Zachowują wcześniej zainstalowane modele; nowy model można pobrać w aplikacji albo zaimportować z GGUF. Pobranie wymaga sieci, a zainstalowany model może działać lokalnie offline. Android i desktop używają natywnego llama.cpp, Web korzysta z CPU WebAssembly. Obsługa architektury i kwantyzacji zależy od konkretnego silnika. Desktop obsługuje zewnętrzne katalogi GGUF bez usuwania ich plików.

## Ograniczenia

- Vulkan na Androidzie jest eksperymentalny. Użytkownik potwierdził podstawowe funkcje na POCO X7 Pro, ale udana inferencja GPU Mali-G720 nie została potwierdzona. Auto zachowuje fallback CPU, a diagnostyka pokazuje rzeczywisty backend.
- Linux AppImage zawiera CPU i Vulkan, bez CUDA. Nie potwierdzono fizycznej zgodności RTX 4060, AMD ani Intel w testach tego wydania.
- Nie dołączono nowego dostrojonego modelu. Dalsze prace nad GPU należą do 1.4.2.
- PIN nie szyfruje bazy wydarzeń, eksport JSON jest nieszyfrowany, a przypomnienia przeglądarkowe wymagają otwartej aplikacji.

[Szczegółowe ograniczenia](docs/known-limitations-1.4.1.md) · [Weryfikacja wydania](docs/release-1.4.1-publication.md)

Kod i oryginalna historia Git są zachowane w tagu `v1.4.1`. Dokumentacja główna i opis wydania są po angielsku. Projekt zachowuje deklarowaną licencję MIT; zależności i modele mają własne licencje.
