# Calendar 1.4.2 Qwen experiment

This branch prepares real BF16 LoRA fine-tuning of `Qwen/Qwen3.5-0.8B`.
**No production weights have been trained in this cloud session.** There is no
base/adapter accuracy claim, new GGUF, or physical Android certification.
The existing 1.4.1 dataset, model identities, parser, confirmations, history and
CPU fallback remain available. Signing, launcher naming and release asset naming
are outside this experiment. Do not publish v1.4.2 from this branch yet.

## Evidence and sources

`source-audit.json`: the public v1.4.1 source archive contains all 388 tracked files,
with zero byte mismatches against `ded3bdc5de00205987a0918b67145a96dc1c140f`.
The main branch, tag and initial checkout pointed to that commit. Differences
from the recovered package source `1ea6f9e…` are documentation and CI only.
Weights, downloaded runtimes, dependencies and private signing files are not
part of source archives. They are intentionally separate build inputs.

`environment.json`: 3 available CPU threads, 8 GiB cgroup RAM limit, no CUDA GPU.
A direct request for the pinned Hugging Face config returned proxy HTTP 403.
This prevents obtaining the real checkpoint here. Tiny random architecture tests
are plumbing evidence only; their temporary adapters are deleted after testing.

Reviewed upstream references:

- [Official model and license](https://huggingface.co/Qwen/Qwen3.5-0.8B).
- [Pinned official template](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/chat_template.jinja).
- [Transformers Qwen3.5 implementation](https://github.com/huggingface/transformers/blob/main/docs/source/en/model_doc/qwen3_5.md).
- [Unsloth compatibility guidance](https://unsloth.ai/docs/models/qwen3.5/fine-tune)
  confirms Transformers v5 and BF16 LoRA support and advises against QLoRA for
  this family. Its memory numbers describe Unsloth, not our measured VRAM.
- [Application-pinned llama.cpp converter](https://github.com/ggml-org/llama.cpp/blob/620d2225cc436ab0b001e3200e590e3b286ef9ab/conversion/qwen.py)
  registers `Qwen3_5ForConditionalGeneration` as QWEN35.

The selected path is Transformers + PEFT Trainer. TRL and Unsloth are optional
alternatives, not installed or certified by this experiment. Training GGUF is
not attempted. CPU compatibility was exercised with torch 2.11.0+cpu,
Transformers 5.20.2, PEFT 0.21.2, Accelerate 1.15.0 and Datasets 5.1.0.
The matching official torch 2.11.0+cu128 wheel exists; GPU execution is pending.

## Data and isolation

```sh
node --import tsx training/v142/generate.ts
python training/conversation_dataset.py
```

The reproducible dataset contains **388 records**: **266 Polish (68.6%)** and
**122 English (31.4%)**; **246 train / 66 validation / 76 test**; **84 families**.
There are 308 command targets, 80 natural answers, and 24 multi-turn records.
288 records come from existing synthetic 1.4.1 sources: all Polish contexts plus
one English context per source template. 100 new records come from 50 bilingual,
readable source families in `curated.ts`. The original 432-record generator and
its data are retained, not overwritten.

Natural conversation uses the exact shared runtime conversation prompt. Extraction
uses the existing calendar contract and actual runtime prompts. No handcrafted
replacement chat template is used: `AutoTokenizer.apply_chat_template` loads the
pinned official template with `enable_thinking=False`. All prompt/history tokens
are masked; only the final assistant answer contributes to loss. Long records
fail rather than truncate JSON. Preflight checks every record with the real
cached tokenizer before training. That check could not run without source files.

Source review checked calendar arithmetic, language, supported capabilities and
proposal-vs-save wording. Automated checks enforce schemas, hashes, roles, full
prompt deduplication and semantic family isolation. Current date/timezone are
part of the prompt: the same wording at a different date is a distinct task.
Related command paraphrases inherit the original family's split. This remains a
small synthetic seed set; independent linguistic review is still required.
It is not a claim of broad conversational coverage or human annotation at scale.

`regression.json` has **28 additional independent cases**, 14 PL / 14 EN,
including month/year boundaries, invalid leap day, reminders, ambiguity,
destructive proposals, language changes and context. Neither SFT generator loads
it. Existing parser/assistant fixtures also remain unchanged and are never used
as training input. Do not select training settings using test/regression scores;
use validation for tuning and run test only for a candidate decision. No private
conversation, real event, secret or personal identifying information is used.

## CachyOS / RTX 4060

Use Python 3.12 and check `nvidia-smi` first. Desktop and laptop RTX 4060 variants
normally provide 8 GiB VRAM; verify the actual card, free VRAM and installed driver.
Keep at least 16 GiB host RAM and approximately 15 GiB free disk for cache,
checkpoints, merged weights and conversion. These are planning budgets, not
measurements on the user's PC. Close VRAM-heavy applications before the smoke run.

```sh
python3.12 -m venv .venv-training
. .venv-training/bin/activate
python -m pip install -r training/v142/requirements-cuda.txt
node --import tsx training/generate.ts
node --import tsx training/v142/generate.ts
python training/conversation_dataset.py
python training/fetch_model.py
python training/preflight.py --tokenizer --output training/runs/rtx4060-preflight.json
python training/test_v142.py
python training/test_pipeline.py
```

The constraints file pins the tested Python dependency set; CUDA's own runtime
packages follow the official pinned torch wheel dependencies. Its driver must
support CUDA 12.8. CPU plumbing uses `requirements-cpu.txt` instead. This pipeline
uses correct reference PyTorch kernels (`attn_implementation=eager`); optional
Triton/Flash Linear Attention kernels have not been validated here. Training can
be slower without those kernels, but inference exports do not depend on them.

Run a two-step smoke test on 8 train / 4 validation rows, then the real experiment:

```sh
python training/train.py --config training/v142/smoke.json
python training/evaluate_v142.py --output training/runs/v142-base.json
python training/evaluate_v142.py --regression --output training/runs/v142-base-regression.json
python training/train.py --config training/v142/rtx4060.json
python training/evaluate_v142.py --adapter training/runs/v142-rtx4060/adapter --output training/runs/v142-tuned.json
python training/evaluate_v142.py --regression --adapter training/runs/v142-rtx4060/adapter --output training/runs/v142-tuned-regression.json
```

Profile: rank 16, alpha 32, dropout 0.05, LR 5e-5, seed 142, BF16, batch 1,
gradient accumulation 8, maximum 1024 tokens, 90 optimizer steps (~2.9 epochs
of 246 training records). `max_steps` determines the budget; the nominal
`epochs:3` does not override it. Targets are text attention Q/K/V/O, hybrid
linear-attention projections and MLP gate/up/down, with the vision encoder frozen.
Checkpoint/evaluation every 10 steps; logs every step, two retained checkpoints.
`trainer_state.json`, `train_results.json`, `eval_results.json`, `metrics.json`
and `run-metadata.json` preserve loss history, peak allocated VRAM, exact package
versions, template hash and dataset hashes. The seed controls RNGs; it does not
promise bit-identical results across different GPU kernels or drivers.

If CUDA runs out of memory, first free VRAM. Preserve batch 1 and checkpointing;
reduce context only after the tokenizer preflight proves every record still fits.
Increasing accumulation changes effective batch, not per-sample memory. Start a
new output directory for changed parameters. Do not silently truncate examples.

```sh
python training/train.py --config training/v142/rtx4060.json --resume training/runs/v142-rtx4060/checkpoint-10
python training/export_adapter.py training/runs/v142-rtx4060 training/exports/v142-adapter
```

Resume retains optimizer/scheduler/RNG state and checks dataset and configuration.
Only the step budget may be increased; other changes need a new run. Existing
outputs are protected. Exported adapters are preserved separately from merged
weights. The expected production adapter location is
`training/runs/v142-rtx4060/adapter`; it does not exist until actual training.

## Before/after evaluation

`evaluate_v142.py` generates without JSON constraints to expose extraction errors.
Command scores include strict JSON/contract validity, intent and exact fields.
Natural outputs require explicit blinded human review: in each report's
`text_review`, add `review` with boolean `language`, `grammar`, `relevance`,
`grounding`, `safety`. References are guidance, not exact-match language scores.
Include prompt context and explicit requested language in the review.

```sh
python training/compare_v142.py training/runs/v142-base.json training/runs/v142-tuned.json --output training/runs/v142-comparison.json
```

The comparison rejects unpaired IDs/corpora/settings, missing reviews and missing
hardware/timing evidence. Experiment gates: +5 percentage points in reviewed
Polish text, no category/English drop over 2 points, no median warm decode slowdown
over 10%, and no measured memory increase over 15%. Small samples have uncertainty;
these thresholds do not establish statistical significance or replace app/device
acceptance. Transformer adapter timings include adapter overhead; deployment
performance must be checked again on the merged/quantized artifact.

Current real-Qwen results:

| Measure | Original Qwen | Fine-tuned Qwen |
| --- | --- | --- |
| PL / EN response quality | Not measured | Not measured |
| Calendar / relative dates / typos | Not measured | Not measured |
| Multi-turn / hallucinations | Not measured | Not measured |
| Training / validation loss | Not applicable | No real training |
| TTFT / token rate / RAM | Not measured | Not measured |
| POCO X7 Pro | No new measurement | No artifact/device test |

The user's ~30.6 tokens/s phone result remains user-reported reference evidence.
A separate 1.4.1 repository table also contains 30.6 tokens/s for **LFM350M on
Linux CPU**; it is not a new Qwen/phone baseline.

## GGUF export and integration

Use the same llama.cpp commit as the app, in a separate conversion environment
if its requirements conflict with the training lock. Install this branch's training
requirements and llama.cpp's pinned conversion requirements in that environment.
The latter are supplied by the checked-out source, not a floating latest converter.

```sh
git clone https://github.com/ggml-org/llama.cpp training/exports/llama.cpp
git -C training/exports/llama.cpp checkout 620d2225cc436ab0b001e3200e590e3b286ef9ab
python -m pip install -r training/exports/llama.cpp/requirements/requirements-convert_hf_to_gguf.txt
cmake -S training/exports/llama.cpp -B training/exports/llama.cpp/build -DGGML_CUDA=OFF
cmake --build training/exports/llama.cpp/build --target llama-quantize -j 4
python training/convert_gguf.py --run training/runs/v142-rtx4060 --output training/exports/v142-gguf --llama-dir training/exports/llama.cpp
```

The script requires a real non-smoke adapter and training metrics, merges it,
exports text-only F16 GGUF, quantizes Q4_K_M, and checks architecture, tensors,
quantization, EOS and the exact official chat template. It preserves the adapter
and writes `provenance.json` and `SHA256SUMS.txt`. Its output remains a candidate;
conversion is not model-quality or runtime certification. IQ4_XS is deferred
until Q4_K_M passes actual model/device tests; no untested variant is advertised.

Import the candidate through existing Import GGUF on Android/Desktop, or the
read-only desktop model directory support. Its embedded name identifies Calendar
FT; its checksum yields a distinct `imported-<sha256>` identity. Original Qwen Q4,
Qwen IQ4 and LFM350M stay selectable. Switching uses the existing history store and
confirmation API. No model is bundled automatically and no remote URL is invented.
`fineTunedModels.json` is intentionally empty until a verified published artifact
has a real pinned URL, revision, byte size and SHA; both web and native catalogues
now consume it. Download/install/select then reuse the existing catalogue flow.
Adding that real entry is a remaining integration task, not evidence of weights.

Real application-native GGUF evaluation, once runtime and weights exist:

```sh
CALENDAR_MODEL_FILE=/absolute/path/to/model.gguf CALENDAR_MODEL_SHA256=<actual-sha256> SFT_NATIVE_REPORT=training/runs/native-base.json node --import tsx training/evaluate-gguf-v142.cjs
```

Repeat with the candidate under the same CPU conditions. This hashes the model,
reads real GGUF metadata, uses `electron/native-ai.cjs`, measures three process
cold starts (without flushing OS disk cache), warm TTFT/tokens/s/RAM, and runs the
full held-out corpus. `SFT_REGRESSION=1` selects the independent set;
`SFT_CONSTRAINED=1` additionally exercises production JSON schema constraints.
Keep raw and constrained results separate. Do not compare results across devices
or quantizations as if only fine-tuning had changed. Existing parser, safety,
import, fallback and history regression suites remain required.

## POCO X7 Pro acceptance (pending physical access)

Install an appropriate test build over the compatible diagnostic lineage without
uninstalling or clearing data. Import the original Q4_K_M and candidate; record
APK commit, GGUF hashes/sizes, OS, battery, temperature and CPU backend/thread
settings. Disable network after installation. Run the existing AI diagnostics
`llm` mode to bypass quick/rule replies; export JSON for each model.

For each model perform at least three app-process cold starts and five warm runs
with identical prompts/output limits/context and similar thermal conditions.
Capture TTFT, native generated tokens/s, load time and peak RAM. Do not include
parser replies in model-speed averages. Run PL/EN prompts, missing-data cases,
proposal confirmations and a long conversation; cancel, release RAM, restart and
switch original → FT → LFM350M → original. Verify that events and history remain,
and that no proposal is replayed after reopening. Check that airplane-mode use
works without a download. Retain failed runs and error diagnostics.

A physical POCO test, actual base-vs-tuned metrics, real LoRA/GGUF artifacts and
quality acceptance are still required before v1.4.2 can be released.
