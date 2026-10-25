# KALENDARZ 1.4.1 — four-platform stable packages

Date: 2026-10-25. Branch: `feat/ai-141-ultimate`. Targets are exclusively Android ARM64, Linux x86_64, Windows x64 and production Web. No other platform package, runner or deployment was built/configured. Existing historical backends were not removed. The user authorized a GitHub draft with the finished artifacts; public publication, Git push/merge and automatic website deployment remain unauthorized and were not performed.

## Finished files

| Artifact in `release/` | Bytes | SHA-256 |
| --- | ---: | --- |
| `KALENDARZ-1.4.1-ANDROID.apk` | 24,005,277 | `d187778c9185af75dfc8c61d8436fe1412e8f0c5c6f85a2cbc5abe8e633a5c89` |
| `KALENDARZ-1.4.1-linux-x86_64.AppImage` | 165,035,840 | `1dd853fc8e64d62337ad0dcee7119a34d7c07b969d8c979ce8f0f01a0564d7ad` |
| `KALENDARZ-1.4.1-WINDOWS-x86_64.exe` | 117,048,817 | `ed39c29581b232ec195a77a7de9601b053b8605340bcef822ca86aa3069be0d3` |
| `KALENDARZ-1.4.1-WEB.zip` | 6,954,776 | `029906228d815547c24ec5b11709dcb755725baf2ab70a440d95be71790cd8da` |

`KALENDARZ-1.4.1-SHA256SUMS.txt` now covers exactly these four final files; each has an individual `.sha256` sidecar. `KALENDARZ-1.4.1-final-packages.json` records provenance/validation. Older Beta, diagnostic and ZIP artifacts remain local history and are excluded from the draft's explicit upload list.

Android and Linux were reused without changes: Android 1.4.1/code 10406 retains the verified update certificate, existing diagnostic identity, ARM64 native runtime and 16 KiB alignment; Linux retains its verified executable AppImage and CPU/Vulkan resources. Their previous short final regressions remain applicable because this turn did not change application code or those packages. The APK updates the existing Beta/diagnostic install, not the separately signed official 1.4.0 production package. Install without uninstalling or clearing data.

Windows was cross-built as a real portable EXE using the existing electron-builder configuration, pinned CPU/Vulkan runtimes and cached Windows Electron distribution. Its NSIS bootstrap contains an x64 application payload. The embedded 7z payload passed archive-integrity testing (139 files); the application PE is x64, all 63 native runtime file hashes match, and packaged ASAR metadata identifies clean application build `1973ea8`. No Authenticode signing or Windows execution is claimed. No physical NVIDIA/AMD/Intel GPU was available.

Web is a real Vite production build with Android native integration disabled. ZIP CRC and all 37 production files match the tested `dist/`; both WASM runtimes, service worker and manifest are included. Added deployment-only files are `DEPLOYMENT.md`, `_headers`, `nginx.example.conf` and `PROJECT-README.md`. Use HTTPS, correct JS/WASM MIME types and COOP/COEP headers. The existing README's MIT declaration is retained unchanged; no new license/copyright was invented. No website was created or deployed.

All packages are intentionally model-free; existing installed GGUF data/settings/history remain untouched, and a new installation imports/downloads a supported model. Native architecture/quantization compatibility remains governed by pinned llama.cpp.

## New checks in this turn

- Web production regression `tests/browser.cjs` passed: event CRUD/persistence, local dates/reminders, non-destructive imports, holidays, search, focus/Escape, PIN/reload/inactivity lock, cross-tab writes/deletion/recovery, responsive 320/390/768 px layouts, 10k agenda and offline event/sync reload.
- `tests/web-artifact-browser.cjs` serves only production files with deployment headers and drives actual UI. With a complete real LFM2.5 350M Q4_K_M it passed import, CPU selection, cold/warm real WASM inference with token/timing/cache assertions, JSON export, service-worker offline restart, and event/model/mode persistence. No injected native bridge or source-module imports substitute for inference. Evidence: `evidence/ai-141-production-web.json`.
- The first production model run hit the application's unchanged 120-second limit while Windows compression occupied the shared CPU. Its diagnostic failure was not suppressed. The repeated run after compression passed, with the same application files, model, timeouts and assertions. The shared test helper now gathers all alert messages rather than failing on two simultaneous error elements. No runtime performance claim is inferred from a contended run.
- Windows portable build, outer PE/NSIS container, embedded application archive integrity, x64 application identity, all 63 CPU/Vulkan file hashes, ASAR source/version and production flags passed. Runtime launch on actual Windows is unverified.
- Web ZIP packaging initially referenced a missing root `LICENSE`. This was corrected to include the existing project's README/declaration before publishing any package. The final archive passes CRC and production-file comparison, and is installed atomically from a temporary file. The project's license was not changed.
- Android/Linux hashes still match their previously verified final files. Their earlier startup, real native CPU, GGUF transfer/import, mode, JSON/memory and same-origin upgrade regressions are recorded in `release-1.4.1-final.md`; they were not redundantly rerun here after packaging/test/documentation-only changes.

No application/data schema or inference backend was changed. No full unit rerun, new physical Android test, physical GPU test or Windows runtime success is claimed in this turn. No tests were disabled to obtain a pass.

## Limits and next version

The maintainer's POCO core-function acceptance and explicit release decision remain in force: unfinished Vulkan does not block stable 1.4.1. Auto cleans up and falls back to CPU, GPU-only fails clearly, and active backend/offload/token reporting remains truthful. Driver compatibility, Android GPU tuning, hardware benchmarks and optional CUDA verification are 1.4.2 work. Windows remains unsigned and execution-unverified. Web uses CPU WASM; its package does not claim browser GPU acceleration. Live Hugging Face checks remain restricted in this environment; actual local HTTP/file tests and the user's phone download acceptance are separate evidence.

## Draft and delivery status

The user's latest instruction **already authorizes** an unpublished GitHub draft titled **KALENDARZ 1.4.1**, proposed tag `v1.4.1`, repository `vex2137/Kalendarz`, with exactly these four binaries/archives and the checksum file. No further permission question is needed for that scope. Upload must not overwrite existing differing assets; no Git push, merge, public publication or site deployment is authorized.

**Remote creation/upload is blocked by authentication.** One fresh `gh auth status` check still reports `GH_TOKEN` invalid. The available GitHub connector has no release-create/asset-upload operation; no token was read/exposed or bypass attempted. No draft, tag or asset was remotely created and there is no working remote download URL yet. Direct binary attachment/export is also unavailable. Local file paths and the earlier failed sandbox links are not represented as successful delivery.

`release/KALENDARZ-1.4.1-draft-plan.json` is updated with the authorized five-file upload list, exact sizes/hashes and `draft=true`, `prerelease=false`; `release/KALENDARZ-1.4.1-RELEASE-NOTES.md` contains the proposed body. With working release-upload authentication, resume the already-authorized draft upload, verify each uploaded digest by readback, then provide the actual authenticated draft/asset links. Keep it unpublished. The draft is download staging; source/tag alignment must be reviewed separately before any public publication because source commits remain local.

New commits before this report: `8368b93` (four-platform scope, Web packager and production test), `1973ea8` (package the existing MIT declaration), `45d1f10` (complete diagnostic test failures). Web/Windows application build is `1973ea8`; Android is `dbac195`; reused Linux is `641f00e`. No code push or publication occurred.
