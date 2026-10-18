# Development and data behavior

Use the existing isolated checkout in cloud tasks; no worktree is necessary.
Use Bun 1.4.3 and its frozen lockfile, Node 24 and the scripts in package.json.
Do not use npm install to maintain a second lockfile.

## Persistence and recovery

The IndexedDB database `offline-calendar` stores individual records and deletion
markers in transactions. Opening the app migrates `offline_calendar_events_v2`
once, retaining it as a backup. Do not delete that legacy key until the user has
verified a JSON backup. Once migrated, IndexedDB is authoritative. Clearing browser
site data deletes the local calendar; export backups first.

An import validates every event before committing any of them. The Settings import
merges by stable ID, explicitly treating imported records as new local edits.
Synchronization instead keeps the source timestamps. Newer edits win; deletions
win ties. Equal edit timestamps converge through a deterministic tie breaker.
Devices with clocks more than a day in the future are rejected. Correct device
clocks before syncing. Deletion markers are retained so offline devices cannot
reintroduce removed entries. Legacy v1 packets have no deletion information and
cannot convey deletions from old app versions.

Cross-tab changes notify other tabs after the IndexedDB transaction commits.
A write failure is shown in the app; the UI does not claim the change was saved.
Settings remain in localStorage because they are small. Failed writes are shown.

## Dates, imports and export

Calendar date arithmetic uses UTC-backed floating dates; local dates never come
from `toISOString()`. Month/year navigation clamps the day at month end. All-day
end dates are inclusive internally and exclusive in ICS. Timed midnight ends are
exclusive. A shared occurrence index drives views, reminders and assistant results.
RRULE COUNT counts actual occurrences, including skipped month days/leap years.
IANA zones are converted for display, and timed UNTIL cutoffs use the appointment
time in its source zone. Sub-minute/absolute/end-relative ICS alarms are rejected
instead of being silently changed.

ICS uses ical.js for unfolding, escaping and property parsing and rrule for calendar
recurrences. UIDs, alarms, colors, RRULE, EXDATE and source IANA time zones survive
round trips. Detached exceptions suppress the corresponding master occurrence.
RDATE, THISANDFUTURE, sub-daily RRULEs and incompatible timezone definitions are
currently rejected explicitly; export those calendars to JSON only after importing
supported events. JSON backups preserve all application event fields.

QR packets use gzip and SHA-256 integrity verification. Each QR is bounded in size;
frames can be scanned in any order, duplicates are ignored, and mixed transfers
are not merged. Maximum imported file/decompressed packet: 10 MiB; maximum events:
50,000; maximum QR frames: 256. Larger QR transfers use the file tab instead.
Generated holidays are omitted from QR by default and can be included. The payload
is not encrypted. Keep exported files and displayed codes private.

## Notifications and screen lock

Browser timers catch up for up to 24 hours after suspension and deduplicate recent
notifications across reloads. Browser reminders cannot run after all app windows
are closed. Native Android reminders use the local-notifications plugin. The app
refreshes the next seven days, at most 64 alarms, on launch or calendar changes;
permission is requested from the Settings button. Delivery still depends on OS
notification permissions and battery policies. Device delivery needs physical
Android testing.

A PIN gates the interface on every launch and after inactivity. Legacy plaintext
PINs migrate to PBKDF2-SHA256 (210,000 iterations, random salt); failed attempts are
rate limited. This is a screen lock, not database encryption or protection against
someone controlling the browser profile. Use the operating system's encrypted
storage for device-level protection.

## Validation

- `npm run lint`: TypeScript.
- `npm test`: dates/DST, recurrence limits, range indexing, midnight splitting,
  overlapping layouts, validation, ICS round trips, assistant conflicts, alarms,
  atomic persistence, concurrent writes, migration, sync packets and PIN hashing.
- `npm run build`: production build and PWA precache of lazy-loaded features.
- `npm run test:e2e`: own preview process, create/edit/persistence, merging import,
  holiday safety, search, focus/Escape, PIN/reload, 320/390/768 px controls,
  concurrent tabs, deletion sync, failed-write recovery, delayed camera cleanup,
  inactivity lock, 10,000-event DOM bound and production offline lazy features.
- `npm run test:desktop`: packaged Linux Electron startup and persistence. Build
  with `npx electron-builder --linux dir --publish never` first; a display is needed
  (`xvfb-run -a npm run test:desktop` on headless Linux). The test uses a temporary
  profile and disables Chromium sandboxing only for that isolated test process.

The benchmark uses synthetic events, 10% weekly recurrence, headless Chromium,
no CPU throttling. Timing is diagnostic, not a guarantee for every device. DOM
bounds are asserted to catch accidental removal of virtualization.

## Native builds

Android uses SDK 36/JDK 21 and the checksum-verified Gradle 8.14.3 wrapper. The local
notifications plugin is registered by `npx cap sync android`. Release builds enable
R8/resource shrinking. CI publishes an **unsigned build artifact**, not a signed
store release. The release workflow explicitly opts into developer signing with
`-PcalendarTestSigning=true` for the downloadable test APK. Production signing
credentials remain outside the repository. Both Android version fields derive
from package.json (major × 10000 + minor × 100 + patch).

Electron packages dist/ and electron/, excludes development-only dependencies,
and opens approved GitHub links in the system browser with sandboxing and context
isolation enabled. `npm run build:linux`, `build:win` and `build:flatpak` still require
the matching native packaging tools. Packaging success is distinct from testing an
installed application or notification delivery on a physical device.

## Releases

The version in package.json is shared by the UI, Electron and Android. Release
filenames include version and platform. Push a matching `v<version>` tag to run
`.github/workflows/release.yml`; main-branch runs build and test without publishing.
All seven platform packages must exist and pass their respective checks before the
release job generates SHA256SUMS.txt and publishes. The Android APK is a developer-
signed test package, Windows executables have no commercial Authenticode signature.
Release notes live in `.github/release-notes/v<version>.md`.

Successful main-branch package runs also trigger `publish.yml`. It downloads only
that successful run's artifacts, verifies all seven packages and publishes an
unreleased version at the exact tested commit, without rebuilding. Existing
releases are preserved; an existing tag targeting a different commit is rejected.
