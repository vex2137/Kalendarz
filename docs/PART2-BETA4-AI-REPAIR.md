# Part 2 Beta 4: one repair round

Based on tested `4cebce014591871990540d0506f981b2d0105450`. PR #20 stays Draft.

Changes: date/time evidence now separates source and destination; exact/partial
lookups and edits use the same records and stable IDs. Explicit multi-event
commands produce a whole validated proposal with conflict warnings and a cancel
action. Ambiguous targets support numbered selection; spoken PL/EN ordinal dates
and the reported spelling/time-marker cases are covered. Existing IndexedDB
transaction/optimistic checks remain the write boundary; model text never commits.
Unconfirmed proposals and pending choices are not restored as executable plans.

Generation preferences persist per model (Auto or 1–4096). Explicit benchmark
budgets stay separate. Context can reduce output; input-token budgeting is an
estimate, clearly separate from measured usage. Native Android/desktop validate
the same output ceiling. Continuation keeps the preceding answer, not the app's
truncation notice. Diagnostics distinguish limit, stop, cancellation and error.
The complete JSON view has a copy button and success/failure feedback.

LFM3 memory uses actual GGUF KV head arrays, SWA pattern/window and convolution
metadata, following b12189's per-layer layout and 256-cell padding. SWA includes
the configured 64-token microbatch. Recurrent state has a conservative allowance;
this is still an estimate. Unknown layouts retain the conservative fallback.
The 384 MiB backend allowance and 256 MiB reserve remain. Native pins/flags,
CUDA → Vulkan → CPU fallback and offload evidence checks are preserved.

Benchmark fixes retain end time/all-day/recurrence from validated proposals,
require a proposal for mutation cases, assign explicit quick-route intent and
prevent arbitrary query text from satisfying mutation field checks. Fictional
calendar isolation is unchanged; no benchmark path writes the real calendar.

Local verification: 216 TypeScript tests; 54 Node tests passed with one optional
actual-binary check deferred to package validation; 27 Android JVM tests using
Android-compatible JSON; 21 Python guard/version tests; typecheck and four browser
scripts passed. Browser coverage includes real IndexedDB create/edit/delete,
pre-confirm/cancel safety, full rollback after a stale member, restart persistence,
generation budgets/continuation and clipboard success/failure. Native inference
in those tests is mocked. The month/week/day UI and existing data formats remain.

Limits: no benchmark result JSON was attached, no weights/GPU are available here,
and no real 200-case model benchmark, RTX 4060 offload or physical POCO test was
performed. Recurring-instance edit/deletion scope still requires the existing
event editor. Unsupported/ambiguous free-form commands still need model extraction
or clarification; this round does not claim all 200 cases are semantically fixed.
Full Android SDK compilation is not covered by the pure JVM tests. No weights,
drivers or user data changed. A Linux-only Actions test artifact may follow;
no APK, tag, stable release or PR merge is authorized by this packaging path.
