# Local assistant optimization

This work starts at `4d3b5ef89e8924ad4f040a3a1c0e95e309e5b0eb` on `fix/assistant-greetings-and-prompt-cache`. The branch was fetched successfully with network access enabled for the command; the initial proxy failure came from the restricted command sandbox. The original checkout was clean. Changes live on `optimize/lfm25-parser-runtime`. No application release is created.

The unpushed `c34381c` objects and bundle were not available in this environment. This implementation does not copy that parser. The earlier 22/60 result was from a different dataset and is not the baseline for the table below.

## Routing and correctness

Exact social replies remain local in English, Polish, Russian and German. A bounded PL/EN parser handles explicit create, move, rename, delete, search, agenda and availability requests. It accepts polite/colloquial prefixes, Polish inflections through the existing calendar search, unaccented spelling, explicit/month/relative/weekday dates, AM/PM, noon/midnight, clock ranges, durations, all-day requests, labelled optional text and a trailing location after a clock. Quoted title words do not become dates. A missing date/time can be supplied in the next message. Event names keep their original spelling.

Unknown constraints, negations, recurring requests, ambiguous/multiple dates and unsupported constructions retain real offline GGUF extraction. The adapter rejects invented titles and unmentioned optional details. Negated/hypothetical requests cannot propose mutations. Duration arithmetic uses the calendar's dates and preserves an existing event's duration unless a new duration is supplied. An inverted clock range requires clarification rather than an assumed overnight event.

Both paths call `resolveModelCommand`, existing recurrence-aware calendar tools and event validation. Proposals never save automatically. Deletion requires confirmation; ambiguous matches and recurring-series changes keep the existing editor safeguards. Undo and stale-preview checks remain intact. Russian and German retain their model/tool paths.

## Model lifecycle and measurements

Opening an enabled assistant schedules shared model initialization after 300 ms. Requests join that initialization; quick replies do not await it. The verified model remains resident for five idle minutes while the drawer is open/visible, or 30 seconds when closed/hidden. Requests renew the idle period. Closing/visibility changes cancel pending inference; page exit, Android memory pressure and explicit release dispose workers safely. Initialization and teardown are serialized. SHA-256 verification remains mandatory; bounded verification chunks increase from 1 to 4 MiB.

Context stays at 2,048 tokens with batch/micro-batch 128/64 and a CPU WASM backend. At most four threads are selected, using 1/2/4 based on available cores, isolation, SharedArrayBuffer and the browser's memory hint. Missing isolation or low reported memory uses one thread. Failed threaded initialization retries once on one thread. Production output is bounded to 256 tokens, or 384 for descriptions. This does not change or fine-tune the official LFM2.5-350M Q4_K_M weights.

Android's Capacitor plugin installs its WebView client during plugin registration, before `loadWebView()`. It preserves Capacitor navigation and interception and adds COOP/COEP/CORP only to responses for the packaged `https://localhost` origin. Headers permit, but cannot guarantee, pthread support on a particular WebView. Other origins are unchanged.

Diagnostics retain the last 30 numeric measurements in memory. They report storage/read, SHA verification, initialization, total/load/first-content time, native prompt/generation time, native token/cache counts, tokens/s, configured and actual threading, isolation, JSPI and browser/device hints. No prompts or calendar contents are exported. Preloading has a separate measurement; a request joining it reports its own wait time. Failed/cancelled inference is marked rather than reported as a successful response.

## Reproduction and interpretation

`tests/fixtures/assistant-evaluation.json` contains 61 new paired Polish/English scenarios (including two two-message scenarios per language). Names deliberately stay the same between languages so the comparison measures extraction rather than translation. Fixture SHA-256: `3d5d1c3dd461cc42f4b19bea7efb714681f47aa2953173283eb86f5b73373327`.

The fixture was written before the parser and then used during development. It is a development evaluation, not a blinded independent holdout or proof of general language competence. Event fields, identity, duration, location/description, specified read-only output and clarification behavior are scored. The conflict and open-ended hypothetical cases check non-mutation/error-free behavior only, rather than the semantic quality of their prose. Unrouted cases execute the actual model. Separate runtime/device tests bypass rules and execute GGUF directly. No model responses are mocked. External HTTP destinations are blocked during evaluation; bundled GGUF size and SHA-256 were verified after extracting it from the existing official APK.

The unchanged baseline uses a separate detached checkout of `4d3b5ef`, plus the same test harness. The comparison explicitly selects one CPU thread in both browser contexts because the original three-thread configuration timed out on this executor. A separate two-thread real-model probe validates the new selection and lifecycle. These Linux Chromium measurements are not physical-phone benchmarks.

