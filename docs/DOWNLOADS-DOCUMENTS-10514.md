# Downloads provider refusal / working Documents — APK 10514

## Physical evidence and scope

On the same POCO/Android 16, the identical SmolLM2 135M Instruct GGUF fails from the Downloads provider with SecurityException at provider-open-file, but imports, loads and generates locally after selection from Documents. This demonstrates a provider/URI-dependent access failure rather than invalid GGUF bytes. Both typed and raw opens have now been refused by Downloads; changing the method alone did not fix the physical issue. Its internal denial reason is not established.

Android's Downloads document IDs may be raw, numeric or MediaStore-backed (msf/msd); ExternalStorage documents normally use volume-relative IDs such as primary:Documents/…. AOSP DownloadStorageProvider.openDocument delegates these IDs to other system storage providers. ExternalStorage is a different DocumentsProvider. A read grant checked on the outer document URI does not guarantee the provider's internal open succeeds. No application-side ID/path conversion is appropriate.

Reference: https://github.com/aosp-mirror/platform_packages_providers_downloadprovider/blob/android-16.0.0_r1/src/com/android/providers/downloads/DownloadStorageProvider.java (openDocument).

## Minimal safe recovery

Leave the standard ACTION_OPEN_DOCUMENT intent and the successful Documents/external-storage openInputStream path unchanged. On a Downloads-specific SecurityException, offer an explicit user action: Choose Internal storage → Download. It launches the same system picker with EXTRA_INITIAL_URI pointing only to the public ExternalStorage Download directory. The user chooses the file again and Android supplies a new URI/read grant. This can select the same physical Download file through ExternalStorage rather than the Downloads shortcut, without moving/copying the file.

The directory hint is not a replacement for the rejected file URI, a storage path lookup, or an attempt to open without permission. Do not retry the rejected URI under a broader identity, request storage-wide permissions, extract a filesystem path/MediaStore ID or fabricate a file URI. The system can ignore the initial-location hint; the user must then navigate Internal storage → Download manually. If it returns Downloads again, provider diagnostics make that visible. No automatic picker/prompt loop.

The new button is confined to Downloads permission errors. Documents selection/reading, SHA-256/OPFS commit protections, model selection/history and inference are unchanged. Safe diagnostics add an allowlisted document-ID family and selection-route label; no actual document ID/path/name is exported.

## Regression coverage

- Test provider simulates Downloads rejecting both typed and raw opens while Documents streams the same 8 MiB bytes. Both existing security failures remain failures; Documents checksum and bounded reads remain correct.
- Native intent regression verifies the normal picker has no new initial URI, the recovery picker requests only READ and a directory hint, and safe family classification never returns a private path.
- UI bridge regression checks Downloads-only recovery, a new user-selected URI flow, successful streamed import after selection, no recovery reroute for Documents and preservation of the installed model on all failures.

These tests model the observed asymmetry, not the physical POCO provider. This is a supported re-selection route, not a claim that the app repaired or bypassed the provider's SecurityException.

## POCO acceptance

Update the existing diagnostics app without clearing data. First import from Documents exactly as before. Then choose the same file from Downloads; after refusal tap Choose Internal storage → Download and select it through Internal storage (not the Downloads shortcut). No file move is required. Confirm import and local generation. Export diagnostics if it fails: provider, documentFamily and selectionRoute distinguish whether the picker actually changed provider. Keep ordinary Documents behavior as the control case. PR #20 remains Draft; no official release/tag.

## Built candidate

Source `9c97887370a1be8d16602a6e6c4b7fe5ea437b0f`. Signed APK `Kalendarz-1.5.0-Part-2-Beta-2-Downloads-10514.apk`, 24053167 bytes, SHA-256 `cf4140820b1f50e8135014628315860affabefbb722b5fbb3372d85c43c67c3e`. Existing com.kalendarz.offline.diagnostics package and certificate retained; versionCode 10514, no GGUF. Signature/alignment/clean source/runtime provenance verified. Local TypeScript, 9 bridge/diagnostic tests, UI regression, 43 JVM tests and instrumentation compilation passed. Native test execution is tracked in CI; no physical POCO success for this new selection route is claimed.
