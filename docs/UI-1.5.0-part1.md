# Calendar UI overhaul — part 1 of 4

Implementation report; this is not a release announcement. The application version remains **1.4.1**. No tag, release, deployment, signing configuration or application identifier was changed.

## Isolation and baseline

- Work branch: `dev/1.5.0-ui-part1`.
- GitHub `main` was checked before creating the branch: `ded3bdc5de00205987a0918b67145a96dc1c140f`, matching the initial clean local checkout. The local `origin/main` reference was older and was not used as the base.
- GitHub `dev/1.4.2-qwen35-finetune` was independently checked: `65c40c2145f502bfdd86198dc7520e8aefe26a7e`.
- The 1.4.2 commit's changed paths were inspected. This change set does not modify those paths, including `package.json`, model preparation scripts, model registries, assistant prompts, training files or weights. No merge, reset, force push or remote write was performed.
- Git transport was initially unavailable through the sandbox proxy; the GitHub connector supplied the remote commit checks. Build/test subprocesses used the approved execution path where sandbox restrictions prevented normal execution.

## Repository analysis and implementation plan

The application is React 19 + TypeScript, built by Vite with Tailwind CSS and Lucide icons. Web/PWA, Electron Windows/Linux and Capacitor Android are already configured platforms. The UI is shared across those hosts; this task does not introduce a new platform.

`App.tsx` owns date/view navigation, event dialogs and callbacks. The five views are `MonthView`, `DayWeekView` (two modes), `YearView` and `AgendaView`. `TopNavBar`, `BottomNavMobile`, `CalendarNavigation` and `Dialog` are shared controls. `Dialog` already handles focus trapping, Escape/back, background inertness and restoration of focus; that implementation was retained and reused for nested confirmations.

`useCalendar` delegates transactional storage to `calendarStore`: IndexedDB `offline-calendar`, `records` and `meta`, deletion tombstones, legacy backup retention and cross-tab change notifications. Settings remain in `offline_calendar_settings_v2`. Recurrence uses the existing RRule expansion and range index; ICS import/export and validation remain unchanged. No migration or stored event model change was needed.

The existing theme engine exposes thirteen semantic customization slots and seven built-in themes. The new calendar components use those CSS variables; event colors remain associated with the original event. Existing theme persistence and language selection are retained.

The principal inconsistencies were the fixed 42-cell month grid, repeated per-cell event chips, separate agenda/card styles, small year-day targets, white text on every timeline event color, a width cap on desktop content and a header that consumed two rows even on wide screens. The plan was to centralize presentation helpers/cards and semantic UI primitives, rebuild the month first, then reuse them in the remaining views and verify data-dependent behavior.

The highest risks were recurrence identity when splitting bars, midnight inclusivity, overlap geometry, losing a selected date on view changes, dirty dialog dismissal, scrolling conflicts with touch navigation and cached dates after a system timezone change. These are covered by targeted unit/browser tests.

## Implemented behavior

- **Shared UI:** semantic surfaces, borders, spacing, radii, controls, focus states, empty states and reusable event cards. Card titles/descriptions wrap within bounded lines, while the complete event remains available through its existing editor. Cards and timed blocks use theme text contrast and retain the event color as a stripe/tint. New text is available in English, Polish, Russian and German.
- **Month:** calculated 4/5/6-row grids respecting the configured week start; selectable/toggleable days; selection reset on period navigation and Today; upcoming/date-grouped events underneath; the exact Polish empty-day message; an explicit Open day action. The default list starts today in the current month and at the first day when browsing a different month; its displayed range is explicit. Selecting an adjacent-month date retains the visible month until the user navigates or opens/switches the view.
- **Month bars:** one segment per contiguous occurrence/week, continuing across weeks/months/years; deterministic lanes; separate recurrence occurrences; overflow counts per day for the two mobile/three desktop visible lanes. Every segment opens the original event. Nothing is copied into storage.
- **Day/week:** sticky dated headers, readable local times, colored continuous all-day bars sized by occupied lanes rather than total event count, uniform pixels per elapsed minute, overlap columns including minimum-height short events, current-day/current-time marks and initial scrolling near the current time (otherwise morning). Phones can pan the week internally; day view fits the viewport. Header date buttons open the day; time slots still open the existing event form.
- **DST/timezone correctness:** actual 23/25-hour day axes, offset labels for repeated hours, column-local hour labels in weeks containing a clock change, half-hour transition support and correct elapsed-duration geometry. Zoned events that finish at an earlier repeated wall-clock time no longer disappear. Optional start/end instants are derived occurrence metadata only; `CalendarEvent` and its persisted representation are unchanged. The existing occurrence cache now includes the system timezone.
- **Year:** all twelve months, adaptive columns, full weekday abbreviations, larger date targets, today/event markers with accessibility labels, keyboard-accessible month headings and day links.
- **Agenda:** shared cards and dated groups; recurring/multi-day occurrences; original event editing; bounded DOM through the existing TanStack virtualizer; measured variable-height rows; explicit displayed range and 60-day range extension. Scrolling resets when navigating to another starting date. ResizeObserver measurements use animation frames.
- **Navigation/space:** selected month dates carry into other views, Today clears month selection, week headings include the full date range across year boundaries, desktop header controls share one row at 1280px and above, and calendar content uses the available desktop width while agenda text retains a reading-width limit.
- **Event dialogs:** all existing fields and save/delete callbacks retained, initialization before paint, responsive scrolling and reachable action buttons. Dirty Cancel/close/Escape opens a focus-trapped discard confirmation; keep editing preserves the draft. Delete confirmation also uses the shared dialog focus handling. Existing native selects remain native; no fabricated context-menu actions were added.

