# 1.4.2 implementation verification — 2026-10-26

Implemented against `dev/1.4.2-qwen35-finetune` at
`65c40c2145f502bfdd86198dc7520e8aefe26a7e`, fetched from GitHub. That commit
still had package version 1.4.1 and the public base Qwen manifest. The user's
uncommitted local command/evaluation edits, v2 dataset, trained weights and phone
were unavailable in this remote workspace. They were not reset, replaced or
uploaded. No signing secrets were changed or printed.

## Executed successfully

| Check | Actual result |
| --- | --- |
| `bun install --frozen-lockfile` | Installed missing pinned dependencies without changing the lockfile |
| `npm run lint` | TypeScript passed |
| `npm test` | 145 tests passed, including assistant commands, migrations, chat/event persistence, model selection and bundled installation without weight downloads |
| `npm run test:native` | 25 tests passed; host storage/backend control tests, not Android inference |
| `python3 -m unittest discover -s tests -p test_release_v142.py` | 10 tests passed: identity/certificate guards, synthetic APK tampering, private depot restrictions, model preparation and mocked ADB checks |
| `actionlint` 1.7.7 | Both modified workflows passed |
| Explicit model-free Vite production build | Passed; this build contains no GGUF and is not the target release |
| `npx --no-install cap sync android` | Passed with the model-free frontend |
| `:app:testDiagnosticsUnitTest -PcalendarStableUpdate=true` | Android Java/Kotlin compilation and 12 JVM tests passed using Java 21 and SDK 36; model-free control variant |
| `:app:assembleDiagnostics -PcalendarQwenV2Update=true` without signing material | Correctly rejected before assembly |
| Same Qwen v2 assembly with a temporary valid private key of a different certificate | Correctly rejected before assembly; fixture keystore removed |
| `node scripts/prepare-model.cjs` without private weights | Correctly refused to build; did not download a substitute |
| `npm run test:e2e` | Passed create/edit/persist, imports, locking, concurrency, responsive controls, 10k-event agenda and offline/IndexedDB regressions |
| `node tests/model-actions-browser.cjs` | Passed model actions, download errors, streamed Android-picker proxy imports and source preservation |
| `node tests/diagnostics-actions-browser.cjs` | Passed injected native bridge/diagnostic UI control paths |
| `node tests/gguf-import-browser.cjs` | Passed metadata/hash/import/restart tests with synthetic GGUF fixtures |
| `git diff --check`, Python syntax compilation | Passed |

The new model ID is included in the Android identity test. JVM compilation used
the existing model-free variant because the new release variant intentionally
requires the real update key and actual private model. Negative signing tests
exercised the new Gradle path directly. Synthetic GGUF/ELF files and mocked ADB
calls test rejection/control flow; they do not represent actual model execution
or a phone installation.

Initial checks exposed missing workspace dependencies, a Gradle expression
parsing issue and test fixture expectations. These were corrected before the
successful checks above. The host's default Java runtime lacked a compiler;
Android tests used the available complete Java 21 JDK.

## Not executed / not generated

- No real Qwen v2 GGUF was available, so its reported hash was pinned but not
  measured against the user's actual file in this session.
- No NDK/CMake native ARM64 build or real Qwen v2 inference was run here.
- No existing release signing key was available here. Its real certificate and
  a completed APK signature were not verified in this session.
- The private depot transfer and full GitHub Actions build were not run.
- No target signed APK or download link was generated. No substitute APK is
  presented as a release.
- No phone was connected: ADB installation, retained device data, native engine
  startup and offline Polish/English responses still need device verification.
- The full public desktop packaging/inference workflow was not run locally.

See [the release instructions](ANDROID-1.4.2-QWEN-V2.md) for private model
delivery, default-branch workflow registration, signed CI assembly and verified
`adb install -r`. The old 1.4.1 signing workflow, certificate checks and init
script are unchanged.

## Final integration review

The private depot upload was tightened to use the validated numeric release ID
for the upload itself, with a fresh privacy/draft check before each file and
checks on the returned asset receipt. This avoids resolving a tag to a different
release. Two additional offline tests cover the exact upload destination,
receipt tampering and a privacy change before sending; the release suite now
passes **12 tests**. No real private transfer was performed.

The fish setup instructions now stop before upload on any preceding error and
check private visibility explicitly. They run from the home directory and only
read the original GGUF, leaving the training worktree unchanged. Signing and
model-selection logic did not need further changes after review. Real signing,
private transfer and device inference still require the release inputs.

## Recovered key and actual native build

The matching original diagnostics key was found in the retained Android cache.
A private-key challenge matched certificate
`ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`.
An independent PKCS12 backup was rewrapped with a strong new container password,
and its identity/proof were verified again without changing the original file.
No key/password value was printed or committed. The production key
`b6b7bc0499ab59af54404a90aaa785e3d40f2738e83fdf9e6306f8e210c79a01`
was preserved. Future CI uses four separate `CALENDAR_ANDROID_UPDATE_*` secrets.
The setup helper passed an actual-key dry run and mocked checks that only those
four names can be written; a wrong identity made no writes. No real signing
secrets were changed by the agent.

The real private GGUF was downloaded from the private depot and its full size
and SHA-256 verified. The existing real-model CPU smoke test passed loading,
structured Polish extraction, warm cache, unload/reload and cancellation.
An additional English extraction and English greeting were correct. A narrow
Polish greeting assertion failed: the reply was Polish but did not contain the
expected greeting. These samples do not establish complete model quality or
Android device behavior; raw model errors remain possible.

The actual Android ARM64 CPU/Vulkan engine was compiled with the pinned
NDK 29.0.14206865 and CMake 3.31.6. The resulting 30199952-byte ARM64 ELF has
SHA-256 `e71d0e57a398c5dc0f158f04162388847e5cba82112a89de2c9cfb375dc0bd5b`
and the pinned llama.cpp commit. No phone installation/execution occurred.
At this checkpoint, final APK assembly still awaits the exact pinned model
license file in the remote workspace; the license checksum was not relaxed.

## Completed signed APK build

The exact pinned license was supplied and verified. The guarded local build in
the managed remote environment completed successfully from source commit
`a9b8479db8d9e857d66c072153cab4e1340016d5`. It used the recovered diagnostics key, without changing
GitHub signing secrets and without installing on a phone.

- Package: `com.kalendarz.offline.diagnostics`; version `1.4.2`; code `10407`.
- APK size: `553308518` bytes.
- APK SHA-256: `cb872003e95078c489579070164cb732fb9c802ed8737e64389dfcf284f71c02`.
- Certificate SHA-256: `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`.
- The actual APK passed `apksigner`, metadata/provenance checks, GGUF/license
  byte verification, exactly-one-GGUF checks, native engine provenance and
  16 KiB ZIP alignment.
- The ARM64 ELF LOAD segments have 16 KiB alignment (`0x4000`).
- The diagnostics JVM test task passed with 12 tests, zero failures/errors/skips;
  Gradle reused the cached test results. The build completed 99 tasks, with
  60 executed and 39 from cache.

This was a local build in the managed environment, not a completed Actions
release run. The attempted private GitHub release upload was rejected with
HTTP 401; the verified APK and checksum remain available in the task's private
workspace for the owner to download. No APK or weights were published publicly.
Future Actions signing needs the separate update-specific secrets configured
by the owner; the existing production signing secrets were preserved.
Phone installation, retained device data and actual POCO inference still need
explicitly authorized device testing.
