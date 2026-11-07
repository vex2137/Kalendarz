# Beta 2 repair candidate verification

Application source: `a2a8fd730dc7cf942a38e2a85fbb409f04549885`. PR #20 stays Draft/unmerged; no official Beta 2 tag or Release.

## Completed validation

- TypeScript and 190 unit tests: pass.
- Android diagnostics build, 41 JVM tests and instrumentation APK compilation: pass.
- Android 16 CI: all four required SAF/native-service instrumentation tests executed and passed (verification step requires each named test).
- 28 Node native tests and 14 release guards: pass.
- Browser regressions: streamed import/provider failures, model status and safe legacy receipts, biometric auto/cancel/retry/PIN, real navigation during downloads, native rejoin simulation: pass.
- Real localhost HTTP + transactional/worker OPFS: Range/ETag validators, 200/206/416/503, interruption/checkpoint/restart, quota, checksum, installed-model protection and exclusive locking: pass. Initial local run was interrupted by Vite navigation while building; rerun with HMR disabled passed.
- Actual AppImage extracted and launched under Xvfb: event creation/persistence after reload, native bridge and clean shutdown passed. All 144 packaged CPU/Vulkan/CUDA runtime hashes match; no GGUF bundled. This is not physical GPU inference.
- APK signature, package/version, 16 KiB zip alignment, clean source provenance and pinned ELF64/AArch64 runtime checked.

Source CI (both successful):
- https://github.com/vex2137/Kalendarz/actions/runs/42177311104 (push, includes Android 16)
- https://github.com/vex2137/Kalendarz/actions/runs/42177317523 (PR, web/desktop)
- Native reports: https://github.com/vex2137/Kalendarz/actions/runs/42177311104/artifacts/13483847861

## Verified package bytes

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| Kalendarz-1.5.0-Part-2-Beta-2-repair1-x86_64.AppImage | 935374142 | `d3a372db6d377e3f4d9eaa78232a67e8406c45ae3415faa8245ebbfd12315dd9` |
| Kalendarz-1.5.0-Part-2-Beta-2-repair1.apk | 24048951 | `b54ef7a9629499790435d305693a5e0448556c71efd727bc8cae2ed7ac2c88bf` |

APK retains `com.kalendarz.offline.diagnostics`, versionCode 10510 and certificate `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`. Both installers come from the same clean source commit. Manual-artifact verification/upload performs no build, signing or Release publication.

## Remaining acceptance

POCO: actual system picker/provider and large local file, update data preservation, biometric hardware/prompt lifecycle, locked-screen/background/vendor battery behavior, actual Mali Vulkan inference and CPU fallback. RTX 4060: actual CUDA offload/layers, tok/s, TTFT and Auto fallback. Public Vex909 GGUF exact bytes/checksum/access and inference remain unverified because Cloud excludes Hugging Face. See PART2-BETA2-MANUAL-TESTS.md and the linked detailed procedures.

Cloud cannot retrieve Actions log/archive redirects at excluded storage hosts; GitHub status and required-test verifier confirm successful CI. No network-policy bypass was attempted.
