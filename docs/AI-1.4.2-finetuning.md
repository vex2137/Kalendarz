# Calendar 1.4.2 fine-tuning audit and implementation

Status: development preparation, not a release or a trained production model.
See [the executable RTX 4060 procedure](../training/v142/README.md) for commands,
configuration, artifact paths and the unmeasured before/after table.

## 1.4.1 source provenance

The public `v1.4.1` tag and main pointed to
`ded3bdc5de00205987a0918b67145a96dc1c140f` at audit time. The checkout was clean.
All 388 tracked files match the public source tarball byte for byte; details and
archive SHA-256 are in [source-audit.json](../training/v142/source-audit.json).
The recovered package application source `1ea6f9e…` is unchanged through that tag;
subsequent changes concern documentation/CI. This is a suitable development base.
Downloaded runtimes/models and private signing inputs remain separate from source.
Existing 1.4.1 corrections have not been removed.

## Runtime and safety

- `modelAssistant.ts` first normalizes input and detects the actual message
  language, then tries quick responses and the deterministic calendar parser.
  Unhandled calendar requests use model JSON extraction; ordinary chat uses
  natural text generation. Benchmarks must distinguish `quick`, `rules`, `model`.
- `modelCommand.ts` defines the real JSON schema and rejects unknown fields,
  invalid dates/times, unsupported recurrence, invented identities and unsupported
  properties. `resolveModelCommand` prepares proposals, checks evidence and
  ambiguity, and keeps actual calendar writes behind the existing confirmation
  and transaction API. Training targets never claim that a proposal was saved.
- The parser handles Polish/English calendar fields, pending missing data,
  date arithmetic, clock ranges and ambiguity. Other supported UI languages,
  Russian and German, retain their existing paths. No parser logic is replaced
  by the model in this branch.
- `calendarSystemPrompt`/`assistantSystemPrompt` provide actual local dates,
  timezone and a short date table. The system instruction is primarily English,
  with localized examples/questions; model replies follow the user's language.
  This branch extracts the **unchanged** natural-chat string into a shared
  `naturalChatSystemPrompt`, so training and inference do not drift.
- `chatHistory.ts` stores all saved messages independently of model choice in
  IndexedDB `calendar-ai-chats` v1. Restored proposals are read-only; old confirm
  buttons are not replayed. Runtime context keeps up to four turns but inference
  selects the last user/assistant pair under a 1,200-character budget (500 for
  optional 2.6B). This is bounded conversation memory, not unlimited history or
  cross-chat retrieval. Fine-tuning cannot extend that application limit.
- `localModelRuntime.ts` uses descriptor context limits, streaming, cancellation,
  temperature 0, repetition penalty 1.05 and `enable_thinking:false` for `qwen35`.
  Plain chat normally gets 96 output tokens; structured calls retain larger
  budgets. Native CPU/GPU diagnostics and safe Auto-mode fallback are preserved.
- Native inference uses the existing llama.cpp b11669 commit
  `620d2225cc436ab0b001e3200e590e3b286ef9ab`; web uses wllama 3.8.1. A successful
  metadata import does not prove tensor/architecture support. Runtime loading
  remains a separate compatibility check, with truthful backend diagnostics.

## Models and tokenizer

The original default is Qwen3.5-0.8B Q4_K_M, 527,503,680 bytes, SHA-256
`2c49cd8cb9c15a451dd6087b8ae9676f1fc2556501bb0717cc1ba3fcae413c27`.
The optional IQ4_XS and LiquidAI LFM2.5-350M descriptors remain unchanged.
The source model is the official unquantized `Qwen/Qwen3.5-0.8B`, pinned at
`2fc06364715b967f1860aea9cf38778875588b17`, using `qwen3_5` conditional generation
with a vision encoder and hybrid DeltaNet/full attention. This is not a text-only
Qwen2/3 loader substitution. LoRA targets only the language backbone.

The reviewed official template uses Qwen message delimiters and an empty thinking
section when thinking is disabled. Earlier assistant turns are serialized as
history; only the final response is trained here. The pipeline loads the actual
pinned tokenizer/template and proves token-prefix alignment before masking labels.
No template is rewritten by hand. Real vocabulary/special-token/template hashes
and every example's token length must be verified by `preflight --tokenizer` on
the downloaded source; they were not measured in this restricted environment.
GGUF conversion checks the exported template and EOS against that tokenizer.
Actual GGUF tokenizer/generation equivalence still requires inference testing.

## Existing evidence and limitations

The original 432-record command dataset and 1.4.1 parser/PL/EN tests are retained.
That dataset has three-message extraction examples; its `multi-step` category
contains compound requests, not actual multi-turn role sequences. The new seed
adds real role-alternating conversations and plain-text responses, preserves
semantic family splits, and prioritizes Polish without dropping English.

Historical LFM350M native extraction evidence (22 prompts, 22 valid JSON,
8 matching intents, 1 exact extraction) is retained as LFM evidence only.
Schema validity is not task success. The 1.4.1 Linux LFM speed table's 30.6 token/s
is also separate from the user's reported POCO Qwen reference. No new real-Qwen
quality or performance baseline can be produced without the actual weights.

Known issues still include experimental POCO Vulkan, unverified RTX/other physical
GPUs, model-file/CDN availability under restricted networking, and the existing
Android diagnostic-vs-production signing lineage. Current work does not change
keys, package names, launcher labels or release package names.

## Completed work and remaining gates

A: source/runtime audit complete; real-Qwen baseline blocked by unavailable weights.
B: 388 generated/validated synthetic examples, 246/66/76 split; 28 independent
regression cases; source review complete, independent linguistic review pending.
C: pinned CPU-tested LoRA pipeline, official CUDA wheel profile, checkpoint resume,
loss logs, provenance, evaluation and conversion tooling prepared.
D: random tiny Qwen3.5 optimizer/resume/export/merge tests passed; **real 0.8B
training not run** (no CUDA and Hugging Face HTTP 403).
E: paired evaluator and human-review gates implemented; real before/after missing.
F: pinned merge/F16/Q4_K_M workflow implemented; real GGUF conversion/inference missing.
G: distinct checksum-based import/selection and future verified catalogue wiring
in place; existing history/safety/import tests exercised. The published trained
catalogue entry and real model/device acceptance remain pending the artifact.

The Web model-free build and TypeScript/native tests pass. GGUF import browser
coverage uses synthetic metadata and proves storage behavior only. The history
browser regression originally assumed Qwen was not already selected; it now
switches through 350M first to exercise the actual 1.4.1 default correctly.
See [verification.json](../training/v142/verification.json) for final results.

No production adapter, new GGUF hash, measured quality improvement, or physical
POCO result is claimed. No official v1.4.2 release is authorized or published.
