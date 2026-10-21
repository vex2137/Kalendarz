# Offline language model

The assistant interprets requests with the official **LiquidAI LFM2.5 350M Q4_K_M GGUF** using [wllama](https://github.com/ngxson/wllama), a WebAssembly binding of llama.cpp. It does not call a remote inference service. Both the main and compatibility WASM builds ship inside the application; no runtime CDN is required.

Every build includes the 229,312,224-byte official model in `models/`, on Android, Windows, Linux and Web/PWA. No manual model import or separate download is needed. Build preparation uses `CALENDAR_MODEL_FILE` when provided; otherwise it fetches the pinned Hugging Face revision, verifies size/SHA-256 and stages the weights with their license. Invalid/missing weights fail the build. Generated weights stay out of Git.

The Web service worker precaches the model for offline reload. The initial PWA installation therefore transfers roughly 250 MB and needs enough browser storage; wait for service-worker installation before disconnecting. Native/desktop packages contain the model at installation. Existing verified IndexedDB model copies remain usable; new installations read the packaged model directly without making a second 229 MB IndexedDB copy. Bundled weights cannot be removed through the downloaded-model removal control. Recovery import/download controls remain available if the bundle is missing. Inference verifies the actual GGUF checksum before loading.

- Source: [LiquidAI/LFM2.5-350M-GGUF](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF)
- Revision: `bb7ee58b243e4cede04187e323e760b04f8a0091`
- File: `LFM2.5-350M-Q4_K_M.gguf`
- SHA-256: `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`
- Weights license: [Liquid AI LFM License 1.0](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/blob/main/LICENSE). Engine/bindings: MIT. Review the weights license for your distribution/use case.

After installation, inference reads only local weights. Prompts and calendar data are not uploaded. App-data removal removes imported model copies; installed native/desktop packages retain bundled weights. Browser storage persistence is requested, but the browser or OS can still clear app storage; re-import or re-download if necessary. In Flatpak, existing network isolation remains unchanged: use the model already included in the package.

The portable CPU SIMD path runs in a worker so the interface remains responsive. It uses a 2,048-token context, batches of 128/64, greedy decoding, one inference at a time, and at most four CPU threads where cross-origin isolation permits; otherwise it uses one. Vite development and preview servers send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Configure those headers on a production web host to enable threading there too. A host without them still uses the single-thread path. Model memory is released after one minute of inactivity. The compatibility build supports WebViews/browsers without JSPI/memory64, with lower performance. Actual memory use and latency depend on the device; no fixed RAM or speed guarantee is provided.

The model produces schema-constrained JSON containing only specified fields. Clear imperative prefixes narrow the allowed actions; negated, revised and indirect requests retain the full action vocabulary. English uses English prompt examples; the compact prompt limits prefill work. The adapter fills omitted or blank nullable text fields with `null` and validates actual dates, times, action names and fields. It rejects invented all-day status, recurrence, location, description and explicit clock values. End times and end dates supplied without evidence in the request are ignored: the calendar supplies the one-hour default or preserves the original duration. Generic event nouns in search queries are removed only when the complete query has no match. Relative-date suffixes leaked into event names are removed; explicitly quoted names are preserved. Search date filters require a date phrase in the request, so an invented model date cannot hide matching events. Single-day title searches exclude later events while retaining events spanning the requested day. Existing event validation, transactional writes, stale-preview protection and undo still apply.

The current local date/time, a dated weekday table and recognized date calculations from the existing calendar parser are supplied to the model. History uses actual user/assistant roles, with the previous extracted command as context. Date accuracy therefore measures the integrated model and calendar tools, not unaided model arithmetic. Existing calendar tools also calculate availability, recurrence, conflicts and batch plans. They are not presented as model inference. Creation and edits require review; deletion has an explicit deletion confirmation. Ambiguous matches are not changed. Recurring-event editing/deletion must use the existing event editor to choose the operation scope.

Try Polish commands such as “Dodaj dentystę jutro o 15:00”, “Przenieś dentystę na 2026-11-03 o 14:00”, “Znajdź dentystę” and “Usuń dentystę”. The official model card does not list Polish or Russian among its primary languages: correctness must be measured with real weights, and ambiguous output is rejected rather than applied silently.

## Verification

`tests/model-command.test.ts` checks adapter validation, midnight rollover, edits, deletion/undo and invalid model files. These tests do **not** measure the model's recognition quality.

The real-model browser test requires the official weights:

```sh
CALENDAR_MODEL_FILE=/absolute/path/LFM2.5-350M-Q4_K_M.gguf npm run test:model
```

This test must fail if weights are absent or the checksum is wrong. It starts with a fresh profile and uses the actual bundled weights without importing them, disconnects the browser from the network, submits Polish commands (or English with `MODEL_TEST_LANGUAGE=en`) through the assistant, checks proposals and persisted calendar changes, and reloads offline to verify model persistence. Cases cover create/edit/search/delete/undo, preserved duration, tomorrow, the day after tomorrow, a weekday, midnight/month rollover and Warsaw's daylight-saving transition. It checks that no external requests occur and reports response latency, token counts and the longest animation frame during inference. No canned model responses are used. Selected real bundled-model inference scenarios passed in Android 15 WebView (Polish/English) and packaged Linux Electron (English). Physical phones and packaged Windows/macOS inference still need separate device validation; these checks do not establish full platform compatibility.


For the installed debug Android APK, connect an adb device with WebView debugging enabled and run:

```sh
CALENDAR_MODEL_FILE=/absolute/path/LFM2.5-350M-Q4_K_M.gguf npm run test:model:android
```

Set `ADB` if adb is not on PATH and optionally `ANDROID_SERIAL` to select a device. This test blocks network access and uses the weights shipped inside the APK in the actual System WebView, and checks Polish and English creation, confirmation, exact dates/times and persistence. It changes the test app's language and creates two events; use a dedicated test installation. APK compilation alone does not establish successful inference or acceptable latency on Android. See [the verification report](local-model-verification.md) for measured results and platform limitations.

## Conversation routing and prompt reuse

The bundled model is LiquidAI's pretrained instruction-tuned LFM2.5-350M; this integration does not fine-tune its weights. Polish is not listed among its primary supported languages. Selected command tests do not establish general conversational competence.

Exact greetings, thanks and requests for help use localized deterministic replies instead of asking the model to emit a calendar action. Exact built-in schedule/free-time/conflict shortcuts use the existing calendar calculations, without proposing calendar mutations. Other calendar requests still use real model extraction and retain confirmation requirements. These routes are application behavior, not evidence of additional model training.

The shared system prompt contains the current day and timezone, while minute-sensitive requests carry the current clock in their user message. A changing minute no longer invalidates almost the entire prompt prefix on every request. Actual weights verify reuse after advancing the clock by two minutes. Cache reuse requires the model to remain loaded; cold starts, idle unloading, different dates and memory pressure still cost time. Android WebView without cross-origin isolation uses one CPU thread. Physical-device latency remains unverified after this patch.

Numeric performance logs report thread count, isolation, load/total milliseconds and prompt/cache/output token counts; they do not log requests or calendar contents.
