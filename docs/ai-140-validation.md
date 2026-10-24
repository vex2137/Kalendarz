# AI 1.4.0 candidate validation record

Environment: Linux cloud, Node 24, Chromium; no physical POCO, Windows or macOS.
These checks do not establish phone latency, thermal behavior or semantic accuracy.

## Executed checks

- TypeScript: passed.
- Unit suite: 116/116 passed, including existing data/confirmation safeguards,
  explicit PL/EN ranges, midnight, language changes and context routing.
- Local web asset compilation: passed with both WASM runtimes and the OPFS worker.
  Local compilation did not include weights; the full weight-bearing production
  build and signature/provenance verification ran in GitHub Actions.
- History browser flow: passed new-from-history, reused empty draft, old/new chat
  switching and restart, rename/search, individual/all deletion, cancel deletion,
  JSON export/import through the UI, model switching, expired actions and undo.
- Settings browser flow: passed at 360/1280 px in EN/PL/DE/RU, including preserved
  scroll/draft, focus, keyboard tabs, Esc and the cancelable Android Back event.
- Production routing browser flow: 36 quick/rules messages across four UI
  languages passed locally; the APK regression adds one genuine 350M call.
- Synthetic storage browser checks: passed download/import and HTTP, short-file,
  checksum, quota and cancellation errors with both createWritable and the forced
  sync worker. No partial files remained. These fixtures are not real GGUFs.
- General web E2E: passed event CRUD/persistence, confirmation-independent data
  validation, imports/sync, dialog focus, existing PIN behavior, responsiveness at
  320/390/768 px, 10k-event agenda and offline reload/lazy assets.
- Linux packaged Electron: passed in Actions after updating the shared native
  cold/warm probe to open the new AI settings tab. It used real bundled GGUF
  inference with HTTP blocked. The first CI run failed because its old test
  selector expected the removed inline model panel; this was a test migration.

## Real model evidence in this task

Final candidate: [successful Actions run 40104360806](https://github.com/vex2137/Kalendarz/actions/runs/40104360806),
[verified APK ZIP artifact](https://github.com/vex2137/Kalendarz/actions/runs/40104360806/artifacts/12564357077).
APK source commit: `944f82db1bc6634c3a788cf1d99542f1726ab407`.
ZIP: 236,141,388 bytes, SHA-256
`988afcf9e9749bdf9ea24ffbca56cb4463a62eb11cac2ec4709e07adc73b6d8c`.
The artifact was confirmed present/unexpired through the Actions API. It contains
the 236,047,056-byte signed diagnostic APK, BUILD-INFO.json, APK SHA256SUMS.txt,
bundled verified 350M/license, POCO instructions and browser/model/source reports.
Both web and packaged Linux Electron checks also passed for this source commit.
Documentation-only commits after it do not change the APK application code.

[Successful initial APK acceptance](https://github.com/vex2137/Kalendarz/actions/runs/40103488313)
verified embedded 350M, actual model routing, model source metadata and a live
Qwen IQ4_XS UI download/import/offline generation/fallback flow. The artifact was
confirmed present, 236,141,331 ZIP bytes, SHA-256
`1f55aa089fea5ac25f2d8daf396464622bf3c4567cca3a2c813d6591c93a4660`.
It was built from `5b3a3d8edbac3ca2ae9eed1bf78e38afc51ed7ba`; use the latest
successful branch run for the final candidate and compare its BUILD-INFO.json.

All four pinned revisions, sizes and upstream SHA-256 metadata matched. In this
task the actual bundled 350M and optional Qwen 0.8B IQ4_XS executed. The IQ4_XS
test used the production UI with createWritable disabled, imported the exact
488,114,496-byte file, rejected a wrong GGUF, reloaded offline and required native
completion tokens with the exact selected model ID. A later test revision also
checks ordinary conversation after an unconfirmed calendar proposal.

Manual reading of the `119c4b6` UI run confirms an English conversational reply:
“Yes, that sounds much better in English!” (10 native tokens, four threads).
The subsequent arithmetic request, “What is two plus two? Answer briefly.”,
received “$4 + 4 = 8$.” This is a semantic failure, despite a successful
installation/native inference test. Both runs took roughly 40–43 seconds including
cold reload/verification on that cloud runner; these are not POCO timings or a
controlled comparison. The functional test deliberately requires real native
metrics, not a fabricated correct answer or a rule-based arithmetic substitute.
The final `944f82d` run reproduced both outputs with ten tokens each and four
threads, taking 40.14 and 42.42 seconds respectively. Treat the arithmetic result
as a confirmed remaining quality error, not a successful reasoning check.

Qwen Q4_K_M and LFM 2.6B were not newly downloaded/inferred in this task. Their
previous genuine eight-combination JSPI/compatibility matrix is retained in
`multimodel-progress.md`; metadata rechecking is not an inference rerun. No
full 200-case benchmark or stability benchmark was repeated. The earlier
39/73/89 automated results out of 200 have no new comparable score here.

## Release decision

Diagnostic candidate only. Physical POCO acceptance, system Files provider,
real Android Back gestures, actual OOM/background recovery, sustained battery/
thermal/renderer RAM and human language/intent review remain pending. Known
small-model date/title/intent limitations remain; general model intelligence is
not fixed by these regressions. Links accept audited catalogue artifacts only.
All themes reuse existing styles, but a full physical theme matrix is pending.
No official release, merge, force push, signing-key replacement or 1.5.0 feature
was performed. Follow `ai-140-acceptance.md` before approving stable 1.4.0.
