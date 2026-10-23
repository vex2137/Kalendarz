import type { AppLanguage } from './i18n';
const text = {
  en: {
    introduction: 'Simple calendar commands use local rules; harder requests use LFM2.5 on this device. The model is included in the application; no separate download or internet is needed. I show proposed changes for your confirmation.',
    download: 'Download model (229 MB)', import: 'Import GGUF', remove: 'Remove downloaded model', cancel: 'Cancel',
    checking: 'Checking model storage…', missing: 'Model not installed', downloading: 'Downloading model…', verifying: 'Verifying SHA-256…', installed: 'Model installed • offline ready', loading: 'Loading model…', ready: 'Model loaded • offline', running: 'Processing on this device…', error: 'Model unavailable',
    failure: 'The operation failed. Check your connection, free storage and available memory, then retry. An imported file must be the exact official Q4_K_M GGUF.',
    inputError: 'The model could not produce a valid calendar proposal. No events were changed. Try a shorter request with an explicit date and time.',
    note: 'The bundled model works offline. Manual recovery downloads contact Hugging Face only. Requests and calendar data stay on this device. Clearing app data removes imported model copies. Polish recognition may require clarification.',
    delete: 'Confirm deletion', deletion: 'Proposed deletion', edit: 'Proposed event update',
  },
  pl: {
    introduction: 'Proste polecenia obsługują lokalne reguły, a trudniejsze rozpoznaje LFM2.5 na tym urządzeniu. Model jest dołączony do aplikacji; nie wymaga osobnego pobierania ani internetu. Pokażę proponowane zmiany do zatwierdzenia.',
    download: 'Pobierz model (229 MB)', import: 'Importuj GGUF', remove: 'Usuń pobrany model', cancel: 'Anuluj',
    checking: 'Sprawdzanie modelu…', missing: 'Model nie jest zainstalowany', downloading: 'Pobieranie modelu…', verifying: 'Weryfikacja SHA-256…', installed: 'Model zainstalowany • gotowy offline', loading: 'Ładowanie modelu…', ready: 'Model załadowany • offline', running: 'Przetwarzanie na tym urządzeniu…', error: 'Model niedostępny',
    failure: 'Operacja nie powiodła się. Sprawdź połączenie, wolne miejsce i dostępną pamięć, potem spróbuj ponownie. Import wymaga dokładnie oficjalnego pliku GGUF Q4_K_M.',
    inputError: 'Model nie zwrócił poprawnej propozycji. Nie zmieniono wydarzeń. Spróbuj krótszego polecenia z dokładną datą i godziną.',
    note: 'Dołączony model działa offline. Pobieranie w celu odzyskania modelu łączy się tylko z Hugging Face. Polecenia i dane kalendarza pozostają na urządzeniu. Wyczyszczenie danych usuwa importowane kopie modelu. Rozpoznawanie polskiego może wymagać doprecyzowania.',
    delete: 'Potwierdź usunięcie', deletion: 'Propozycja usunięcia', edit: 'Propozycja edycji wydarzenia',
  },
  ru: {
    introduction: 'Простые команды обрабатываются локальными правилами, сложные — LFM2.5 на устройстве. Модель включена в приложение; отдельная загрузка и интернет не нужны. Изменения требуют вашего подтверждения.',
    download: 'Загрузить модель (229 МБ)', import: 'Импорт GGUF', remove: 'Удалить загруженную модель', cancel: 'Отмена',
    checking: 'Проверка модели…', missing: 'Модель не установлена', downloading: 'Загрузка модели…', verifying: 'Проверка SHA-256…', installed: 'Модель установлена • готова офлайн', loading: 'Загрузка модели в память…', ready: 'Модель в памяти • офлайн', running: 'Обработка на устройстве…', error: 'Модель недоступна',
    failure: 'Не удалось выполнить операцию. Проверьте подключение, свободное место и память. Для импорта нужен официальный файл GGUF Q4_K_M.',
    inputError: 'Модель не вернула корректное предложение. События не изменены. Попробуйте короткую команду с точной датой и временем.',
    note: 'Встроенная модель работает офлайн. Восстановление загрузкой обращается только к Hugging Face. Команды и календарь остаются на устройстве. Очистка данных удалит импортированные копии модели. Польские команды могут требовать уточнения.',
    delete: 'Подтвердить удаление', deletion: 'Предложение удаления', edit: 'Предложение изменения события',
  },
  de: {
    introduction: 'Einfache Kalenderbefehle nutzen lokale Regeln, schwierigere Anfragen LFM2.5 auf diesem Gerät. Das Modell ist in der Anwendung enthalten; ein separater Download und Internet sind nicht erforderlich. Änderungen werden zur Bestätigung angezeigt.',
    download: 'Modell herunterladen (229 MB)', import: 'GGUF importieren', remove: 'Heruntergeladenes Modell entfernen', cancel: 'Abbrechen',
    checking: 'Modell wird geprüft…', missing: 'Modell nicht installiert', downloading: 'Modell wird heruntergeladen…', verifying: 'SHA-256 wird geprüft…', installed: 'Modell installiert • offline bereit', loading: 'Modell wird geladen…', ready: 'Modell geladen • offline', running: 'Verarbeitung auf diesem Gerät…', error: 'Modell nicht verfügbar',
    failure: 'Der Vorgang ist fehlgeschlagen. Prüfe Verbindung, Speicherplatz und Arbeitsspeicher. Der Import erfordert die offizielle GGUF-Datei Q4_K_M.',
    inputError: 'Das Modell hat keinen gültigen Vorschlag erstellt. Ereignisse wurden nicht geändert. Versuche einen kürzeren Befehl mit genauem Datum und Uhrzeit.',
    note: 'Das enthaltene Modell funktioniert offline. Nur Wiederherstellungsdownloads kontaktieren Hugging Face. Befehle und Kalenderdaten bleiben auf dem Gerät. Das Löschen der App-Daten entfernt importierte Modellkopien. Polnische Befehle können Rückfragen erfordern.',
    delete: 'Löschen bestätigen', deletion: 'Vorgeschlagenes Löschen', edit: 'Vorgeschlagene Ereignisänderung',
  },
};
export const localModelText = (language: AppLanguage) => text[language];
