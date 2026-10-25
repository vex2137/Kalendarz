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

## Upgrade and fault-injection regression checks

The official Web 1.4.0 artifact (`228f339e7032209f55193b68938ce6035dcc865d`)
was served before this build at the same HTTP origin. The test preserved a weekly
event and its three reminders, custom theme, explicit Polish, settings, AI chat
and message, selected 350M identity, CPU preference and OPFS fixture bytes across
upgrade and another reload. The OPFS fixture establishes storage preservation,
not inference. Existing OPFS streaming and sync-worker tests also passed imports,
HTTP/truncation/checksum failures, cancellation and quota handling.

A deliberately failing GPU subprocess reported an injected memory error and
ignored SIGTERM. The test verified its PID had exited (after bounded SIGKILL)
**before** starting real llama.cpp CPU inference, which returned actual tokens.
Another real native process rejected an invalid GGUF, reported an explicit model
error and left no running process. This is fault injection, not physical GPU proof.

Date validation now also rejects invented edit dates and separately validates a
move's target date. The existing same-Friday rule/parser corpus passes unchanged.
Directory discovery additionally hashes suspected equal-name/size copies to avoid
duplicates without conflating different weights; ordinary discovery reads only
bounded metadata. Native load and changed-folder errors have localized messages.

Useful additional commands (run against prepared frontend/native runtime assets):

```sh
npm run test:native
CALENDAR_140_WEB_DIR=/path/to/extracted/official-1.4.0-web npm run test:upgrade:141
CALENDAR_EXTERNAL_MODEL=/path/to/real/model.gguf npm run test:models:folders
CALENDAR_MODEL_FILE=/path/to/LFM2.5-350M-Q4_K_M.gguf npm run test:native:fallback
```

The process fault test is Linux-only and intentionally uses an injected Vulkan
launcher. The directory integration test executes actual GGUF inference and
requires a compatible complete file. On headless Linux, provide an X display.

## Remaining release gates

- No physical GPU is attached to this cloud environment (Debian 13 x64, Intel
  Xeon Platinum 8573C, 2 available CPU threads). Vulkan inference/offload, real
  driver loss and real VRAM exhaustion have not been tested on physical hardware.
- The six failed remote checks still describe PR #10 head `592e998`; local fixes
  have not been pushed. Three Web jobs were still reported in progress on read.
  CI cannot be declared green. The desktop isolation regression was reproduced
  and fixed locally, but packaged Linux/Windows checks must run again remotely.
- Flatpak launch remains unresolved: original logs hide subprocess stderr.
  Browser-launch logging was enabled for the next CI run. Local Flatpak execution
  is blocked by this container's read-only user-namespace UID map (`bwrap`).
  Do not infer that a built/installed package was runnable.
- The optional 2.6B JSON fix uses the application's real token budget and preserves
  failed completions in artifacts. Those weights were unavailable for a local rerun.
- Hugging Face is denied by network policy. A frontend-only `vite build` passed;
  complete new Qwen-bundled installers were not built. Production build hooks still
  reject absent/incorrect weights. Neither a partial bundle nor a test model was
  substituted for a production installer.
- macOS x64 and arm64 archive staging/checksums passed on Linux; actual macOS
  execution and Windows execution of this branch remain unverified. Android's
  native Java/signing/application IDs are unchanged; its new package/upgrade was
  not built here because the SDK and complete production bundle are unavailable.
- The 432-record corpus needs expansion/review. Real Qwen 0.8B LoRA training and
  base-vs-adapter evaluation remain pending; no tuned model was created.

**Release recommendation: not ready to publish 1.4.1.** Review the local changes,
then run the candidate CI and physical GPU acceptance gates before considering a
release. No source history was rewritten, no user data removed, and no push,
release publication or signing changes occurred during this session.

## Final local result

Implementation commits: `dd9787a`, `e227a52`, `f105444`, `67989a0` on
`feat/ai-141-ultimate`. All four are local descendants of the exact PR #10 head.
The report itself is recorded in a final documentation commit. The working tree
is clean after those commits; no push or publication was performed.

Final formal tests: **128 application + 18 native/directory + 3 Python pipeline =
149 passed, zero failed, zero skipped**. Six additional script-based integration
suites passed; their assertions are not counted as extra unit tests. These final
counts describe the corrected source, not intermediate failures during debugging.
TypeScript and the frontend-only Vite build passed. Full installer/Android/GPU
hardware checks remain unexecuted or blocked as listed above.

At the last remote read of PR #10 head: 7 checks passed, 6 failed, 2 skipped and
3 remained in progress. Those checks have not run on this local branch. The local
results do not replace CI or establish release readiness.

Machine-readable evidence, scope and remaining work: [`validation-141.json`](validation-141.json).


Android native GPU/import follow-up and newer beta build evidence: see [AI-1.4.1-android-gpu.md](AI-1.4.1-android-gpu.md). It supersedes the earlier Android build-environment limitation; physical hardware gates remain.
