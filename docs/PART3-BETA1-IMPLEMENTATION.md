# Part 3 Beta 1 implementation and validation map

Base: accepted Part 2 Stable `ab9371c6a03d2878536f85fa8a9e6bf7db89fd2b`.
Branch: `feat/1.5.0-part3`. Part 2 PR #20 stays Draft; no merge or Release.

## Implemented

- Optional desktop sidebar: mini month, upcoming recurring events, 220–360px
  resize with mouse/keyboard, durable preference; hidden automatically below
  1200px. Its toggle shares the existing header instead of taking another row.
- Desktop assistant: centered 920px window bounded by the viewport, mouse header
  dragging, resize clamping; existing full-screen mobile layout, native bridges,
  streaming, Stop, history and model controls remain shared and unchanged.
- Copy controls: 14px SVG / 20px visual feedback, 28px fine-pointer control;
  coarse pointers retain a transparent 44px target without enlarging the icon.
- One configurable shortcut map in existing settings: 13 actions / 14 defaults.
  `1–5` year/month/week/day/agenda, `S` context settings, `A` assistant, `Q` and
  `/` one search action, `U` actual update check, `I/E` data options, `T` today,
  `D` create. Arrow navigation stays; old A/D navigation is replaced as requested.
  Capture supports modifiers, multiple bindings, disabling, individual/all reset,
  conflict detection, reserved shortcuts, persistence and editing/IME guards.
- Nine settings categories with desktop cards/sidebar and mobile category pages,
  option/label/category search, direct navigation, last-category persistence,
  native Back hierarchy and existing Escape/focus trap behavior. Existing controls
  were moved, not reimplemented. Preference errors appear inside the dialog.
  Appearance/motion resets preserve custom themes and other data; shortcut edits
  require explicit save. Existing credential authorization remains intact.
- Existing gzip and PBKDF2-600000/AES-256-GCM remain unchanged. New KAL4P QR
  transport adds per-export session IDs, checksums binding each part to its
  metadata, duplicate/missing progress and explicit rejection/reset of foreign
  sessions. 800 encoded characters per part; at most 256 parts / 10-minute scan
  session. Larger text/file export remains available. New QR needs a new reader;
  KAL2/KAL3 text codes remain compatible with Part 2. Legacy QR/JSON import stays.
- Encrypted input is authenticated/decrypted before preview; all import variants
  show counts/range/duplicate IDs before explicit confirmation. Calendar writes
  use the existing atomic transaction. A shared-theme preference is preflighted
  and compensated if the transaction fails; localStorage and IndexedDB do not
  constitute a crash-atomic distributed transaction.
- Text export now renders the actual copyable code. Unchanged tombstones retain
  identity on calendar focus refresh, avoiding accidental generation/output reset.
  Real data changes invalidate stale output with an explanation. Errors persist
  visibly and retry does not pretend success.

## Validation

Local unit baseline: 247 passing cases, plus the new preference-persistence/quota
case passing separately. TypeScript passes. Four new release-policy boundary
cases pass; 57 historical Python policy cases passed in the combined run (one
new fixture's wrong version-string replacement was corrected and rerun).

Browser checks passed: Part 3 desktop/keyboard/settings/copy/text-code/quota/reset,
native Back and focus-refresh scenarios; Part 3 QR reverse/duplicate/missing/
damaged/foreign parts, cancellation/no writes, decrypt-preview-confirm ordering,
exact fields, generation failure/retry; actual encrypted/plain QR image scans and
JSON round trips; Beta 7 streaming/partial Stop/history/native-boundary fixtures;
all Part 2 theme/PIN/password/biometric/motion/month scenarios. Native boundaries
are simulated in relevant browser tests, never evidence of physical GPU behavior.

The private workflow repeats the final integrated checks, actual accepted Part 2
same-origin upgrade, Android JVM/device-test compilation, both packages from one
live SHA, actual packaged Electron CPU inference and download/hash verification.
Final run results and immutable artifact URLs belong in the PR/task report so a
post-build documentation commit cannot silently change the expected source HEAD.

## Delivery and limits

Candidate: `1.5.0-part3-beta.1`, versionCode 10520 (> Part 2 Stable 10519).
Android package/certificate unchanged. New explicit Part 3 guard/profile does not
weaken historical Part 2/1.4.2 checks. Signing uses the same audited one-use private
runner exchange. Neither package contains GGUF, keys or signing credentials.
CPU/CUDA/Vulkan engine pins and native source code are unchanged.

Physical POCO installation, clipboard/keyboard/camera/biometric and background GPU
checks remain manual. CachyOS NVIDIA offload/desktop existing-profile verification
remains manual; no local NVIDIA device is present. No Windows runner is available
locally. Web browser fixtures are not a substitute for those platform tests.

No public Release, stable 1.5.0, tag overwrite, PR merge or Part 4 work is authorized
by this implementation. Private artifacts are test candidates, not final 1.5.0.
