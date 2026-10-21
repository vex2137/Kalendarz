import type { AppLanguage } from './i18n';
const text = {
  en: {
    introduction: 'I use LFM2.5 locally to understand calendar requests. Download the optional model first (229 MB). After installation, no internet is needed. I show proposed changes for your confirmation.',
    download: 'Download model (229 MB)', import: 'Import GGUF', remove: 'Remove downloaded model', cancel: 'Cancel',
    checking: 'Checking model storage…', missing: 'Model not installed', downloading: 'Downloading model…', verifying: 'Verifying SHA-256…', installed: 'Model installed • offline ready', loading: 'Loading model…', ready: 'Model loaded • offline', running: 'Processing on this device…', error: 'Model unavailable',
    failure: 'The operation failed. Check your connection, free storage and available memory, then retry. An imported file must be the exact official Q4_K_M GGUF.',
    inputError: 'The model could not produce a valid calendar proposal. No events were changed. Try a shorter request with an explicit date and time.',
    note: 'The download contacts Hugging Face only. Requests and calendar data stay on this device. Clearing app data also removes the model. Polish recognition may require clarification.',
    delete: 'Confirm deletion', deletion: 'Proposed deletion', edit: 'Proposed event update',
  },
  pl: {
    introduction: 'Rozpoznaję polecenia kalendarza lokalnie przez LFM2.5. Najpierw pobierz opcjonalny model (229 MB). Po instalacji internet nie jest potrzebny. Pokażę proponowane zmiany do zatwierdzenia.',
    download: 'Pobierz model (229 MB)', import: 'Importuj GGUF', remove: 'Usuń pobrany model', cancel: 'Anuluj',
    checking: 'Sprawdzanie modelu…', missing: 'Model nie jest zainstalowany', downloading: 'Pobieranie modelu…', verifying: 'Weryfikacja SHA-256…', installed: 'Model zainstalowany • gotowy offline', loading: 'Ładowanie modelu…', ready: 'Model załadowany • offline', running: 'Przetwarzanie na tym urządzeniu…', error: 'Model niedostępny',
    failure: 'Operacja nie powiodła się. Sprawdź połączenie, wolne miejsce i dostępną pamięć, potem spróbuj ponownie. Import wymaga dokładnie oficjalnego pliku GGUF Q4_K_M.',
    inputError: 'Model nie zwrócił poprawnej propozycji. Nie zmieniono wydarzeń. Spróbuj krótszego polecenia z dokładną datą i godziną.',
    note: 'Pobieranie łączy się tylko z Hugging Face. Polecenia i dane kalendarza pozostają na urządzeniu. Wyczyszczenie danych aplikacji usuwa też model. Rozpoznawanie polskiego może wymagać doprecyzowania.',
    delete: 'Potwierdź usunięcie', deletion: 'Propozycja usunięcia', edit: 'Propozycja edycji wydarzenia',
  },
  ru: {
    introduction: 'Я распознаю команды календаря локально с помощью LFM2.5. Сначала загрузите необязательную модель (229 МБ). После установки интернет не нужен. Изменения требуют вашего подтверждения.',
    download: 'Загрузить модель (229 МБ)', import: 'Импорт GGUF', remove: 'Удалить загруженную модель', cancel: 'Отмена',
    checking: 'Проверка модели…', missing: 'Модель не установлена', downloading: 'Загрузка модели…', verifying: 'Проверка SHA-256…', installed: 'Модель установлена • готова офлайн', loading: 'Загрузка модели в память…', ready: 'Модель в памяти • офлайн', running: 'Обработка на устройстве…', error: 'Модель недоступна',
    failure: 'Не удалось выполнить операцию. Проверьте подключение, свободное место и память. Для импорта нужен официальный файл GGUF Q4_K_M.',
    inputError: 'Модель не вернула корректное предложение. События не изменены. Попробуйте короткую команду с точной датой и временем.',
    note: 'Загрузка обращается только к Hugging Face. Команды и календарь остаются на устройстве. Очистка данных удалит модель. Польские команды могут требовать уточнения.',
    delete: 'Подтвердить удаление', deletion: 'Предложение удаления', edit: 'Предложение изменения события',
  },
  de: {
    introduction: 'Ich erkenne Kalenderbefehle lokal mit LFM2.5. Lade zuerst das optionale Modell herunter (229 MB). Danach wird kein Internet benötigt. Änderungen werden zur Bestätigung angezeigt.',
    download: 'Modell herunterladen (229 MB)', import: 'GGUF importieren', remove: 'Heruntergeladenes Modell entfernen', cancel: 'Abbrechen',
    checking: 'Modell wird geprüft…', missing: 'Modell nicht installiert', downloading: 'Modell wird heruntergeladen…', verifying: 'SHA-256 wird geprüft…', installed: 'Modell installiert • offline bereit', loading: 'Modell wird geladen…', ready: 'Modell geladen • offline', running: 'Verarbeitung auf diesem Gerät…', error: 'Modell nicht verfügbar',
    failure: 'Der Vorgang ist fehlgeschlagen. Prüfe Verbindung, Speicherplatz und Arbeitsspeicher. Der Import erfordert die offizielle GGUF-Datei Q4_K_M.',
    inputError: 'Das Modell hat keinen gültigen Vorschlag erstellt. Ereignisse wurden nicht geändert. Versuche einen kürzeren Befehl mit genauem Datum und Uhrzeit.',
    note: 'Nur der Download kontaktiert Hugging Face. Befehle und Kalenderdaten bleiben auf dem Gerät. Das Löschen der App-Daten entfernt das Modell. Polnische Befehle können Rückfragen erfordern.',
    delete: 'Löschen bestätigen', deletion: 'Vorgeschlagenes Löschen', edit: 'Vorgeschlagene Ereignisänderung',
  },
};
export const localModelText = (language: AppLanguage) => text[language];
