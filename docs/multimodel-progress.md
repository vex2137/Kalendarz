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

Verify actual engine execution for candidate models; prepare comparable raw-LLM,
rules-only and full-assistant benchmarks; retain 350M as default/fallback; add
explicit model installation/switching, local chat history and compact model UI;
run regression/offline checks and publish only diagnostic Actions artifacts.

Physical POCO measurements and model recommendations remain pending until real
device results are available. Unknown measurements must be reported as unknown.
