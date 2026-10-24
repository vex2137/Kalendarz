# Local multi-model assistant: implementation and device test record

Branch: `feat/local-ai-models-history`, based on `cc2cbfb` / draft PR #7.
The original bundled 350M remains the default and fallback. Existing prompts,
calendar schemas, PL/EN rules, model fixtures and calendar data are retained.
No training scripts or LoRA adapters were found in tracked files; this is not
evidence of fine-tuning. No APK or candidate weights are committed to Git.

## Verified model sources

Pinned revisions, exact bytes and SHA-256 are recorded in
`src/utils/modelRegistry.ts` and `docs/model-source-verification.json`.
Source verification: [Actions 40083841560](https://github.com/vex2137/Kalendarz/actions/runs/40083841560).

| Model | Exact GGUF bytes | Distribution | Status |
| --- | ---: | --- | --- |
| LFM2.5 350M Q4_K_M | 229,312,224 | Existing bundled official weights | Default / fallback |
| LFM2.5 2.6B Q4_K_M | 1,674,455,040 | LiquidAI official GGUF | Optional experimental download |
| Qwen3.5 0.8B Q4_K_M | 527,503,680 | mradermacher conversion | Optional experimental download |
| Qwen3.5 0.8B IQ4_XS | 488,114,496 | mradermacher conversion | Separate experimental option |

Qwen Q4_K_M exceeds 500 decimal MB. IQ4_XS saves 39,389,184 bytes (7.47%);
its quality is not assumed equivalent. The inspected official Qwen GGUF path
returned 401, so the UI explicitly identifies the third-party converter.
The cloud executor blocks Hugging Face downloads; Actions verified sources.

LFM1.0 requires license/attribution and separate permission above USD 10 million
annual commercial revenue: [official license](https://huggingface.co/LiquidAI/LFM2.5-2.6B-GGUF/blob/main/LICENSE).
Qwen upstream and the selected conversions declare Apache-2.0:
[upstream](https://huggingface.co/Qwen/Qwen3.5-0.8B),
[conversion](https://huggingface.co/mradermacher/Qwen3.5-0.8B-GGUF).
The model panel links sources/licenses. New candidates are not bundled.

## Actual cloud inference, not phone measurements

Installed wllama 3.8.1 executed all four exact GGUFs. The older successful
JSPI compatibility probes used three native inferences per model, with external
browser requests blocked. [Actions 40086640905](https://github.com/vex2137/Kalendarz/actions/runs/40086640905)
and `model-candidate-smoke.json` contain the generated outputs and metrics.
Separate runners are not a controlled performance comparison.

| Model | Cold raw total s | Warm raw total s | Tiny JSON total s | JSON native tok/s | PL / EN arithmetic |
| --- | ---: | ---: | ---: | ---: | --- |
| 350M | 5.368 | 0.668 | 1.386 | 29.653 | Wrong / correct |
| 2.6B | 65.105 | 18.216 | 218.865 | 3.606 | Correct / correct |
| Qwen Q4 | 16.043 | 2.745 | 13.897 | 2.740 | Correct / correct |
| Qwen IQ4 | 16.976 | 6.691 | 25.209 | 1.733 | Correct / correct |

These are compatibility probes, not a 200-case semantic quality score. The 350M
answered Polish arithmetic with “Two”. Its generated Polish conversation was
also awkward. LFM 2.6B has mandatory reasoning; a 96-token limit previously cut
off the answer. Its JSON probe used 766 tokens including reasoning: first native
token 6.727 s versus first answer token 213.763 s. Both timings are reported.
Production conversation now uses genuine text inference, rather than forcing
all casual questions through a calendar JSON schema. No canned chat is counted
as model intelligence. Destructive proposals require evidence and confirmation.

The follow-up [matrix 40092074751](https://github.com/vex2137/Kalendarz/actions/runs/40092074751)
passed all eight model/runtime combinations (JSPI and bundled compatibility
WASM), including actual production conversation: 32 native inferences, plus
the separate deterministic calendar route. See `model-runtime-matrix.json`.
Qwen Q4 originally hit the 256-token conversation limit, which was incorrectly
reported as an engine error. A brief-answer instruction now reduces verbosity;
length-limited plain text is retained with an explicit localized notice and
`outputTruncated` diagnostic. Partial calendar JSON remains an error.
Physical phone results and any default-model change remain pending.

## Runtime, storage and conversation history

Only one model is loaded at a time. Switching awaits unload. Downloads/imports
verify exact size/hash; large files stream through private OPFS. Cancel/failure
cleans partial downloads; Remove also clears orphan files. No candidate is
silently downloaded or substituted. Memory figures in the selector are estimates.
Interrupted load/generation is recorded so an OOM restart cannot automatically
reload the same large model; explicit retry/fallback remains available.
Idle, background and memory-pressure release retain installed weights.

Chat history uses a separate versioned local IndexedDB database. It supports
new/open/continue, automatic titles, rename, search, single/all deletion with
confirmation and explicit JSON backup/import. Model/route metadata is retained.
Messages are ordered by sequence, with paged reads. Only bounded recent context
is submitted to inference (a smaller bound for mandatory reasoning). Switching
models or UI language does not erase chats. Calendar action buttons expire when
reopened; historical proposals cannot replay mutations. Confirmation/undo results
are saved too. JSON imports are fully validated before writing, remap IDs and
cannot import executable actions; limits are 25 MB / 10,000 chats / 100,000 messages.
Exported history contains private conversations: keep that backup private.
Runtime diagnostics do not include message content; benchmark exports contain
only public fixtures and a synthetic calendar. No telemetry is uploaded.

Model information starts collapsed, remembers expansion, and keeps privacy and
source details available. Model/history controls have EN/PL/DE/RU translations.
Android, desktop and PWA use the same local history store; browser storage can
be cleared by the OS/user. Real Windows/macOS and physical Android checks are
not claimed by the Linux/cloud tests.

## Independent bilingual benchmark and limits

`tests/fixtures/assistant-bilingual-v2.tsv` freezes 100 new Polish cases and
100 English counterparts in conversation, intention, calendar operations,
search/availability, dates, context, colloquial language, typos and safety.
This is a development corpus, not a blind held-out evaluation.

Three modes are separate: rules/quick (no inference), LLM-only (same production
assistant prompt and schema for every case, no oracle route), full assistant
(actual routing, UI language opposite the message language). Automatic checks
cover intent and selected fields; conversation, meaning and safety also require
human review. “Automated cases passed” is not a semantic intelligence score.
The development rules-only run completed all 200 inputs, with 39 automated
passes and 92 manual reviews pending. This mixed corpus intentionally includes
many requests outside rule coverage; the result is not full-assistant accuracy.
A real 350M conversation, cancellation and resume were also tested in Chromium.
Full per-model semantic comparisons are pending; do not fill missing scores.

The complete 350M development run processed the same 200 inputs separately in
all three modes: rules 39/200; raw LLM 73/200; full assistant 89/200 automated
passes. All modes completed without engine errors; raw LLM made 200 genuine
inferences, full assistant 138 (62 requests used rules). Each mode still has
92 cases flagged for semantic review. These are conservative field checks, not
a claim of 44.5% human conversational accuracy. See
`assistant-bilingual-350m-results.json` for all responses, checks, model metrics
and conditions (source commit `8d6a7e5`). Common errors include wrong intent,
example-title/date leakage, incomplete fields and unresolved ambiguous targets.
The full assistant protects calendar writes with validation/confirmation; it
does not make the small model understand every difficult request.

The separate five-pair smoke comparison is in `bilingual-smoke-summary.json`
(source `a0ee7c7`, before the conversation length-limit fix). Read its completed
counts and stop/error fields, rather than interpreting a green Actions job as
semantic success. The current engine compatibility matrix is recorded separately.
These experiments do not justify changing the default model.

## POCO X7 Pro diagnostic procedure

1. Download the ZIP from the latest successful **Android AI diagnostics APK**
   Actions run for this branch while signed in to GitHub. Extract and install
   `Calendar-AI-diagnostics.apk` (separate diagnostic app ID, debug signature).
   Compare the full commit shown in AI diagnostics with `BUILD-INFO.json`.
2. Open Assistant, expand model information, select/download exactly one model.
   Check its identity/hash; enable airplane mode after installation. Keep the
   same device, WebView version, thread setting, battery/thermal starting state
   and foreground conditions for every candidate. Do not infer thread support
   merely from CPU count: export actual isolation, JSPI and native thread data.
3. Open AI diagnostics → Model benchmarks. First run 10 PL/EN smoke cases.
   Then run 200 cases in each separate mode: rules, LLM, full assistant.
   Keep the app visible. Runs start cold by unloading the engine. Export each
   result JSON and repeat with the next model. Do not clear history between
   model changes. Use the 40-turn stability preset for sustained inference.
4. Stop is immediate; partial results are checkpointed and can resume on the
   same model/commit. Backgrounding, memory or serious thermal pressure pauses
   the test. A process killed by Android leaves a resumable checkpoint. Engine
   errors stop further inference instead of repeating 200 failing loads.
5. Review generated Polish and English text manually for meaning, negation,
   invented titles/dates, ambiguity, pronoun targets and actual answer language.
   Routing-language checks alone are not language-quality judgments. Chat tests
   never execute calendar changes. Separately verify proposed changes in a test
   calendar and explicitly confirm them; check undo and reopen history.

JSON includes model revision/hash, source commit, engine settings, measured prompt-processing,
generation/total times, native TTFT and first answer token, threads, first versus
later responses, battery/thermal data where available, and app process CPU/PSS.
Android app PSS/CPU **exclude the isolated WebView renderer**. JS heap is not
WASM total RAM. Missing values and total inference CPU/RAM remain `null`.
Battery charge/energy deltas describe the whole device, not model-only energy.
Summary first/later response timings refer to actual LLM calls; per-case elapsed
times also cover quick/rules routes. The benchmark never exports private chat
prompts: generated responses and fixtures in its JSON are synthetic test data.

For optional fuller process measurements, connect ADB and identify the actual
WebView renderer PID(s) associated with this app. Do not count all renderers:

```sh
python3 scripts/benchmark-android.py --renderer-pids 12345 --duration 600 --output poco-qwen-q4.json
```

The sampler reads process memory/CPU and device battery state only, stores local
JSON/JSONL, and uses no root or network upload. PID 12345 is an example. Keep
its time series alongside the app JSON; renderer attribution must be verified.
No physical POCO, battery, total RAM or sustained thermal result is supplied by
this cloud environment. Keep 350M as default until those tests and human review
justify a recommendation.
