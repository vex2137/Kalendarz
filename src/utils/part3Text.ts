import type { AppLanguage } from './i18n';
const text = {
 'Scan session expired. Reset scanning to start again.':['Sesja skanowania wygasła. Wyzeruj skanowanie, aby zacząć ponownie.','Сеанс сканирования истёк. Сбросьте сканирование.','Scan-Sitzung abgelaufen. Scannen zurücksetzen.'],
 'Data changed. Generate a new code.':['Dane się zmieniły. Wygeneruj nowy kod.','Данные изменились. Создайте новый код.','Daten wurden geändert. Neuen Code erzeugen.'],
 'Language and desktop layout':['Język i układ komputerowy','Язык и расположение панелей','Sprache und Desktop-Layout'],
 'Colors and custom themes':['Kolory i własne motywy','Цвета и свои темы','Farben und eigene Designs'],
 'Effects and motion preferences':['Efekty i preferencje ruchu','Эффекты и настройки движения','Effekte und Bewegung'],
 'Defaults, reminders and holidays':['Domyślne opcje, przypomnienia i święta','Параметры, напоминания и праздники','Standardwerte, Erinnerungen und Feiertage'],
 'Assistant preferences and models':['Preferencje asystenta i modele','Настройки ассистента и модели','Assistenteneinstellungen und Modelle'],
 'PIN, password and biometric unlock':['PIN, hasło i biometria','PIN, пароль и биометрия','PIN, Passwort und Biometrie'],
 'Files, QR and text codes':['Pliki, QR i kody tekstowe','Файлы, QR и текстовые коды','Dateien, QR- und Textcodes'],
 'Bindings, conflicts and resets':['Przypisania, konflikty i reset','Сочетания, конфликты и сброс','Belegungen, Konflikte und Zurücksetzen'],
 'Version, updates and MIT license':['Wersja, aktualizacje i licencja MIT','Версия, обновления и лицензия MIT','Version, Updates und MIT-Lizenz'],
 'Invalid QR frame':['Nieprawidłowy fragment QR','Некорректная часть QR','Ungültiges QR-Teil'], 'Invalid QR frame count':['Nieprawidłowa liczba części QR','Некорректное число частей QR','Ungültige QR-Teileanzahl'],
 'Damaged QR frame':['Uszkodzony fragment QR','Повреждённая часть QR','Beschädigtes QR-Teil'], 'Conflicting QR frames':['Sprzeczne fragmenty QR','Конфликтующие части QR','Widersprüchliche QR-Teile'],

 'General':['Ogólne','Общие','Allgemein'], 'Appearance and themes':['Wygląd i motywy','Оформление и темы','Darstellung und Designs'],
 'Animations':['Animacje','Анимации','Animationen'], 'Calendar':['Kalendarz','Календарь','Kalender'], 'AI assistant':['Asystent AI','ИИ-ассистент','KI-Assistent'],
 'Security':['Bezpieczeństwo','Безопасность','Sicherheit'], 'Data and sync':['Dane i synchronizacja','Данные и синхронизация','Daten und Synchronisierung'],
 'Keyboard shortcuts':['Skróty klawiaturowe','Горячие клавиши','Tastenkürzel'], 'Updates and about':['Aktualizacje i informacje','Обновления и информация','Updates und Info'],
 'All categories':['Wszystkie kategorie','Все категории','Alle Kategorien'], 'Search settings':['Szukaj ustawień','Поиск настроек','Einstellungen suchen'], 'No results':['Brak wyników','Нет результатов','Keine Ergebnisse'],
 'Desktop sidebar':['Komputerowy panel boczny','Боковая панель','Desktop-Seitenleiste'], 'Upcoming events':['Najbliższe wydarzenia','Ближайшие события','Anstehende Termine'], 'Panel width':['Szerokość panelu','Ширина панели','Seitenleistenbreite'],
 'Reset category':['Resetuj kategorię','Сбросить категорию','Kategorie zurücksetzen'], 'Reset these preferences? Saved themes and all other data will remain.':['Przywrócić preferencje? Zapisane motywy i pozostałe dane pozostaną.','Сбросить настройки? Темы и остальные данные сохранятся.','Einstellungen zurücksetzen? Gespeicherte Designs und andere Daten bleiben erhalten.'],
 'Save shortcuts':['Zapisz skróty','Сохранить сочетания','Tastenkürzel speichern'], 'Press a new shortcut':['Naciśnij nowy skrót','Нажмите новое сочетание','Neues Tastenkürzel drücken'],
 'Add binding':['Dodaj przypisanie','Добавить сочетание','Belegung hinzufügen'], 'Disable':['Wyłącz','Отключить','Deaktivieren'], 'Reset':['Przywróć','Сбросить','Zurücksetzen'], 'Saved':['Zapisano','Сохранено','Gespeichert'], 'Could not save':['Nie zapisano','Не удалось сохранить','Speichern fehlgeschlagen'],
 'Reserved shortcut':['Skrót zarezerwowany','Зарезервированное сочетание','Reserviertes Tastenkürzel'], 'Conflicting shortcuts':['Konflikt skrótów','Конфликт сочетаний','Konflikt bei Tastenkürzeln'],
 'System shortcuts may be intercepted by the OS or browser.':['Skróty systemowe może przechwycić system lub przeglądarka.','Система или браузер могут перехватывать системные сочетания.','Systemkürzel können vom Betriebssystem oder Browser abgefangen werden.'],
 'year':['Widok roku','Год','Jahresansicht'], 'month':['Widok miesiąca','Месяц','Monatsansicht'], 'week':['Widok tygodnia','Неделя','Wochenansicht'], 'day':['Widok dnia','День','Tagesansicht'], 'agenda':['Harmonogram','Расписание','Terminübersicht'],
 'settings':['Ustawienia kontekstowe','Контекстные настройки','Kontexteinstellungen'], 'assistant':['Otwórz asystenta AI','Открыть ИИ-ассистента','KI-Assistent öffnen'], 'search':['Wyszukiwanie','Поиск','Suche'], 'updates':['Sprawdź aktualizacje','Проверить обновления','Nach Updates suchen'], 'import':['Import danych','Импорт данных','Daten importieren'], 'export':['Eksport danych','Экспорт данных','Daten exportieren'], 'today':['Dzisiaj','Сегодня','Heute'], 'create':['Dodaj wydarzenie','Добавить событие','Termin hinzufügen'],
 'Generated code':['Wygenerowany kod','Созданный код','Erzeugter Code'], 'Import preview':['Podgląd importu','Предпросмотр импорта','Importvorschau'], 'Events':['Wydarzenia','События','Termine'], 'Deletions':['Usunięcia','Удаления','Löschungen'], 'Possible duplicates':['Możliwe duplikaty','Возможные дубликаты','Mögliche Duplikate'], 'Date range':['Zakres dat','Диапазон дат','Zeitraum'],
 'Confirm import':['Potwierdź import','Подтвердить импорт','Import bestätigen'], 'Decrypt for preview':['Odszyfruj do podglądu','Расшифровать для просмотра','Für Vorschau entschlüsseln'],
 'Missing parts':['Brakujące części','Недостающие части','Fehlende Teile'], 'Already scanned':['Już zeskanowano','Уже отсканировано','Bereits gescannt'], 'Different export. Reset scanning to start a new session.':['Inny eksport. Wyzeruj skanowanie, aby rozpocząć nową sesję.','Другой экспорт. Сбросьте сканирование для нового сеанса.','Anderer Export. Scannen zurücksetzen, um neu zu beginnen.'], 'Reset scanning':['Wyzeruj skanowanie','Сбросить сканирование','Scannen zurücksetzen'],
 'Every part is needed.':['Wymagane są wszystkie części.','Нужны все части.','Alle Teile werden benötigt.'], 'Check updates':['Sprawdź aktualizacje','Проверить обновления','Nach Updates suchen'],
 'Checking…':['Sprawdzanie…','Проверка…','Wird geprüft…'], 'Update check failed':['Sprawdzanie aktualizacji nie powiodło się','Не удалось проверить обновления','Updateprüfung fehlgeschlagen'],
 'No events in the next 30 days.':['Brak wydarzeń w najbliższych 30 dniach.','Нет событий в ближайшие 30 дней.','Keine Termine in den nächsten 30 Tagen.'],
} as const;
export function p3(lang: AppLanguage, key: string): string {
 const row=text[key as keyof typeof text];
 return lang==='en' ? ({year:'Year view',month:'Month view',week:'Week view',day:'Day view',agenda:'Schedule',settings:'Context settings',assistant:'Open AI assistant',search:'Search',updates:'Check updates',import:'Import data',export:'Export data',today:'Today',create:'Add event'} as Record<string,string>)[key]||key : row?.[lang==='pl'?0:lang==='ru'?1:2]||key;
}
