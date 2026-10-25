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
in `tests/electron.cjs`: a `data:` renderer did not receive the preload bridge.
The corrected test loads a second renderer at the application's actual file URL
and requires its working bridge to reject the sender. Isolation assertions remain.

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
