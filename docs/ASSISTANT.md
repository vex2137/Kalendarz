# Offline assistant

The assistant uses local language rules and the calendar's recurrence engine. It
supports English, Polish, Russian, and German without sending calendar data to a server. English is
the default for new installations; an explicitly saved language is retained. The
app is called **Calendar**, **Kalendarz**, **Календарь**, or **Kalender** according to the selected language.

## Commands

| Action | English | Polish |
| --- | --- | --- |
| Create a draft | Add dentist tomorrow at 3pm | Dodaj dentystę jutro o 15 |
| Correct a draft | Actually one hour later | Jednak godzinę później |
| Search with word variants | Find team meetings | Znajdź spotkania z Adamem |
| Reschedule a saved event | Move dentist to Friday at 4pm | Przełóż dentystę na piątek o 16 |
| Find availability | When am I free tomorrow for 60 minutes? | Kiedy mam wolne jutro na 60 minut? |
| Review conflicts | Check conflicts | Sprawdź kolizje |
| Plan several sessions | Schedule three one-hour workouts next week | Zaplanuj trzy godzinne treningi w przyszłym tygodniu |
| Summarize a range | Summary of next month | Podsumuj weekend |

Search handles common word endings and selected calendar-related equivalents;
it is not a general-purpose language model. When several saved events match a
reschedule request, choose the numbered result before proceeding.

## Planning preferences

In Settings, choose the assistant's preferred start/end times, days of the week,
and buffer between events. These preferences apply to free-slot searches, batch
planning, and conflict-resolution proposals. They do not move existing events.
All-day events occupy their whole day; generated Polish holidays are excluded
from availability checks. Past slots are not proposed.

Batch planning supports 2–20 sessions with a specified duration. It proposes one
session per available preferred day and only returns a complete batch. If there
is not enough room, change the preferences or request fewer sessions. Conflict
checks propose a replacement time for a conflicting, non-recurring event when
one is available. Recurring/imported series must be edited in the event editor so
the assistant does not silently change the scope or exceptions of a series.

## Confirmation and undo

A proposal never saves itself. Review every date, time, and the before/after
preview, then choose **Confirm all changes**. A batch is saved atomically.
Rescheduling keeps the event ID, reminders, description, and other event details.

**Undo last assistant operation** reverses the most recent assistant save during
the current app session, even after closing and reopening the assistant. Adding
several sessions counts as one operation. Undo does not remove unrelated edits;
if any affected event has since changed, it refuses to overwrite the newer data.
Undo history does not survive a page reload. Clearing the conversation does not
undo saved calendar changes.

## Focused verification

Run the assistant and persistence test files in separate processes because the
IndexedDB fixtures are isolated per process:

```bash
TZ=Europe/Warsaw node --import tsx tests/assistant.test.ts
TZ=Europe/Warsaw node --import tsx tests/assistant-actions.test.ts
TZ=Europe/Warsaw node --import tsx tests/store.test.ts
```

The focused browser check works against a development server, without packaging:

```bash
npm run dev -- --host 127.0.0.1 --port 4176 --strictPort
# In another terminal; optionally set BROWSER_EXECUTABLE:
node tests/assistant-browser.cjs
```

## Russian

Select **Русский** in Settings to use Russian throughout the interface. The app
displays **Календарь**; the language choice is retained after reload. Basic local
assistant examples include:

- `Добавь встречу завтра в 15 на 30 минут`
- `Что у меня сегодня?`
- `Когда я свободен завтра на 60 минут?`
- `Найди встречу`
- `Перенеси встречу на пятницу в 16`
- `Запланируй три часовые тренировки на следующую неделю`

The assistant normalizes supported command grammar locally; it does not translate
saved event names, descriptions, or imported calendars. Unsupported wording may
need rephrasing. Russian language support does not add another country's holidays.

## German

Select **🇩🇪 Deutsch** in Settings. The interface and date formatting use German;
the choice is retained after reload. Basic offline commands include:

- `Füge Zahnarzt morgen um 15 Uhr für 30 Minuten hinzu`
- `Was habe ich heute?`
- `Wann habe ich morgen frei für 60 Minuten?`
- `Suche Zahnarzt`
- `Verschiebe Zahnarzt auf Freitag um 16 Uhr`
- `Plane drei einstündige Trainings nächste Woche`
- `Prüfe Überschneidungen`

Review proposals before confirming. The assistant uses supported language rules;
complex phrasing may need rewording. German support does not add German holidays.

On Android, the launcher name follows the language selected in the app. Some
launchers may take a moment to refresh the displayed label. Installed web shortcuts
and desktop installer names are controlled by their platform, separately from the
live application title.
