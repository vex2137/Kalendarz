# Part 3 Beta 2 checkpoint

Based on accepted Part 3 Beta 1 (`8853d8a`); PR #21 remains Draft.

- Copy controls now share the last text line: 14 px SVG, 16 px ink, 20 px layout; transparent 44 px coarse-pointer hit area. Clipboard, long press and context menu remain shared by both roles.
- At widths >=1100 px, the bounded draggable assistant opens its history alongside the chat (320 px). Smaller windows retain the modal history. Titles truncate; rename/delete use a disclosure menu.
- Matching package export/import tiles use the existing JSON/ICS flow and native file picker. No QR/data format changes.
- All nine settings categories have 18 px icons in cards and desktop navigation. Sidebar preference/default are preserved; its label is now Overview.
- The update center checks origin-validated public stable metadata, compares numeric SemVer/part beta iterations, displays real build metadata and last successful check, and distinguishes network errors and unavailable private-beta authorization. SemVer build metadata is not assumed to prove update ordering. No automatic install/download.
- Explicit requests above the established 20-event proposal limit are rejected before inference. Generated write claims are guarded during streaming, finalization and native recovery; Stop/history retain guarded content. Model replies are visually distinguished from application save confirmations. Calendar writes still require the existing explicit confirmation/transaction.
- Existing parsing already handles all three reported 16–17 ranges; regression coverage verifies local dates, exact clocks and no writes before confirmation.
- Candidate policy: 10521 / 1.5.0-part3-beta.2, unchanged package/certificate. Historical Beta 1 JSON and Part 2 policies remain intact. Both private artifacts must prove one identical current application commit.

Validation executed: TypeScript; 253/253 unit tests; 61/61 Python policy tests; Beta 7 streaming/Stop/copy/background fixture; Part 3 browser regression; Beta 2 rendered update/icon/file-picker tests. Screenshots inspected for desktop history, mobile copy, sync file tiles and update center. The updated update fixture now includes the actual GitHub release URL and asserts that public 1.4.2 is not an update to 1.5.0, replacing the old raw-tag display expectation.

Physical POCO/NVIDIA inference is not retested in Cloud. Accepted Beta 1 hardware results remain the baseline. New APK/AppImage delivery is pending the private candidate workflow; no public release or merge is authorized.

CI follow-up: the diagnostic-action native fixture expected an applied 2048-token context without reporting `contextApplied`. The fixture now explicitly reports its configured context; the production unknown-context handling and assertion are preserved. Its export assertion was also stale (schema 4 instead of the existing schema 5) and now checks schema 5 explicitly. The first private run was cancelled during validation before platform packaging; final candidates must use the follow-up source commit.

Final candidate validation caught one more stale test selector: the shared QR/JSON regression still clicked “Export full package” after the approved UI rename to “Export package”. Only the selector changed; download, JSON equality, cancellation, invalid input and exact round-trip assertions remain intact. No application code changed. Packaging did not run in that failed validation attempt.
