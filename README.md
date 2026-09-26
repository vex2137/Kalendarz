# 📅 Calendar Offline (Offline Calendar)

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

- 🔒 **100% Offline & Private:** All events, reminders, and settings are stored locally on your device storage (`localStorage` / native sandbox).
- 🤖 **Offline Smart Assistant (NLP):** Natural language engine in Polish & English. Ask for your schedule (*"What do I have today?"*), detect schedule collisions (*"Check conflicts"*), find available free time slots (*"When am I free?"*), or create events with natural sentences (*"Meeting with team tomorrow at 2pm for 1h"*).
- 📲 **P2P QR Code Sync (PC ⇄ Mobile):** Seamless offline sync between PC and phone by scanning an encrypted QR code directly from screen to screen. No servers, accounts, or internet needed.
- 📆 **Comprehensive Calendar Views:** Month, Week, Day, Year, and Agenda views with fluid navigation and responsive mobile-first UI.
- 🇵🇱 **Polish Holidays & Custom Holidays:** Built-in calculation of Polish statutory holidays (including movable holidays like Easter and Corpus Christi) with one-click addition/removal.
- 🔁 **Recurring Events & Reminders:** Daily, weekly, monthly, and yearly recurring schedules with local notifications and alarms.
- 🔐 **PIN Lock Screen:** Optional 4-digit PIN security lock with auto-lock options.
- 🎨 **Adaptive Themes:** Light, Dark OLED, Nord Frost, Emerald, Sunset, Lavender, and Mocha themes.
- 📦 **Standard .ICS Import & Export:** Full interoperability with Google Calendar, Microsoft Outlook, Apple Calendar, and Mozilla Thunderbird.
- 🌐 **Bilingual Interface:** Instant switching between Polish 🇵🇱 and English 🇬🇧.

---

## 💻 Development & Local Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ or v20+)
- `npm` or `bun`

### Quick Start
```bash
# Clone the repository
git clone https://github.com/vex2137/Kalendarz.git
cd Kalendarz

# Install dependencies
npm install

# Start local development server
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🔄 Peer-to-Peer Sync (PC ⇄ Phone)

Kalendarz Offline allows data synchronization without passing through external servers or cloud accounts:
1. On your PC, click the **Sync** button in the navigation bar.
2. An encrypted QR code containing your calendar database will be generated on screen.
3. On your mobile app, open **Sync ➔ Scan QR Code** tab and point the camera at your monitor.
4. Your events and preferences will instantly synchronize.

---

## 📄 License & Privacy

- **Privacy First:** Zero trackers, zero analytics, zero external network calls.
- **License:** MIT License. Free for personal and commercial use.
