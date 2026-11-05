# 1.5.0 Part 2 — work in progress

This branch continues Part 1 Beta 3 and is not ready for publication.

- `src/utils/builtinThemes.json` is the approved eight-by-thirteen palette table. The independent `tests/builtin-themes-part2.test.ts` checks its values and ordering.
- Existing custom palettes and legacy theme identifiers remain available. The editor supports direct HEX input and a color picker, previews, restoring the starting colors and confirmed deletion.
- PIN and password verification use salted PBKDF2-SHA-256. Existing four-digit PINs migrate. The screen lock does not encrypt app data; the attempt limit is local to app storage.
- Android biometric authentication is optional, explicitly enrolled after verifying the existing app credential and authenticating with Android; PIN or password remains available. Only Android 11/API 30 and newer with a strong enrolled biometric are supported. Native biometric behavior, cancellation and fallback still require testing on a real device or emulator.
- Animation levels, speed, switches and post-authentication PIN feedback have initial implementation. Further work is required to cover closing dialogs and expanding panels consistently and to verify all visual states across themes and text scales.
- Android system-bar colors are best effort; OS versions with enforced edge-to-edge presentation may ignore them.

Before release, complete and verify the remaining animation and theme coverage, validate actual system biometric behavior including cancellation and unavailable hardware, rerun full regression and upgrade checks, and build/verify an update-signed APK. Do not publish an incomplete beta.
