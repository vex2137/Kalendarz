# Local multi-model assistant: implementation record

Base: `cc2cbfb`, preserving draft PRs #5–#7 and the bundled official 350M GGUF.
Working branch: `feat/local-ai-models-history`; no change to the default model.

## Stage 1 — source audit

The repository contains the 350M manifest, official bundled weights (ignored by
Git), prompts, JSON schemas, PL/EN rules, evaluation fixtures/reports and runtime
diagnostics. No training scripts or LoRA adapters were found in tracked files.
There is no evidence that the model was fine-tuned for this application.

Upstream sources to verify:
- https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF (official LFM2.5 Q4_K_M)
- https://huggingface.co/Qwen/Qwen3.5-0.8B (original Qwen weights, Apache-2.0)
- https://huggingface.co/bartowski/Qwen_Qwen3.5-0.8B-GGUF (converted Q4_K_M / IQ4_XS)
- https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF (alternative conversions)
- https://github.com/ngxson/wllama (installed runtime: 3.8.1)

The cloud executor currently rejects Hugging Face requests with HTTP 403.
`AI model source verification` obtains exact revisions, byte sizes and upstream
LFS SHA-256 metadata in Actions. Human-rounded search snippets are not sufficient
to populate the verified download manifest.

## Remaining stages

## Stage 2 — pinned candidates and runtime preparation

Actions source audit `40083841560` returned exact metadata stored in
`model-source-verification.json`. Official LFM2.5 2.6B Q4_K_M is 1,674,455,040
bytes. The Qwen official GGUF repository was not publicly accessible (401), so
the panel uses explicitly attributed mradermacher conversions of the Qwen model:
Q4_K_M 527,503,680 bytes; IQ4_XS 488,114,496 bytes. Both remain separate choices.
The latter saves 39,389,184 bytes (7.47%); its quality is not assumed equivalent.

Both shipped WASM binaries contain `lfm2` and `qwen35` architecture names. This
is not proof of execution. The candidate workflow downloads pinned weights,
checks size/hash, then executes raw Polish/English and schema inference in the
actual packaged runtime with external browser requests blocked. Reports must
identify themselves as cloud Chromium, never as Android/POCO measurements.

Runtime selection unloads the previous model before selecting another. Large
downloads stream to private OPFS storage instead of retaining GBs of chunks in
the JS heap. On origins without streaming storage, large models require file
import. Memory requirements shown in the future panel are estimates, not PSS
measurements. Default remains the original bundled 350M.

LFM1.0 permits redistribution with its license/attribution and has an annual
commercial revenue threshold of USD 10 million (separate permission is required
above that threshold). Qwen weights/conversions declare Apache-2.0. License
links and attribution stay visible; no candidate GGUF is committed to Git.

## Remaining stages

Verify actual engine execution for candidate models; prepare comparable raw-LLM,
rules-only and full-assistant benchmarks; retain 350M as default/fallback; add
explicit model installation/switching, local chat history and compact model UI;
run regression/offline checks and publish only diagnostic Actions artifacts.

Physical POCO measurements and model recommendations remain pending until real
device results are available. Unknown measurements must be reported as unknown.
