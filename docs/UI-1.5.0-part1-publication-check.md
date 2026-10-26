# UI part 1 — publication preflight and remaining work

Date: 2026-10-26. This records the user's authorization to publish the completed first part **as a development branch only**. It does not authorize a release, deployment, merge to `main`, version bump or implementation of the next part.

## Reviewed implementation and isolation

The complete diff of `cb1f24363b3f8685d4e45ada9d91a45543702e85` was reviewed across all **22 changed files**: calendar composition/views, shared cards/dialogs/navigation/styles, presentation helpers, the compatible occurrence-display fix, tests and the implementation report. The review covered both added and removed code. `git diff --check cb1f243^ cb1f243` passed. The worktree and index were clean at the start of publication work.

| Check | Verified result before publication |
| --- | --- |
| Local work branch | `dev/1.5.0-ui-part1`, initially at `cb1f24363b3f8685d4e45ada9d91a45543702e85` |
| Exact implementation parent | `ded3bdc5de00205987a0918b67145a96dc1c140f` |
| Remote stable tag `v1.4.1` | `ded3bdc5de00205987a0918b67145a96dc1c140f`, exactly the implementation parent |
| Remote `main` | `ded3bdc5de00205987a0918b67145a96dc1c140f` |
| Remote Qwen branch | `dev/1.4.2-qwen35-finetune` at `65c40c2145f502bfdd86198dc7520e8aefe26a7e` |
| Remote UI branch before first push | Not present |
| UI paths overlapping the 1.4.2 commit's 37 changed paths | **None** |
| 1.4.2 commit in UI ancestry | **No** |
| Application version | **1.4.1**, unchanged |

The pinned 1.4.2 commit was fetched only into the local object database, without writing `FETCH_HEAD`, updating a branch, merging it or adding it to UI ancestry. Its changed-path list was compared to the UI commit's changed-path list. Objects present locally are not changes included in the UI branch.

The implementation diff against stable 1.4.1 is empty for `training/`, `scripts/`, `public/models/`, `native/`, `android/`, `electron/`, `.github/`, `package.json`, `bun.lock`, `src/types.ts`, the pinned model manifest, model registry, model assistant, assistant prompts and fine-tuned-model configuration. No dataset, training pipeline, Qwen model configuration/weights, persisted event schema, app identifier or signing configuration is being published as part of the UI change.

Only this document and its retained test-result excerpts are added after `cb1f243`; the implementation commit is preserved unchanged. The publication tip is therefore a documentation-only child of the reviewed implementation. The authorized operation is an ordinary push of the explicit refspec `refs/heads/dev/1.5.0-ui-part1:refs/heads/dev/1.5.0-ui-part1`. Post-push checks compare the local and remote tip, verify remote file availability, and recheck `main`, the stable tag and the 1.4.2 branch. No force option, merge, release or version change is part of this procedure.

## Test report

The detailed implementation report is [UI-1.5.0-part1.md](UI-1.5.0-part1.md). Retained result excerpts and full-local-log checksums are in [ui-part1-test-results.txt](verification/ui-part1-test-results.txt).

| Executed check | Result |
| --- | --- |
| TypeScript: `npm run lint` | Passed |
| Standard isolated unit suite: `npm test` | **148 passed, 0 failed**, including ten new layout/date cases |
| UI overhaul Chromium suite | Passed: 4/5/6-row month, selection/reset, original event identity, time geometry, overlaps, year boundary, agenda, drafts, DST, live zone change and touch |
| Eight responsive viewport sizes | Passed at 320×568 through 2560×1440, including landscape |
| Mobile navigation in EN/PL/RU/DE | Passed; all views, dialog actions, date-heading bounds and header-height checks |
| Desktop keyboard/custom-theme suite | Passed |
| Touch navigation suite | Passed; period swipes, internal week panning, reverse/vertical gestures and accidental-click exclusion |
| Existing browser regression suite | Passed: CRUD, persistence, import, PIN/auto-lock, QR, concurrent tabs, deletion sync, write failure, camera cleanup and offline reload |
| 10,000-event agenda | Passed; final regression run reported 55 ms and 131 DOM elements. This is one test-environment measurement |
| Existing explicit model-free Web/PWA build | Passed; no release artifact was published |

