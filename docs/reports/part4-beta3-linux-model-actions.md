# Linux default model catalogue actions

The missing primary action is reproducible with a complete retained OPFS transfer,
no native installation, and another model selected. Presentation correctly marks
these bytes unverified, disables a redundant Download, and refuses Load. The UI
previously hid the only Verify button inside collapsed Details: the main row showed
only a Verification status. This does not prove the weights were physically bundled.
The reported user profile itself is not available in Cloud.

Promote Verify model to the primary action and send it through the existing
checksum-verified installation/commit path. Missing files retain Download; partial
files retain Resume. Existing complete valid bytes are recovered without HTTP.
The renderer also now gives model-free explicit precedence over missing/conflicting
bundled flags, matching the native model store's existing policy. A catalogue
manifest alone cannot authorize bundled availability in a model-free build.
No Android Java, Vulkan engine, signing, data formats, GGUF weights or user files
are changed. The previous Android fix remains intact.

Targeted checks before packaging: TypeScript PASS; 8 TypeScript tests PASS;
3 native store tests PASS; 6 browser recovery/import/download scenarios PASS.
The new visible-primary-action regression fails on the original Beta 3 code
(timeout locating Verify outside collapsed Details), then passes with the fix.
All browser transfers use synthetic metadata and are not inference evidence.

Private Linux-only packaging must test the actual AppImage with the full original
529297056-byte Qwen file, SHA-256
fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5.
The package test injects a real native commit failure using an empty directory
collision in its isolated profile, retains the actual OPFS download, reloads with
another model selected, clicks primary Verify, confirms no second download and
requires real CPU-generated tokens. It also tests manual import, duplicate import
and a process restart. No user profile or existing model is removed by this test.

The workflow records whether public Hugging Face delivery was verified. If that
network source is unavailable, it uses the existing approved private original and
real localhost HTTPS delivery, explicitly reporting the public path as NOT TESTED.
Neither outcome proves physical RTX offload. No APK or public Release is built.
