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