These are actually executed implementation-phase checks, whose available logs were inspected again before publication. No application/test code changed during publication work, so previously passing tests were not rerun for the documentation-only addition. The ordinary bundled-model prebuild was not a successful build: it attempted a model download that was blocked by the sandbox proxy. The successful Web verification build used the existing explicit model-free path; it does not certify bundled inference.

Native Android, Windows and Linux packages, physical phone/tablet operation, Firefox/Safari, screen-reader interaction and a full contrast audit remain **unverified**. Basic visible focus, nested dialog focus handling, keyboard day selection, theme persistence and emulated touch were tested; these do not constitute full accessibility or platform certification.

## Planned 1.5.0 features still pending

The detailed specifications for parts 2–4 have not been supplied. The entries below separate existing/part-1 behavior from unfinished work; they do not invent requirements or implement the next part.

| Area | Present at the end of part 1 | Still to implement or verify |
| --- | --- | --- |
| Dynamic top/bottom bar colors | Both app bars inherit the current semantic `theme-header` palette; custom themes persist. Some action icons still use their existing fixed semantic color classes | Dedicated dynamic/per-bar color behavior and its final rules, contrast/transition policy and native system-bar appearance. Theme inheritance alone is not the requested complete feature |
| Larger desktop icons | Header glyphs remain primarily **18/20 px**; some button hit areas were enlarged | A desktop-specific icon-size/spacing system and validation at DPI/scaling levels. Larger hit targets are not larger glyphs |
| Interface animations | Existing short period transition (160 ms), basic CSS feedback and reduced-motion support remain | The specified animation system for view changes, bars, dialogs and other UI states, including interruption, focus/scroll retention, reduced-motion behavior and performance checks. No new comprehensive animation system was delivered |
| Gestures and navigation shortcuts | Period arrows, Today, view selectors, date context, Left/Right and A/D shortcuts with editing/dialog exclusions; period swipes in month/day/year/agenda; the week timeline pans internally and uses period buttons/keys for changing weeks | The later specification's full gesture/shortcut map, any configurable bindings and platform-specific behavior, discoverability and native-device verification. The current subset is implemented/tested; it is not evidence that the entire future navigation specification is complete |
| Calendar keyboard accessibility | Focus styles, real buttons, selected/current-date labels and dialog focus traps are available | Cell-to-cell arrow navigation/roving focus is not implemented; current global Left/Right shortcuts change periods. Review tab-order length in the year grid, accessible counts/announcements, zoom/text scaling, screen readers and target sizes/contrast, especially dense month strips |
| Clock changes and timezone input | Actual 23/25-hour axes, repeated-hour offset labels, elapsed-duration layout, zoned occurrences and timezone-aware cache invalidation; half-hour transitions covered by unit tests | The editor cannot explicitly choose the first/second occurrence of an ambiguous local time, including **floating** timestamps and named-zone wall times without an offset/fold choice. UTC source timestamps can distinguish those instants. Choosing the second repeated hour from a time slot is also not supported by the existing date/hour creation callback. Spring-gap/nonexistent-time input policy, broader zone/history coverage, native resume/system-zone changes and device validation still need separate design/testing |
| Theme personalization | Existing seven built-in themes and thirteen semantic customization slots remain; new calendar components consume those variables | Final palette/animation/bar behavior and other detailed customization requirements from the next part. No replacement theme engine was implemented |
| Later settings/security/QR/stability requirements | Existing implementations preserved; relevant regression tests passed | Implement only the forthcoming, explicitly supplied specifications. Current regression results do not mean those later planned changes are already done |

No further application behavior was changed in response to this publication request. The unresolved floating-time distinctions must be addressed compatibly and must not cause destructive migrations or loss of existing events. Any later integration with 1.4.2 must compare both current branch tips again; this task performs no merge.
