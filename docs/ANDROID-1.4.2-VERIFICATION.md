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