## Files

| Area | Changed/new paths |
| --- | --- |
| Composition/date state | `src/App.tsx` |
| Five views | `src/components/MonthView.tsx`, `DayWeekView.tsx`, `YearView.tsx`, `AgendaView.tsx` |
| Shared event UI | `src/components/CalendarEventCard.tsx`, `EventModal.tsx` |
| Navigation | `src/components/TopNavBar.tsx`, `BottomNavMobile.tsx`, `CalendarNavigation.tsx` |
| Semantic design primitives | `src/index.css` |
| Presentation/date helpers | `src/utils/calendarLayout.ts`, `calendarText.ts`, `timeline.ts`, `layout.ts` |
| Occurrence compatibility fix | `src/utils/recurrence.ts` |
| Tests | `tests/calendar-layout.test.ts`, `ui-overhaul-browser.cjs`, `browser.cjs`, `mobile-navigation.cjs`, `navigation-themes-sync.cjs` |
| Report | `docs/UI-1.5.0-part1.md` |

## Verification

Executed in this environment:

- `npm run lint`: passed.
- `npm test`: **148 passed, 0 failed**. Includes ten new presentation/date cases, month row counts, configurable week start, leap years, DST boundaries, multi-day/recurring identity, midnight ends, lanes, agenda order, live-zone cache invalidation, repeated-hour events and Lord Howe half-hour transitions. Existing calendar, assistant, store, settings/theme, import/export, security and sync unit tests also passed.
- `node tests/ui-overhaul-browser.cjs`: passed in Chromium. Verifies month selection/reset/empty content, 4/5/6 rows, original event identity across segments, day/week coordinates and overlap columns, Today/date context, twelve months, year-boundary headings, agenda extension, dirty dialogs, keyboard focus, eight viewport sizes, bounded rendering of 10,000 events with the last item reachable, 23/25-hour days, live timezone changes and CDP touch input.
- Responsive sizes: **320×568, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1920×1080, 2560×1440**. All five views were exercised at each size; the page did not overflow horizontally and the day timeline did not require horizontal scrolling. Additional screenshots of all five views were captured at 390px and 1440px and reviewed alongside the responsive month captures; an overflow-label/third-bar collision was found and fixed.
- `node tests/mobile-navigation.cjs`: passed for PL/EN/RU/DE, all five views and widths 320/390/430/768/1280, including action dialogs, date-heading bounds and the mobile header-height limit.
- `FEATURE_TEST_SECTION=desktop node tests/navigation-themes-sync.cjs`: passed for period keys, modifier/editing exclusions, custom theme CRUD/persistence, all five views and built-in fallback.
- `FEATURE_TEST_SECTION=touch node tests/navigation-themes-sync.cjs`: passed for real touch period swipes, reverse navigation, vertical-scroll exclusion, internal week panning and explicit week-period buttons.
- `npm run test:e2e`: passed for creation/edit/persistence, invalid duration, zero-minute reminder, non-destructive ICS/holiday import, virtual search, focus restoration, PIN hashing/unlock/auto-lock, QR generation, concurrent tabs, deletion convergence, failed-write recovery, delayed camera cleanup, responsive controls, large agenda and offline service-worker reload. The final run measured the 10,000-event agenda transition at 55 ms with 131 DOM elements; this is one environment measurement, not a device-wide performance guarantee. Its draft-abandonment step now explicitly discards the unsaved form, matching the new safeguard.
- `CALENDAR_MODEL_FREE=true node_modules/.bin/vite build`, after the existing `node scripts/prepare-model-free.cjs`: passed, including PWA generation. This is a local, unpublished Web verification build using the project's existing explicit model-free variant.

Initial checks exposed missing Wllama dependencies and a sandbox IPC limitation. Declared dependencies were restored without modifying the manifest or lockfile. The ordinary `npm run build` prebuild attempted to fetch pinned model weights and could not use the sandbox proxy; the existing model-free build path above was used for UI verification instead. A trial unit run without process isolation was unsuitable for the repository's global test fixtures; the authoritative `npm test` result above uses its standard isolated execution.

## Limits and next parts

- No Android APK, Windows installer, Linux AppImage or release package was produced/published. Shared UI behavior was tested in Chromium, including emulated touch, rather than certified on physical Android/tablet devices or Windows/Linux application shells.
- Firefox, Safari, screen-reader operation and a comprehensive contrast audit have not been executed. Built-in/custom palette plumbing and visible keyboard focus were exercised; arbitrary user-chosen custom colors can still require contrast review.
- The existing floating-time model cannot select which repeated local hour a newly entered ambiguous floating timestamp belongs to. Events carrying explicit timezone/instant information render correctly; adding an explicit fold choice to the event editor would require a separately designed, compatible data/input change.
- Existing AI, security, QR, import/export and synchronization implementations were not redesigned. Their dedicated part-2/3/4 requirements remain pending. Existing modest navigation animation/reduced-motion behavior is retained; no new elaborate animation system was imposed.
- Part 2 should reuse the calendar primitives and semantic theme variables for the specified animations, palettes, icons and controls. Keep the presentation-derived occurrence instants out of persisted events and imports/exports.
- No currently changed path overlaps the inspected 1.4.2 commit. Before future integration, compare both branch tips again and perform a normal reviewed merge; no automatic merge is part of this work.
