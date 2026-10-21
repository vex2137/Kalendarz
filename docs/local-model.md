# Offline language model

The assistant interprets requests with the official **LiquidAI LFM2.5 350M Q4_K_M GGUF** using [wllama](https://github.com/ngxson/wllama), a WebAssembly binding of llama.cpp. It does not call a remote inference service. Both the main and compatibility WASM builds ship inside the application; no runtime CDN is required.

Open the assistant or Settings to download the optional 229,312,224-byte model. The UI displays download and verification progress and allows cancellation. Alternatively, import the exact official GGUF. Its size and SHA-256 are checked before an atomic IndexedDB save and again before loading. Interrupted or invalid downloads do not replace an installed model. The model is separate from calendar backups and QR synchronization.

- Source: [LiquidAI/LFM2.5-350M-GGUF](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF)
- Revision: `bb7ee58b243e4cede04187e323e760b04f8a0091`
- File: `LFM2.5-350M-Q4_K_M.gguf`
- SHA-256: `7e6f72643caafc9a68256686638c4d7916f2cec76d1df478d4c3ddcd95a6aed4`
- Weights license: [Liquid AI LFM License 1.0](https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/blob/main/LICENSE). Engine/bindings: MIT. Review the weights license for your distribution/use case.

After installation, inference reads only local weights. Prompts and calendar data are not uploaded. App-data removal also removes the model. Browser storage persistence is requested, but the browser or OS can still clear app storage; re-import or re-download if necessary. In Flatpak, existing network isolation remains unchanged: download the GGUF in a browser and import it through the file picker.

The portable CPU SIMD path runs in a worker so the interface remains responsive. It uses a 2,048-token context, batches of 128/64, one inference at a time, and at most four CPU threads where cross-origin isolation permits; otherwise it uses one. Model memory is released after one minute of inactivity. The compatibility build supports WebViews/browsers without JSPI/memory64, with lower performance. Actual memory use and latency depend on the device; no fixed RAM or speed guarantee has been measured yet.

The model produces schema-constrained JSON. The adapter validates dates, times, action names and fields; it uses existing event validation, transactional writes, stale-preview protection and undo. The current local date/time and a dated weekday table are included in the prompt. Existing calendar tools calculate availability, recurrence, conflicts and batch plans. They are not presented as model inference. Creation and edits require review; deletion has an explicit deletion confirmation. Ambiguous matches are not changed. Recurring-event editing/deletion must use the existing event editor to choose the operation scope.

Try Polish commands such as “Dodaj dentystę jutro o 15:00”, “Przenieś dentystę na 2026-11-03 o 14:00”, “Znajdź dentystę” and “Usuń dentystę”. The official model card does not list Polish or Russian among its primary languages: correctness must be measured with real weights, and ambiguous output is rejected rather than applied silently.

## Verification

`tests/model-command.test.ts` checks adapter validation, midnight rollover, edits, deletion/undo and invalid model files. These tests do **not** measure the model's recognition quality.

The real-model browser test requires the official weights:

```sh
CALENDAR_MODEL_FILE=/absolute/path/LFM2.5-350M-Q4_K_M.gguf npm run test:model
```

This test must fail if weights are absent or the checksum is wrong. It imports actual weights, disconnects the browser from the network, submits Polish commands through the assistant, checks proposals and persisted calendar changes, and reloads offline to verify model persistence. No canned model responses are used. Platform-specific runs remain necessary on Android WebView and packaged Electron on Linux, Windows and macOS before claiming full compatibility.