```sh
npm run build:evaluation
npx vite preview --host 127.0.0.1 --port 4181
EVALUATION_THREADS=1 EVALUATION_OUTPUT=/absolute/path/results.json npm run test:assistant:evaluation
EVALUATION_THREADS=2 npm run test:model:runtime
CALENDAR_MODEL_FILE=/absolute/path/LFM2.5-350M-Q4_K_M.gguf npm run test:model
```

The evaluation build adds its test page only when explicitly using `build:evaluation`; ordinary `npm run build` does not ship it. `EVALUATION_RAW=1` bypasses application routing to test extraction directly; do not label hybrid scores as unaided model accuracy.

## Results

Both full browser evaluations completed 61 scenarios per language, with zero JavaScript page errors and zero external requests. The same official GGUF and fixture checksum were used. [Machine-readable summaries](assistant-evaluation-results.json) retain every scenario result.

| Language | Baseline scenarios passing | Optimized scenarios passing | Baseline GGUF calls | Optimized GGUF calls |
| --- | ---: | ---: | ---: | ---: |
| Polish | 18/61 (29.5%) | 61/61 (100%) | 63 | 2 |
| English | 21/61 (34.4%) | 60/61 (98.4%) | 62 | 2 |

There are more baseline calls than scenarios because two scenarios have follow-up messages. All 59 explicit simple scenarios now take rule/quick routes. The two other scenarios in each language still invoke real GGUF. English `e60` remains a failure: “Do not delete Dentysta, just tell me when it is” causes the model to propose a mutation internally. The adapter blocks it and asks for clarification instead of returning the requested event information. Nothing is changed. The open-ended hypothetical case only passes the safety/non-mutation criterion; this does not establish a useful or correct natural-language answer.

| Language | Baseline median pipeline time | Optimized median pipeline time | Baseline mean including cold calls | Optimized mean including cold calls |
| --- | ---: | ---: | ---: | ---: |
| Polish | 11,872.24 ms | 0.49 ms | 12,593.66 ms | 1,320.45 ms |
| English | 10,924.42 ms | 0.41 ms | 15,007.08 ms | 1,186.51 ms |

These timings measure the assistant pipeline in Chromium, excluding UI interaction/rendering. They are single passes on a shared Linux executor with two CPU cores of quota. Background validation/build work ran during portions of the baseline. They indicate the routing effect, not an isolated microbenchmark or a device-wide speed guarantee. Actual UI rule responses in the Polish offline regression were about 0.2–0.3 seconds. Cold GGUF remains expensive: a separately logged full-prompt Polish diagnostic spent about 67.5 seconds in prefill and 9.9 seconds generating output, during concurrent validation. Preloading model initialization does not pre-cache that full system prompt.

The focused two-thread runtime probe passed real cold/warm inference, shared initialization, rejection of a concurrent second request, quick replies while preloading, active-request cancellation on memory pressure and 30-second closed-drawer disposal. Its small-prompt cold/warm calls took 16.32/1.54 seconds, with a maximum UI frame gap of 66.7 ms. This probe uses a deliberately small prompt and is not comparable to the full calendar extractor's cold latency. Native timing/token fields and cache reuse were checked directly.

The same probe also passed with the isolation headers removed from the main document: SharedArrayBuffer was unavailable, the engine selected one thread despite two reported cores, and cold/warm times were 18.75/2.43 seconds (maximum frame gap 83.4 ms). This verifies the browser fallback; it is not an Android WebView measurement.

Validation also passed TypeScript, 97 unit tests, general browser regressions (including offline reload and calendar persistence), full Polish/English model-browser regressions with direct GGUF probes, and Android diagnostics compilation. Windows, packaged Electron and a physical Android device were not rerun in this environment. Existing packaged/Android regression scripts now require direct diagnostic GGUF calls so a successful rule route cannot masquerade as inference validation.

## Physical POCO X7 Pro

No physical POCO is attached. In the built application, open **Assistant → AI diagnostics → Device test: cold + warm**, first in automatic mode and then with **Compare with one CPU thread**. Use airplane mode after installation. Export JSON after each test. These calls do not create calendar records. Record Android/System WebView versions, available RAM, battery/thermal conditions and whether the app was newly opened. A low-memory notification can interrupt inference safely; it is not evidence that every Android version delivers that notification in time to prevent OS termination.

The `diagnostics` Android build type uses `com.kalendarz.offline.diagnostics` and a debug signing key, alongside the existing installation, with separate app data and launcher label. Build it with `npm run build`, `npx cap sync android`, then `cd android && ./gradlew :app:assembleDiagnostics`. It is a test installation, not a new application release. For ADB tests set `MODEL_TEST_ANDROID_PACKAGE=com.kalendarz.offline.diagnostics`; the main activity keeps its original class name.

Android compilation verifies the integration APIs but does not establish physical WebView threading or POCO latency. Those require an actual device run.
