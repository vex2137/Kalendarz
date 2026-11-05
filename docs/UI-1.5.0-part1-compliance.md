# UI overhaul part 1 — compliance review and continuation

For the subsequent Android naming fix, preserved 1.4.2 runtime, new test results and the verified signing/publication blocker, see [the Android continuation report](UI-1.5.0-part1-android-language.md).

This is an implementation report, **not a release announcement**. It updates the earlier reports' remaining-work lists while retaining their historical verification records. Application version remains **1.4.1**. All continuation commits are local: no push, release, tag, merge, dependency installation or signing change.

## Baseline and review

Incoming HEAD: `772b32ae3b766c1f5c966e767515b5bab1619292`, branch `dev/1.5.0-ui-part1`. Its three audit fixes were a completed prerequisite, not completion of part 1.

The month already implemented dynamic rows, the event section and continuous multi-day bars. Day/week geometry, the twelve-month year, virtual agenda, semantic UI primitives and dirty-dialog confirmation were also present. These were inspected and tested instead of replaced. Concrete remaining gaps were date/time keyboard navigation, year tab order, virtual-list keyboard reachability, form accessibility/targets, contrast, spring-gap input and dirty-page reload protection.

Local ancestry was checked: the merge base with stable `ded3bdc5de00205987a0918b67145a96dc1c140f` is that stable commit. The stable version identity was established by the earlier publication preflight; current remote main/tag were not queried again. The entire UI branch's changed paths have no overlap with parallel Qwen commit `65c40c2145f502bfdd86198dc7520e8aefe26a7e`. Training, datasets, model configuration/weights, native wrappers, Android signing, version and lockfile are unchanged. No data migration or stored event schema change.

## Original part-1 requirements

“Completed” means implemented and checked in the stated shared-UI scope. It does not certify every host, device or accessibility standard. Partial implementation and verification limitations are explicit below.

