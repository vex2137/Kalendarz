# 📅 Kalendarz Offline 1.2.2 (Offline Calendar)

A modern, private, and 100% local calendar application inspired by Google Calendar. Built for **Android (APK)**, **Linux (Flatpak & AppImage)**, **Windows (.exe)**, and the **Web**.

Works entirely offline with zero cloud dependency, no telemetry, no tracking, and no user registration required.

---

## 📥 Downloads & Supported Platforms

Official standalone binaries and packages:

- 🤖 **Android:** `.apk`
- 🐧 **Linux:** `Flatpak` & `AppImage`
- 🪟 **Windows:** `.exe` installer / portable
- 🌐 **Web:** Progressive Web App (PWA) / Self-hosted

Check the [Releases](https://github.com/vex2137/Kalendarz/releases) section to download the latest version for your platform.

---

## ✨ Key Features

- 🔒 **100% Offline & Private:** All events, reminders, and settings are stored locally on your device storage (IndexedDB / native sandbox; settings in localStorage).
- 🤖 **Offline Smart Assistant (NLP):** Natural language engine in Polish, English & Russian. Ask for your schedule (_"What do I have today?"_), detect schedule collisions (_"Check conflicts"_), find available free time slots (_"When am I free?"_), or create events with natural sentences (_"Meeting with team tomorrow at 2pm for 1h"_).
- 📲 **P2P QR Code Sync (PC ⇄ Mobile):** Seamless offline sync between PC and phone by scanning a compressed multipart QR code directly from screen to screen. No servers, accounts, or internet needed.
- 📆 **Comprehensive Calendar Views:** Month, Week, Day, Year, and Agenda views with fluid navigation and responsive mobile-first UI.
- 🇵🇱 **Polish Holidays & Custom Holidays:** Built-in calculation of Polish statutory holidays (including movable holidays like Easter and Corpus Christi) with one-click addition/removal.
- 🔁 **Recurring Events & Reminders:** Daily, weekly, monthly, and yearly recurring schedules with local notifications and alarms.
- 🔐 **PIN Lock Screen:** Optional 4-digit PIN security lock with auto-lock options.
- 🎨 **Adaptive Themes:** Light, Dark OLED, Nord Frost, Emerald, Sunset, Lavender, and Mocha themes.
- 📦 **Standard .ICS Import & Export:** Full interoperability with Google Calendar, Microsoft Outlook, Apple Calendar, and Mozilla Thunderbird.
- 🌐 **Three Interface Languages:** Switch between English, Polish, and Russian. English is the default for new installations.

---

## 💻 Development & Local Setup

### Prerequisites

- Node.js 24 (pinned in `.nvmrc` / `.node-version`; minimum 22.12)
- Bun 1.4.3 (the maintained package manager and lockfile)

```bash
bun install --frozen-lockfile
npm run dev
```

Validation:

```bash
npm run check                  # TypeScript, regression tests, production PWA build
npx playwright install chromium # once, unless Chromium is already installed
npm run test:e2e                # browser, offline, responsive layout, and 10k-event checks
```

The browser runner starts and stops its own production preview on port 4174. Set
`BROWSER_EXECUTABLE` to use an existing Chromium executable. `npm run build` is
required before running the browser suite. Packaged Electron can be checked with
`npm run test:desktop` after a Linux directory build (use `xvfb-run -a` on headless
Linux).

Events are stored transactionally in IndexedDB. Existing localStorage calendars
are migrated once; the old value is retained as a recovery backup. Imports merge
with the calendar. JSON backups preserve every event field; ICS supports stable
UIDs, common recurrence rules, exclusions, timezone-tagged times and alarms.
Unsupported ICS constructs are rejected instead of being silently discarded.

QR synchronization uses compressed, integrity-checked multipart packets, including
removal records. Compression is **not encryption**. The screen PIN is salted and
hashed but does not encrypt the event database. Browser reminders require an open
app; Android schedules the next seven days (up to 64 pending reminders) using
native notifications and refreshes the schedule when the app is opened.

For Android release builds install JDK 21 and Android SDK 36, then run
`npm run build:android`. Release APKs use R8/resource shrinking and remain unsigned
until you sign them with your own key. Web checks also run before Android CI builds.

See the [offline assistant guide](docs/ASSISTANT.md) for bilingual commands, planning
preferences, rescheduling, and undo.

See [development notes](docs/DEVELOPMENT.md) for data recovery, sync compatibility,
verification coverage and native packaging details.

---

## 🔄 Peer-to-Peer Sync (PC ⇄ Phone)

Kalendarz Offline allows data synchronization without passing through external servers or cloud accounts:

1. On your PC, click the **Sync** button in the navigation bar.
2. A compressed multipart QR code containing your calendar database will be generated on screen.
3. On your mobile app, open **Sync ➔ Scan QR Code** tab and point the camera at your monitor.
4. Your events and preferences will instantly synchronize.

---

## 📄 License & Privacy

- **Privacy First:** Zero trackers, zero analytics, zero external network calls.
- **License:** MIT License. Free for personal and commercial use.
