# Default Qwen catalogue download — APK 10513

The missing button was caused by `localModelManifest.json` having an empty URL. ModelManager correctly requires a URL before rendering its existing Download action. The default had remained configured as private/local bundled weights even though the owner supplied its public Hugging Face repository. No downloader/rendering rewrite is needed.

Configure the owner-provided source:
https://huggingface.co/Vex909/Qwen-3.5-v2-Q4_K_M/resolve/main/kalendarz-qwen35-v2-q4_k_m.gguf

Preserve the existing trusted model identity, 529297056 bytes and SHA-256 fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5. The training revision, model selection, installed-model records and history remain unchanged. The mutable main URL is constrained by the pinned size/checksum; different bytes cannot be installed. No guessed checksum is introduced.

The standard button now uses installLocalModel and the existing Android background service/Range/ETag/checkpoint/SHA-256 path. Selected, missing, downloading, verified and loaded remain separate states. The model-free signed APK contains no weights. Import and GPU code are untouched.

Cloud policy excludes Hugging Face. A targeted CI job probes only this repository's public LFS metadata and reads at most eight bytes from the file URL. It verifies metadata against the existing pin and validates the GGUF header/HTTP range, without downloading the full model. Network denial is explicitly reported as unverified; an observed metadata/integrity mismatch fails the probe. Metadata/header success is not full-file download or inference verification.

Regression: the real UI must render an enabled Download action for the missing selected default Qwen. Its configured URL is intercepted with a synthetic HTTP 503; clicking must reach the existing downloader exactly once and leave installed=false/Used absent. Existing legacy model state/migration tests remain. The imported-model fixture explicitly retains url='' rather than inheriting the newly public default URL.

Manual POCO acceptance: update without clearing data, select Kalendarz Qwen3.5 0.8B v2 Q4_K_M, press Download, navigate away and return to current progress. Pause/resume uses the unchanged service. Installed/Use becomes available only after full verification. Existing verified weights must not be replaced on failure. Confirm public transfer and inference on the device; Cloud catalogue tests alone do not establish either.