| Main requirement | Status | Result and evidence / remaining limitation |
| --- | --- | --- |
| Analyse existing technologies, views, shared components, storage, themes, platforms and risks | Completed | Existing React/TypeScript/Vite, IndexedDB/settings, recurrence, native hosts and test architecture documented in `UI-1.5.0-part1.md`; scoped code compared with that report before continuing. |
| Preserve architecture, data, MIT project, identifiers and stable functionality | Completed within regression scope | Existing transactions, event schema, recurrence identity and settings retained. No destructive operation, version/native/signing change or protected-Qwen path overlap. |
| Shared UI spacing, typography, controls, cards, states and theme readiness | Completed for calendar/editor | Semantic primitives across all five views; reusable cards/date focus/dialog foundation. No permanent replacement palette. Existing settings/AI components retained for their later specifications. |
| Month: dynamic 4–6 rows and configured first weekday | Completed | February 2027/Monday = four rows. Five/six rows, Sunday starts and leap years covered; no fixed six-week filler. Existing implementation retained. |
| Month: grouped upcoming events, selection/toggle/reset and empty state | Completed | Selected-day list, exact Polish empty message, upcoming range, Today/period reset and Open day context passed browser checks. |
| Month: continuous multi-day/recurring bars, colors, overflow and original identity | Completed within tested cases | Week/month/year continuations, deterministic lanes, visible overflow counts, inclusive all-day/exclusive timed-midnight boundaries. Segment callbacks open the original event and do not add records. |
| Month: phone/desktop readability and freed space | Completed in emulation | Date targets, two/three lanes, separate overflow line and event section. Eight sizes checked; 390px/1920px month screenshots inspected. Longer months scroll inside the workspace. |
| Week: hours, duration, overlapping columns, all-day, current time, date boundaries | Completed within tested cases | Shared actual-time layout, overlap columns and correct week headers across months/years. Internal mobile pan preserved. Time cells now have one tab stop and local arrow/Home/End navigation. |
| Day: readable axis, duration, overlaps, details, navigation, no horizontal pan | Completed within tested cases | Same axis/layout, accessible complete event labels, current-time marker and full HH:mm creation. Prior audit regressions still pass. |
| Timezone and summer/winter changes | Partial | Real intervals separated from display coordinates; 23/25-hour axes, repeated-hour labels, Lord Howe transitions, conflicts and live-zone changes tested. Editor shows its timezone and rejects new/changed spring-gap inputs. Unrelated edits preserve imported gap timestamps. Explicit first/second repeated-hour editing remains unsupported; broader historical-zone/native-resume coverage unverified. |
| Year: twelve months, responsive columns, markers and navigation | Completed in shared UI | All twelve months, full labels, today/event markers, month/day links. One date tab stop replaces hundreds; focus moves across month/year boundaries. Month headings stay reachable. |
| Agenda: chronological groups, multi-day recurrence, editing and large lists | Completed within tested cases | Existing grouping/original callbacks retained. Up/Down/Home/End reach virtual entries including the last of 10,000 events; focused rows remain mounted and editor dismissal restores focus. Bounded DOM and list positions/counts checked. |
| Consistent five-view navigation, Today and date context | Completed in shared UI | Active view, selected-date context and period controls retained. Focused date/time cells use local arrows; global period controls and A/D remain with editing/modal exclusions. Touch suppression remains independent of keyboard handling. |
| Cards, existing menus and dialogs | Calendar interactions completed; broader visual review partial | Cards/bars/time blocks retain complete accessible labels. Native selects remain native. Shared focus trap excludes negative tabindex and fieldset-disabled controls. Editor labels/errors/selection semantics improved. Existing action dialogs opened/closed in four languages; exhaustive redesign/review of every non-calendar dialog not performed. |
| Unsaved changes and errors | Completed for tested paths | Cancel/close/Escape use discard confirmation. Actual dirty-page reload cancellation preserves the draft. Delayed writes disable fields/dismissal; duplicate submit prevents navigation. Failed writes retain the form and focus a localized error. OS/process termination and mobile browsers omitting beforeunload cannot guarantee recovery of an in-memory draft. |
| Responsive Android/Windows/Linux/Web and tablet/phone/desktop layouts | Partial platform verification | Shared Chromium UI checked at 320–2560px, landscape/tablet/window sizes, four languages and 320×450 high-DPI form size. Horizontal and outer vertical overflow checked, including five/six-row months. Physical Android/tablets and packaged Windows/Linux not run; no new platform support claimed. |
| Accessibility, contrast, keyboard and labels | Partial | Local date/time/list keys, single collection tab stops, localized instructions, labels, visible focus, larger form targets and selection semantics implemented. Sampled calendar text passes 4.5:1 in seven built-in themes/eleven event colors, including card hover. Full screen-reader/WCAG, zoom/font-scaling and arbitrary custom-palette verification remain. Existing custom-theme contrast warnings retained. |
| Performance, bounded rendering and cleanup | Completed within measured scope | Memoized indexes/virtualizer retained; focus pinning adds at most one row. Listeners/resources have cleanup. 10k-event checks pass; measurements are environment-specific, not device guarantees. |
| Existing CRUD, recurrence, settings, AI/security/import/export/QR/sync | Completed within regression scope | 157 units and built-Web CRUD/import/search/PIN/auto-lock/QR/cross-tab/write-failure/offline regressions pass. AI history/download/model implementations and native biometric/runtime behavior were not re-certified on devices; stored representations untouched. |
| Prepare future transitions/themes without implementing later specifications | Completed for part-1 structure | Existing navigation boundary, short transition/reduced-motion behavior and semantic theme slots retained. No invented comprehensive animation or per-bar color behavior. |
| Test, report honestly and withhold final 1.5.0 release | Completed | Executed checks below; limitations explicit. Local commits only, application version 1.4.1. |

## Continuation commits

- `5422049`: shared date focus, month keyboard navigation, richer bar labels and regressions.
- `52e57c3`: year/time-cell navigation and keyboard-reachable virtual agenda.
- `2078225`: form semantics/targets/localized focused errors, disabled-control focus handling, draft protection during writes and calendar contrast.
- `f46cd1d`: spring-gap editor guard, timezone context and dirty-page reload protection.
- `a8fd8fc`: contain assistive text and prevent outer vertical overflow with taller months.

