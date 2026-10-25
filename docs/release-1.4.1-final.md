# KALENDARZ 1.4.1 — stable finalization

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. Release finalization commit: `dbac195`. The maintainer explicitly accepted the core application after physical POCO X7 Pro testing and approved finalizing stable 1.4.1 with CPU fallback. Android Vulkan compatibility is a 1.4.2 follow-up, not a gate for this release. Historical reports retain their original test results; this decision supersedes their earlier proposed GPU gate.

No new application features or refactors were added. The only build change raises the final Android update code to **10406**. The application/package version and launcher label are **1.4.1 / KALENDARZ 1.4.1**, without beta. The later native GPU diagnostics are included. Existing CPU/GPU backends, import/download code, data schemas, settings, models and history remain unchanged.

## Final files

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `release/KALENDARZ-1.4.1-ANDROID.apk` | 24,005,277 | `d187778c9185af75dfc8c61d8436fe1412e8f0c5c6f85a2cbc5abe8e633a5c89` |
| `release/KALENDARZ-1.4.1-linux-x86_64.AppImage` | 165,035,840 | `1dd853fc8e64d62337ad0dcee7119a34d7c07b969d8c979ce8f0f01a0564d7ad` |

Checksums: `release/KALENDARZ-1.4.1-SHA256SUMS.txt`, plus individual `.sha256` files. Machine-readable package metadata: `release/KALENDARZ-1.4.1-final-packages.json`.

Android was built from clean commit `dbac195` with model-free assets and the existing native ARM64 runtime. `apksigner` passes and its certificate matches 10405 (and the existing Beta line). Application ID remains `com.kalendarz.offline.diagnostics`; versionCode 10406 is greater than 10405. The native engine binary is unchanged. `zipalign -c -P 16 4` passes. Install over the existing Beta/diagnostic installation without uninstalling or clearing data. This preserves that install identity; it is not an update to the separately signed official 1.4.0 production application. The prior 10404 artifact was retained in `release/archive/` before replacing the requested final filename.

Linux reuses the valid AppImage from application commit `641f00e`. Subsequent functional changes concern the Android diagnostic wrapper; no Linux backend change requires a rebuild. Its unchanged SHA-256, executable permission, ELF64 x86_64/type-2 header, SquashFS magic/bounds and actual AppImage startup were verified again. Native CPU/Vulkan resources are retained. The finalization did not rebuild a correct 165 MB package unnecessarily.

Both packages intentionally exclude weights. Installed GGUF files are retained; new installations download or import a model. No weights, user data, signing keys or binary packages were added to Git.

## Short final regressions

All **seven requested categories passed** through six integration scenarios, with no outstanding test failures:

| Requested category | Result and actual scope |
| --- | --- |
| Startup | Actual AppImage execution with `APPIMAGE_EXTRACT_AND_RUN=1`; packaged Electron/file-origin startup and event persistence passed. |
| GGUF import/download | Actual 229,312,224-byte LFM2.5 350M Q4_K_M, real local HTTP 302 → 200, OPFS write/hash, reuse with exactly one download; catalogue import and content-addressed out-of-catalogue import/restart passed. Picker/network/error cases use boundary fault injection. |
| CPU generation | Actual native cold/warm model execution in the AppImage, including real token/cache assertions with HTTP blocked. The full-file browser scenario also generated actual WASM CPU tokens. |
| Processing modes | Production mouse/emulated-touch mode/layer selection, storage/restart, interruption/rollback and unavailable-GPU errors passed with injected native boundaries. The packaged CPU choice also passed. |
| JSON export | Real browser JSON dispatch plus Android proxy save/cancel/write-error/missing-bridge outcomes passed. Retained native GPU detail is present in JSON. |
| Memory release | Unload, already-unloaded result, stop error/retry and prevention of immediate preload passed with injected native boundaries. |
| Update/data retention | Actual Beta 3 APK Web assets → final 1.4.1 at the same origin, followed by restart, preserved recurrence/reminders, events, language/theme/settings, AI history, model identity, CPU selection and OPFS bytes. Android package ID/certificate/code checks passed separately. |

Scenarios executed: `diagnostics-actions-browser.cjs`, `backend-mode-browser.cjs`, `model-actions-browser.cjs`, `upgrade-141-browser.cjs` using recovered Beta 3 assets, `model-real-transfer-browser.cjs`, and `electron.cjs` against the actual requested AppImage. Android frontend/cap sync/Gradle `assembleDiagnostics` completed successfully. No critical compilation error needed a fix. The full unit suite was not redundantly rerun for a versionCode/documentation-only change.

Real model: LFM2.5 350M Q4_K_M, SHA-256 `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`. The out-of-catalogue variant changes only its metadata name, not tensor weights or architecture. This does not establish a second architecture. Live Hugging Face downloads remain inaccessible from this environment; the maintainer's successful physical downloads are separate acceptance evidence.

No new physical Android installation or GPU execution was possible here. The user's POCO acceptance applies to the previously tested core behavior; the exact 10406 package has metadata/signature/browser regressions, not a claimed new physical-device test. Neither hardware GPU success nor CI success is inferred from local tests. GPU limitations do not block this finalization under the user's explicit instruction.

## Known limitations / 1.4.2

See `known-limitations-1.4.1.md` for the short list. Android Vulkan initialization, actual driver/feature compatibility, GPU memory/offload tuning and physical CPU/GPU comparisons are deferred. Auto keeps deterministic cleanup/CPU fallback, GPU-only reports errors, and diagnostics state the actual backend. No GPU backend was removed. Linux CUDA is optional and absent from this AppImage; CPU/Vulkan remain. Physical CachyOS/RTX 4060 validation is still unclaimed.

## Delivery and proposed draft

No direct binary attachment/export transport is available in this session. Local paths and previously failed sandbox links are not represented as downloadable artifacts. No file has been uploaded and no working remote download URL exists yet.

Proposed next step, requiring the user's approval: create or safely reuse an unpublished **GitHub Release draft** titled **KALENDARZ 1.4.1**, proposed tag `v1.4.1`, in `vex2137/Kalendarz`, with exactly the two final files and `KALENDARZ-1.4.1-SHA256SUMS.txt`. Keep `draft=true`, `prerelease=false`; do not push code, overwrite existing assets, merge or publish. Record both actual build commits in its notes. The draft is download staging for an authenticated owner/collaborator; source/tag alignment and public publication remain separate actions. No draft/tag/asset mutation has been performed.

The read-only GitHub connector successfully returned the repository's releases (through v1.4.0; no 1.4.1 returned). It has no release-create/asset-upload operation. The installed CLI is a potential upload route, but **`gh auth status` reports the current `GH_TOKEN` invalid**. No repeated authentication attempts or external writes were made. Approval does not repair this technical block: working upload authentication is also required. A remote URL and successful download can only be reported after authorized upload and readback verification.

The local reviewable proposal is `release/KALENDARZ-1.4.1-draft-plan.json`; release body is `release/KALENDARZ-1.4.1-RELEASE-NOTES.md`. Artifact names/sizes/hashes are concrete and final. No push or publication occurred.
