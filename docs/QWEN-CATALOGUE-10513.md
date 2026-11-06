# Default Qwen catalogue download — APK 10513

The missing button was caused by `localModelManifest.json` having an empty URL. ModelManager correctly requires a URL before rendering its existing Download action. The default had remained configured as private/local bundled weights even though the owner supplied its public Hugging Face repository. No downloader/rendering rewrite is needed.

Configure the owner-provided catalogue source in `defaultModelSource.json`, overlaid by modelRegistry on the unchanged bundled manifest:
https://huggingface.co/Vex909/Qwen-3.5-v2-Q4_K_M/resolve/main/kalendarz-qwen35-v2-q4_k_m.gguf

Preserve the existing trusted model identity, 529297056 bytes and SHA-256 fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5. The training revision, model selection, installed-model records and history remain unchanged. The mutable main URL is constrained by the pinned size/checksum; different bytes cannot be installed. No guessed checksum is introduced.

The standard button now uses installLocalModel and the existing Android background service/Range/ETag/checkpoint/SHA-256 path. Selected, missing, downloading, verified and loaded remain separate states. The model-free signed APK contains no weights. Import and GPU code are untouched.

Cloud policy excludes Hugging Face. A targeted CI job probes only this repository's public LFS metadata and reads at most eight bytes from the file URL. It verifies metadata against the existing pin and validates the GGUF header/HTTP range, without downloading the full model. Network denial is explicitly reported as unverified; an observed metadata/integrity mismatch fails the probe. Metadata/header success is not full-file download or inference verification.

Regression: the real UI must render an enabled Download action for the missing selected default Qwen. Its configured URL is intercepted with a synthetic HTTP 503; clicking must reach the existing downloader exactly once and leave installed=false/Used absent. Existing legacy model state/migration tests remain. The imported-model fixture explicitly retains url='' rather than inheriting the newly public default URL.

Manual POCO acceptance: update without clearing data, select Kalendarz Qwen3.5 0.8B v2 Q4_K_M, press Download, navigate away and return to current progress. Pause/resume uses the unchanged service. Installed/Use becomes available only after full verification. Existing verified weights must not be replaced on failure. Confirm public transfer and inference on the device; Cloud catalogue tests alone do not establish either.

The first CI run caught the historical 1.4.2 release guard requiring its bundled manifest to remain private. Keep that manifest contract intact and overlay the public URL only for the current application catalogue/model-free distribution; do not weaken the release guard.

## Verified public source

The targeted Actions probe returned verifiedMetadataAndHeader=true, HTTP 206 and Content-Range bytes 0-7/529297056. Hugging Face revision 7934000b9b4016c3056bc1c56e9c402120d7ba0f reports exactly 529297056 bytes and SHA-256 fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5. This establishes matching public metadata and reachable GGUF header, not a full 529 MB transfer or inference test. Full SHA-256 verification remains mandatory during installation.

APK `Kalendarz-1.5.0-Part-2-Beta-2-Qwen-10513.apk`, 24345302 bytes, SHA-256 `a9321bcdc27a21c2f4f4c43e61c06cb88ccdaae5bcdd907ea8fa01c45ff8b3cd`. Application source `44005cacaeb2758b977d1ede3e70896a4f1b14f8`; later 736527f changes only package-catalogue validation/tests and has no src/electron/android/package/lockfile diff from that source. APK package/signature/versionCode 10513/alignment/clean build provenance and absence of GGUF checked. Existing com.kalendarz.offline.diagnostics identity/certificate preserved. No downloader, import or GPU implementation changes.

## Final validation and download

All source CI jobs passed: web, desktop, Android and default-Qwen source probe: https://github.com/vex2137/Kalendarz/actions/runs/42219778502 . PR CI passed: https://github.com/vex2137/Kalendarz/actions/runs/42219785416 . The test run includes the default missing-model Download regression and package guard rejecting missing URL/incorrect integrity fields. No tests were removed or release guards relaxed.

Verified signed APK: https://github.com/vex2137/Kalendarz/actions/runs/42220079345/artifacts/13503251232 (GitHub login; 30-day retention). Artifact verification/upload succeeded. Final source uses the unchanged existing transfer implementation. Real full-file transfer/verification/inference of this public Qwen on POCO remains the device acceptance check. PR #20 is Draft/unmerged; no tag or official release.