## Changed files

- Composition: `src/App.tsx`.
- Views/cards: `src/components/MonthView.tsx`, `YearView.tsx`, `DayWeekView.tsx`, `AgendaView.tsx`, `CalendarEventCard.tsx`.
- Dialog/editor: `src/components/Dialog.tsx`, `EventModal.tsx`.
- Helpers/styles: `src/hooks/useCalendarDateFocus.ts`, `src/utils/calendarLayout.ts`, `calendarText.ts`, `eventFormTime.ts`, `src/index.css`.
- Tests: `tests/calendar-layout.test.ts`, `event-form-time.test.ts`, `ui-overhaul-browser.cjs`, `ui-accessibility-browser.cjs`, `ui-audit-regressions.cjs`, `browser.cjs`.
- Reports: this document, follow-up links in the earlier reports and `docs/verification/ui-part1-continuation-results.txt`.

## Executed verification

| Check | Result |
| --- | --- |
| `npm run lint` (`tsc --noEmit`) | Passed after TypeScript changes. |
| `npm test` | **157 passed, 0 failed**, standard isolated suite, including new date navigation/editor-time cases. |
| `node tests/ui-overhaul-browser.cjs` | Passed: five views, month rows/selection/bars, year/date focus, time/overlap geometry, virtual-list keyboard access, eight sizes, bounded 10k DOM, DST/live-zone, touch and Polish empty message. Final run checks outer height for five/six-row months. |
| `node tests/ui-audit-regressions.cjs` | Passed: HH:mm creation, keyboard/touch separation, input exclusions, spring-gap guard, timezone, actual dirty reload cancellation and corrected save. |
| `node tests/ui-accessibility-browser.cjs` | Passed: four localized forms, small/high-DPI reflow, focused errors/targets/selection, sampled contrast, failed/delayed write retention. |
| `CALENDAR_TEST_URL=… node tests/mobile-navigation.cjs` | Passed: PL/EN/RU/DE, five controls, 320/390/430/768/1280px, dialogs and bounds. |
| `CALENDAR_TEST_URL=… FEATURE_TEST_SECTION=desktop node tests/navigation-themes-sync.cjs` | Passed: period keys/exclusions and custom-theme CRUD/persistence/all views. |
| Same script, `FEATURE_TEST_SECTION=touch` | Passed: period swipes, week pan, reverse navigation, vertical exclusion and accidental-click prevention. |
| `node tests/browser.cjs` on the new verification build | Passed: existing regression paths above, responsive controls, large agenda and offline reload. Final measurement: 42ms agenda transition, 132 DOM elements, one environment only. |
| Existing `prepare-model-free.cjs`, then `CALENDAR_MODEL_FREE=true node_modules/.bin/vite build` | Passed including PWA. Local Web artifact without weights, not bundled-model/native certification or publication. Rebuilt after overflow fix. |
| Diff/path/version checks | Passed: correct branch/stable base, no protected-Qwen overlap and no version/native/signing/model changes. |

The first default-sandbox tsx command could not open its IPC pipe; focused cases passed through the Node import path, then the full standard suite passed through the approved execution path. Chromium/local servers also required that path. No dependencies were installed. The new checks found actual low-contrast states and outer overflow at 768px; both were fixed before successful runs. The form test needed an explicit wait for the lazy editor. Failed attempts are not counted as passes. Result excerpts and full-log hashes are retained in the verification file.

## Remaining work

Part-1 limitations: explicit first/second repeated-hour editing; full screen-reader/zoom/contrast coverage; native/physical-device, Firefox/Safari and process-termination draft verification, as detailed above. No remaining defect in the tested core month rows/selection/bars was found; this does not prove universal correctness.

Later parts remain unimplemented: dedicated dynamic top/bottom bar colors, larger desktop glyphs (header remains mostly 18/20px), comprehensive animations, the later gesture/shortcut map/configuration, final theme personalization, and forthcoming settings/security/QR/stability requirements. Current basic gestures/keys do not establish completion of those later specifications. Their behavior has not been invented here; 1.5.0 has not been published.
