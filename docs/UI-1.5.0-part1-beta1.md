# Calendar 1.5.0 — Part 1 — Beta 1

Historical preparation record. The [Android continuation](UI-1.5.0-part1-android-language.md) supersedes local-only publication instructions: the user now authorizes Pre-release publication, but only after proof of compatibility with the existing 1.4.2 signing key. That preflight is currently blocked; old test-key APKs must not be published as the compatible update.

Draft-only test candidate based on `e6e85d37f1c95cfd29c39bf913db910efde1433e`.

- Display name: **Calendar 1.5.0 — Cz. 1 — Beta 1**.
- Package version: `1.5.0-part1-beta1`; proposed local tag: `v1.5.0-part1-beta1`.
- Local source branch: `beta/1.5.0-part1-beta1`. The source branch and tag must not be pushed under the user's current authorization.
- Only a non-published GitHub Draft Release and its assets are authorized. The release body must identify the exact local source SHA. Preserve every existing release, especially any 1.4.2 draft.
- Builds use the existing explicit model-free distribution. Installed models are not changed; new installations use existing import/download functionality. This is not a new Qwen model or training release.
- Existing application IDs, user-data locations and signing configuration stay in place. Android uses the existing diagnostics test-build path, not a newly configured production signer. Installation compatibility depends on the existing certificate; never uninstall an existing calendar to resolve a signature error without first preserving its data.

## Scope

The candidate includes the part-1 month/week/day/year/agenda overhaul, shared calendar/editor components, keyboard navigation, accessibility/contrast improvements, responsive layouts, draft protection and the existing time-zone work. It adds beta/version/launcher/PWA metadata and a beta-tag auto-publication exclusion only. No features from parts 2–4.

## Build and verification

Before producing distribution artifacts, run TypeScript, the unit suite and available UI regressions. A temporary local Web build may be used as the regression-test prerequisite; package it only after checks pass.

```sh
npm run lint
npm test
node scripts/prepare-part1-beta.cjs
CALENDAR_MODEL_FREE=true node_modules/.bin/vite build
node tests/browser.cjs
node tests/ui-overhaul-browser.cjs
node tests/ui-audit-regressions.cjs
node tests/ui-accessibility-browser.cjs
```

Desktop packaging uses the existing Electron builder and pinned native runtime preparation with `CALENDAR_MODEL_FREE=true`, `--publish never` and a separate output directory. Android requires Java 21/SDK 36/build-tools 36 and the existing native-runtime prerequisites if native inference is enabled; the explicit model-free diagnostics path is `-PcalendarStableUpdate=true :app:assembleDiagnostics`. Runtime/hardware tests are separate from successful packaging. Do not substitute older artifacts for this candidate.

Artifacts, actual test/build logs, checksums and the final status report are saved under `release/part1-beta1/` (ignored by Git). A source Git bundle preserves local commits for independent reproduction without exposing a branch/tag in the public repository.

## Known limitations

- Explicit first/second repeated-hour selection in the editor is unfinished. Existing elapsed-time rendering, collision fixes and spring-gap guards are included.
- Accessibility is partly verified: automated keyboard/focus, sampled built-in contrast and responsive checks are not full screen-reader/WCAG/zoom certification.
- Physical-device/native-shell acceptance is distinct from builds and emulated tests. Report only tests actually performed.
- This weight-free test distribution does not certify inference with a new or downloaded model. Model functionality is retained, not retrained.
- Dynamic bar colors, larger desktop glyphs, the full animation/gesture system and parts 2–4 remain outside this candidate.
- A draft is not a stable release. Do not publish it, make it latest, push source refs, or replace tags without further authorization.
