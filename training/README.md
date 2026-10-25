# Calendar command SFT / LoRA

This is a reproducible preparation pipeline, not a tuned production model.
No application weights or defaults are changed by any script here.

## Model identity

The application keeps its existing default **Qwen3.5 0.8B Q4_K_M**, pinned in
`src/utils/localModelManifest.json`. The upstream checkpoint is
[`Qwen/Qwen3.5-0.8B`](https://huggingface.co/Qwen/Qwen3.5-0.8B), Apache-2.0,
revision `2fc06364715b967f1860aea9cf38778875588b17`. Its
[configuration](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/2fc06364715b967f1860aea9cf38778875588b17/config.json)
uses `qwen3_5` / `Qwen3_5ForConditionalGeneration`, including a vision encoder.
The pipeline uses Transformers' image-text-to-text loader with text-only input
and limits LoRA to language attention projections; the vision encoder is frozen.
The existing [GGUF quantization](https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF/tree/78fc4c891ff7dee2e8286c3f4cdc8a26f7544a07)
contains Q4_K_M. Train the original checkpoint, never that quantized GGUF.

The optional 350M model is **LiquidAI LFM2.5**, with its own LFM1.0 license.
No reviewed Qwen3.5 350M checkpoint was established. Nothing renames that fallback.

## Data

```sh
npm run ai:data
npm run ai:data:validate
```

The deterministic generator creates **432 synthetic records**, 72 bilingual
source templates grouped into **42 related-template families**. Splits contain
264 training, 78 validation and 90 test records. Equivalent/paraphrased families,
including language/context variants, stay together. Checksums are in the generated
manifest. Generated JSONL is ignored by Git; sources and validators are committed.

Coverage includes creation, search, identity-preserving edits, deletion proposals,
reminders, recurrence, Polish inflection, English, abbreviations, ambiguous typos,
multi-step requests, impossible dates/times, and clarification. Year rollover,
Warsaw DST and New York leap-day contexts use the same runtime system prompt as
the application. Targets use its actual validated JSON contract, including
`reminderMinutes`; there are no direct database writes or success claims.
Unsupported multiple-reminder/recurrence scopes ask for clarification or the editor.

This is a **seed dataset**, below the requested 2,000–5,000 examples. Expand it with
independently reviewed scenario families rather than multiplying names/dates.
Schema validity does not establish linguistic quality. Review templates and holdout
coverage before a production experiment; don't use private calendar/history data.

## Environment and training

Use Python 3.12 and a dedicated environment. Tested tooling: torch 2.14.1 CPU,
Transformers 5.20.2, PEFT 0.21.2, Accelerate 1.15.0, Datasets 5.1.0.

```sh
python3 -m venv .venv-training
. .venv-training/bin/activate
pip install torch==2.14.1 --index-url https://download.pytorch.org/whl/cpu
pip install -r training/requirements.txt
python training/test_pipeline.py
```

For real training install the torch build matching the actual CUDA hardware.
Fetch the pinned original checkpoint into the Hugging Face cache on a machine
with authorized network access (approximately 1.5 GB language weights plus vision
weights/configuration). The default configuration uses `local_files_only: true`
and does not initiate a download. You can instead point `model` at a local
snapshot directory. Keep its license and provenance.

```sh
python training/train.py --config training/lora-config.json
python training/train.py --config training/lora-config.json \
  --resume training/runs/calendar-qwen35-08b/checkpoint-25
python training/export_adapter.py training/runs/calendar-qwen35-08b \
  training/exports/calendar-qwen35-08b-run1
```

Training is bounded to 200 optimizer steps by default, with checkpoints every 25.
Prompt labels are masked; only the assistant JSON contributes to loss. Overlong
records and incompatible template boundaries fail rather than silently truncate
the target. Resume verifies dataset and model configuration, and restores optimizer
and scheduler state. Existing runs/exports are not overwritten by default.
`run-metadata.json` records versions, model revision, trainable targets, and data
hashes. CPU real-model training is possible but not recommended for this session's
time budget; float32 is needed if the CPU lacks suitable bf16 support.

## Evaluation and export

```sh
python training/evaluate.py --output training/runs/base-evaluation.json
python training/evaluate.py \
  --adapter training/runs/calendar-qwen35-08b/adapter \
  --output training/runs/adapter-evaluation.json
```

The evaluator records JSON syntax, contract validity, intent, exact extraction,
date/time/query/recurrence/reminder field matches, and category/language breakdowns.
It uses unconstrained generation so JSON weaknesses remain visible. Exact-match
clarification scores are intentionally strict about wording; inspect those results
alongside intent and application safety tests. `--predictions` scores a JSON list
of existing output strings without loading model weights. It never touches a calendar.

For bounded evaluation of an existing catalogue GGUF through the desktop runtime
(including its production schema-constrained decoding):

```sh
NATIVE_MODEL_ID=lfm2.5-350m-q4-k-m CALENDAR_MODEL_FILE=/path/to/LFM2.5-350M-Q4_K_M.gguf \
  node --import tsx training/evaluate-native.cjs
```

This defaults to one record per held-out category/language, with a hard record
budget. `SFT_FULL_TEST=1` selects the complete test split. It records a baseline,
not a tuned model; JSON constraints are reported separately from extraction quality.

Compare both reports on the same held-out IDs and source revision. Additionally
run `npm test`, `npm run test:native` and real native model lifecycle tests. Review
destructive-action confirmation, missing information and false execution claims
in the actual application. Do not replace the default without measured improvement
and regression checks. Adapter merging and conversion/quantization require a
separate validated export with the pinned llama.cpp tools; an adapter directory
cannot be selected as a standalone GGUF in Calendar.

## What was actually run

Both dataset validators passed all 432 records. Three offline Python pipeline tests
passed, including two optimizer steps with a checkpoint resume, evaluation and
adapter export on a **tiny randomly initialized Qwen3.5 architecture**. This proves
pipeline plumbing and compatibility of the selected loader/PEFT targets. It does
not demonstrate learning or accuracy on Qwen3.5 0.8B.

The real Qwen checkpoint was unavailable to this workspace because Hugging Face
is denied by its network policy. There was no production-model fine-tuning,
base-vs-adapter quality comparison, or new production model. The existing default
and downloaded-model identities remain unchanged.

An additional real CPU extraction baseline with the existing LFM2.5 350M GGUF
used 22 held-out synthetic prompts: 22 valid JSON outputs, 8 matching intents,
and 1 exact extraction. See `evidence/base-350m-summary.json`. This deliberately
includes difficult ambiguity/recurrence cases; it is not a Qwen baseline or a
fine-tuning comparison. Schema-constrained JSON alone does not establish accuracy.
