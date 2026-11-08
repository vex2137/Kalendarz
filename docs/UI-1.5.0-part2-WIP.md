# 1.5.0 Part 2 — work in progress

This branch continues Part 1 Beta 3. Publication remains conditional on final packaging and regression verification.

- `src/utils/builtinThemes.json` is the approved eight-by-thirteen palette table. The independent `tests/builtin-themes-part2.test.ts` checks its values and ordering.
- Existing custom palettes and legacy theme identifiers remain available. The editor supports direct HEX input and a color picker, previews, restoring the starting colors and confirmed deletion.
- PIN and password verification use salted PBKDF2-SHA-256. Existing four-digit PINs migrate. The screen lock does not encrypt app data; the attempt limit is local to app storage.
- Android biometric authentication is optional, explicitly enrolled after verifying the existing app credential and authenticating with Android; PIN or password remains available. Only Android 11/API 30 and newer with a strong enrolled biometric are supported. Native biometric behavior, cancellation and fallback still require testing on a real device or emulator.
- Animation levels, speed, switches and post-authentication PIN feedback are integrated. Main dialogs and AI panels animate on exit; native details animate where supported, with an immediate fallback on older engines. Exit animations are cancelled when the owner changes, including locking the app.
- The month view uses compact per-week heights based on occupied event lanes, capped at three desktop/two mobile lanes, with accessible overflow. It uses theme tokens and honors reduced motion and disabled animations.
- Android system-bar colors are best effort; OS versions with enforced edge-to-edge presentation may ignore them.

Before release, run final regression and upgrade checks, then build and verify update-signed Android and Linux packages from the same source commit. Real Android biometric behavior, system bar rendering and actual device upgrades must be explicitly marked as pending device tests. Do not publish if packaging or critical regression checks fail.

## Finalization checkpoint: ed7f5ef

- Added compact, content-sized month weeks with capped lanes/overflow; tested empty/single/busy weeks, multi-day spans, add/delete, navigation, three viewport/text-scale combinations and all eight themes.
- Main dialog and AI history/settings exits respect speed and cancellation; native details have progressive expansion animation. Stale authentication callbacks are ignored after unmount and native biometric prompts are cancelled on activity destruction.
- Passed TypeScript, 167 unit tests, 14 Python release-guard tests, 19 Android JVM tests, full browser regression, same-origin Beta 3 upgrade, theme, PIN/password, simulated biometric, AI settings/history, dialog interruption and responsive navigation tests.
- Source commit ed7f5ef is pushed. Its web CI passed. Desktop CI failed: https://github.com/vex2137/Kalendarz/actions/runs/42060969412/job/127362233967
- Failure: tests/electron.cjs:98 timed out clicking disabled #btn-send-ai-message after closing AI settings. The cause is unresolved; do not weaken the assertion or publish the candidates until resolved and the complete desktop test passes.
- A signed model-free APK (10508, 1.5.0-part2-beta.1) was generated from ed7f5ef; certificate matches the existing update identity. Candidate SHA-256: 27e63884516c389cc4b2da7dcb35779117ea5c700644a9ce2c18eba7e4840076 (24020322 bytes).
- An x86_64 AppImage was generated from the same source using explicit model-free packaging and publish-never configuration. It was extracted and run under Xvfb: five views, eight themes, event creation/reload and shutdown passed. Its native bridge exists, but this local smoke test did not execute a model. Candidate SHA-256: babe58b38704975786546c26d1bfd8757a87bef92d57bea58c574472b2ad0cac (164961662 bytes).
- Candidate files are in this worktree's ignored release/ directory. No release/tag or public candidate upload was created. Real biometric/device upgrade testing remains pending on POCO.

## Composer fix and verified replacement candidates: 555d8b3

The packaged-desktop failure was reproduced under Electron: the hidden/inert composer still exposed an enabled field during panel exit. Automated fill produced no input event, leaving both DOM and React draft empty. The composer and send button now remain explicitly disabled while settings/history own focus. The original desktop send test remains, with stronger disabled/value assertions. Reproduction passed four times after rebuilding; both source-commit GitHub Actions runs passed web and full desktop checks (including actual GGUF execution).

Replacement candidates supersede the ed7f5ef files. Both were built from clean source 555d8b3649a32efa2ce9c0ac845a4b458ec9a00f. Android identity/signature/alignment and archive checks passed; AppImage provenance and absence of bundled weights were verified, then the extracted AppImage passed Xvfb UI/persistence/shutdown smoke checks. Unit tests: 167; release guards: 14; Android JVM: 19. TypeScript and the full browser suite passed. Real POCO biometric and update-install tests remain pending.

- APK: 24313597 bytes; SHA-256 0a059435240e99b45b2aa48b3e89c097f3eff5699d8eea3ae57aa358d019bc5d
- AppImage: 164961589 bytes; SHA-256 3f350fb4815fe39cf14988466bd792890006e12105af48733090a30ac9c4932c

Release publication verifies the existing files again and downloads the draft attachments to check hashes before marking the Pre-release public. PR #20 stays unmerged; stable Latest must remain v1.4.2.
