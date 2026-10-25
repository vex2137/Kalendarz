# Calendar 1.4.1 implementation and validation

## Starting point (2026-10-25)

The clean local `work` branch was at `fa20810` (1.3.0), with no unpublished
commits after fetching `origin/main`. Work continues on `feat/ai-141-ultimate`
from the exact PR #10 head `592e998886b81b22379484dff64a9832b84c2b38`.
PR #10 contains five commits / 40 files over PR #9 head `2ba6890`.
Both PRs are open drafts. No existing work was discarded or reconstructed.

The application uses React / TypeScript / Vite, Electron desktop processes,
Capacitor Android, IndexedDB and OPFS, and wllama for browser/mobile CPU inference.
Desktop llama.cpp b11669 is packaged in separate checksum-verified CPU and Vulkan
runtimes behind sandboxed IPC. Model catalogue checksums and application/profile
identifiers are retained. No signing, licensing or calendar schema changes.

## CI investigation

At PR #10 head, six completed checks failed. Four desktop checks (two Web checks,
Linux AppImage and Windows packaging) reached real model diagnostics, then failed
in `tests/electron.cjs`: Electron 44 no longer returns the preload path in
`getLastWebPreferences()`, so the test created a renderer without its bridge.
The corrected test loads a second renderer at the application's actual file URL
using the explicit packaged preload path and requires its working bridge to
reject the sender. This was reproduced and verified locally. Isolation assertions remain.

The Linux optional LFM2.5 2.6B check returned incomplete JSON. Its smoke test used
256 tokens while the application allows 768 for this model. The probe now uses
the same budget and explicitly rejects a non-stop finish before parsing.
This change still requires execution with the 2.6B weights.

The Flatpak package built and installed but Playwright could not launch its
installed wrapper. Diagnosis and validation of this failure remain outstanding.
No tests or publication gates were disabled. Existing Android and five other
optional-model checks passed; Web checks were still marked in progress when read.

## Native engine changes

- Auto tries GPU once and falls back to CPU after startup / generation failure.
- Explicit GPU mode reports a public error and never silently starts CPU/WASM.
- CPU does not probe or initialize Vulkan.
- Cancellation aborts loading and waits for the generation and process teardown.
- Pending initialization cannot be reused for a different model.
- Process teardown waits for exit, including a bounded SIGKILL escalation.
- Diagnostics expose measured model load time and throughput; GPU confirmation
  still requires both offloaded layers and generated tokens.

## Evidence so far

- Existing application tests: 121 passed, zero failed or skipped.
- Native policy/storage tests after fixes: 9 passed, zero failed or skipped.
- TypeScript check passed after installing the declared missing wllama dependency.
- Real local llama.cpp CPU smoke with verified 350M weights from official 1.4.0:
  passed cold/warm JSON extraction, prompt cache reuse, cancellation, unload and
  reload. This is not physical GPU evidence.
- Archived PR #10 Linux Qwen CPU report (`native-inference-linux`, artifact
  12576674431) passed its lifecycle checks. Its raw ambiguous/date answers reveal
  quality limitations; deterministic application validation prevented writes.
  Archived evidence does not validate this session's changed source.

Hugging Face is blocked by this environment's destination policy. GitHub tools
and Git fetch work; no repeated authentication failures. No push or release.


## External GGUF directories

Desktop settings can register several chosen directories, scan nested LM Studio
layouts, select a discovered model, refresh, and remove a registration. Files
remain in place and external models are never passed to download/delete APIs.
The main process stores directory grants in `model-folders-v1.json`; the renderer
receives opaque model identifiers and display metadata. Calendar storage is unchanged.

Scans read bounded GGUF metadata, reject malformed and multipart GGUF, skip
symlinks, deduplicate overlapping roots/hardlinks, report missing/access-limited
folders, and bound traversal to 50,000 entries, 2,000 models and depth 16.
A changed file requires refresh. Discovery is not a guarantee of compatibility
with the runtime's supported architectures or a model's chat template.

Eight directory tests and the nine native tests pass. A real 350M external GGUF
passed an Electron UI integration test: add via picker, discover, select, execute
cold/warm diagnostic inference on CPU, enforce IPC isolation, restart with model,
backend and event preserved, then remove registration with file size and mtime
unchanged. The frontend build and existing browser regression suite also passed.
This frontend build omits unavailable bundled Qwen weights and is not an installer.

Pinned macOS CPU runtime staging was added for x64/arm64, with upstream archive
checksums and dylib handling. arm64 staging was verified on Linux; macOS execution
is unverified. A macOS CI job was added but has not run. Vulkan remains an
experimental Windows/Linux backend. Android/Web do not expose desktop folder APIs.


## Calendar contract and fine-tuning preparation

The JSON contract now supports validated `reminderMinutes` (0..525600). Reminder
changes require explicit request evidence; unclear/multiple offsets ask a question.
Creation requires an evidenced date, complex unsupported recurrence asks for the
editor, and generated clarification text cannot claim a successful calendar write.
Existing confirmations, identifiers, recurrence and reminder storage are retained.
The legacy settings default now agrees with the existing Qwen registry default;
explicit saved settings are still loaded without replacement.

`training/` contains a deterministic synthetic-data generator, TypeScript and
standalone Python validators, a pinned original-checkpoint configuration, masked
SFT/PEFT LoRA training, bounded checkpoints/resume, evaluation and adapter export.
All 432 records validate (264 train / 78 validation / 90 test, 42 template groups).
This is a seed corpus; the 2,000–5,000-record target is not complete.

Three Python tests exercised the actual Qwen3.5 Transformers architecture with
**tiny random local weights**, including two optimizer steps, checkpoint resume,
validation loss and adapter export. No Qwen3.5 0.8B training or tuned-vs-base
comparison occurred. No new production model or default replacement was made.
A real, schema-constrained 350M CPU baseline on 22 held-out synthetic requests
returned valid JSON 22/22, expected intent 8/22 and exact extraction 1/22. These
figures describe raw model extraction, not deterministic application routing.
See `training/README.md` for commands, model-source links and limitations.
