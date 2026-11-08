# Part 2 Beta 5 regression repair

Base: `32539d1605786a9ca851adc2511ed9d9e32c4a82`, Draft PR #20.

The original 17 new regression tests failed against Beta 4 before implementation.
The reported comma/conjunction/sentence batches were not routed as batches.
Consequently, a representative structured TEST B command was validated against
the complete request's first start time: 12:00 was compared with TEST A's 10:00.
This reproduces the `time` rejection without a model. No raw phone model JSON was
provided, so this is not a claim to have inspected the four real model outputs.

Batch parsing now finds a unique partition into complete event clauses, outside
quoted text. It preserves each clause's title/date/time bindings, checks explicit
counts and rejects incomplete, ambiguous or mixed-mutation lists. English date
commas and punctuation inside names are not event boundaries. Every clause passes
the existing validator before a complete proposal is returned. No field whitelist
was relaxed. Cross-event dates/times and invented optional properties remain
rejected. The 20-event limit and atomic IndexedDB commit boundary are unchanged.

Natural edits normalize supported synonyms, the target-time marker and the
explicit same-day suffix. The original ISO source date and stable event ID are
preserved. The previously working compound Edit sentence has a regression test.
Deletion shows one time range; Before/After remains available for edits.

Structured validation diagnostics contain stage, reason code, field name, expected
and received types, and operation count. They contain no field values or raw text.
Successful event validation is marked only after validation actually succeeds.

Verification covers all six reported PL/EN batch forms and eight edit forms via
the production assistant. Browser tests exercise the real drawer and IndexedDB:
cancel/confirm, exact stored values, conflict warnings, stable IDs/restart, and
complete create rollback when the second put throws. Inference is not exercised
in those tests. Existing Beta 4 generation/continuation/clipboard tests also pass.

CUDA/Vulkan/native pins, memory estimation and generation settings were not
changed. The user's 9/25 LFM3 offload and 365-token Qwen result are user observations,
not tests performed here. Real LFM3/Qwen inference, GPU performance and the full
200-case benchmark still require the user's models/hardware. No weights, APK,
Release, final version or PR merge are produced by this repair.
