# Kalendarz v1.5.0 Stable — preparation and approval

The final candidate is built from the current exact feat/1.5.0-part4 SHA by the
private `.github/workflows/build-stable-150.yml` workflow. Its new explicit stable
profile does not alter historical Part 1–4 policies. It produces Android ARM64,
Linux x86_64 AppImage/Flatpak, Windows x64 Setup/Portable/application ZIP and Web/PWA.
Every package reports the same clean application source and stable channel.

Android versionName is 1.5.0 and versionCode is 10526, newer than the accepted
10525 lifecycle build. Application ID remains com.kalendarz.offline.diagnostics;
certificate SHA-256 remains
ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143.
Stable rejects debug signing, conflicting beta flags and debuggable/test-only APKs.
CPU/Vulkan executables are reused byte-for-byte from the accepted lifecycle APK;
the independent tiny hardware probe is rebuilt using the existing verified toolchain.

The workflow uses the original signing secrets where available, otherwise the
existing run/source/workflow-bound encrypted handoff. The permanent key is never
stored in the source tree, public logs, deliverables or a permanent new secret.
Only the new exact private workflow path is added to the trust allowlist.

A single final validation job runs unit/type/native/browser/data-upgrade regressions
before distributable builds. Dedicated package jobs exercise actual desktop packages,
retain evidence and verify every uploaded package by re-downloading it. Flatpak is
assembled from the successful same-run AppImage payload with an explicit source/hash
check. No large GGUF is downloaded or packaged; unchanged AI/runtime code is checked
against 13cf46a and prior real model evidence is referenced with its limits.

The final private draft contains STABLE-1.5.0-INDEX.json, SHA256SUMS.txt, English
release notes, verification results and the development archive index. It also
includes the current cache-safe KDE integration helper and original adaptive icon.
Existing application data profiles and all original historical packages are retained.
See [release notes](../.github/release-notes/v1.5.0.md) and
[historical archive](DEVELOPMENT-ARCHIVE-1.5.0.md).

## Approval boundary

Preparation may push reviewed source changes to the existing development branch,
execute private workflows and create an unpublished private draft. It must not merge
PR #22, push public v1.5.0, publish a public release, change public historical release
metadata or replace public Latest (currently 1.4.2). After owner approval, publish
only the verified source/files; a new or changed source requires renewed validation.
No stable publication is authorized merely by a successful build.

## Hardware and environment limits

Physical Stable POCO installation/background generation/biometrics, physical GPU
offload, real OS file portals and installed-PWA refresh are NOT TESTED unless the
final evidence explicitly records them. Earlier user acceptance applies only to
unchanged implementations. The separate Plasma 6 panel test was BLOCKED by Ubuntu
repository DNS failure; the standalone integration tests passed, and Calendar-only
unpin/re-pin is documented. Windows remains unsigned with Authenticode. Original
private Part 2/3 Actions archives keep their existing December 2026 retention limits.
