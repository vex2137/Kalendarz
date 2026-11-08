# Kalendarz 1.5.0 Part 2 Stable — private delivery

Application sources continue accepted Android Beta 7 `0d30fc7`; Linux keeps the
working desktop Beta 5 `e83a268` backend pins and layout foundation. Inspection of
the desktop delta found only the targeted preload/main SSE progress and cancel
protocol, native streaming/reset handling, and folder-registry persistence. No
Android SAF, foreground service or ARM native code is added to Electron. Shared
prompt, history, manager and presentation improvements retain platform guards.
No native engine, CUDA pin or GGUF weight is changed.

Copy controls now use 16px icons and 24px visual feedback inside transparent
44px touch targets. Both roles retain button, touch-hold, right-click and keyboard
menu use. The menu is portalled into the containing dialog, escaping chat scroll
clipping while staying inside its focus trap. Regression checks cover actual
clipboard writes for both roles, large text, narrow layout, streaming and partial
history after Stop/reload. The old prompt wording assertion now verifies the
accepted shorter prompt's language/Polish/explicit-language requirements.

`part2-stable-version.json` records channel `part2-stable`, Android versionName
`1.5.0-part2-stable` and versionCode 10519 (> accepted Beta 7 10518). The numeric
base remains 1.5.0; this is not a final four-part 1.5.0 Release. Android package and
update certificate stay unchanged. Linux appId/productName/userData stay unchanged.
Historical beta and 1.4.2 guards remain strict. The independent Stable guard verifies
source/channel, clean current HEAD and both workflow/application checkout identities.

Install `scripts/part2-stable-private-build.yml` in the private builds repository as
`.github/workflows/build-part2-stable.yml`, then dispatch one exact current public
HEAD. Validation runs full unit/type/native-policy checks, calendar/security/theme/
motion and assistant/model/transfer browser tests, accepted Beta 7 same-origin
upgrade (including settings, PIN, history and OPFS), and real sandboxed Electron
IPC streaming. Android reuses immutable accepted CPU/Vulkan artifacts, rebuilds only
the small diagnostic helper, compiles/tests Java and signs with the existing key via
the authenticated one-use handoff. It uploads only after APK verification.

Linux packages the existing CPU/CUDA/Vulkan runtime set. It verifies the extracted
ASAR/source/channel, all native hashes/architecture/dependencies and startup/exit,
then runs the actual packaged Electron acceptance and cold/warm CPU inference using
the existing private Qwen v2 asset (verified size/SHA-256). That model is placed in
runner temporary storage outside the package, never in either output. A final job
re-downloads both private artifacts and checks their bytes and equal source before
emitting delivery metadata. Artifacts expire after 30 days; no tag, merge or Release.

Local verification and final CI results are recorded in the task/PR report rather
than inferred from compilation. CPU inference and real Electron/IPC tests are
separate from native-boundary browser fixtures. This environment has no physical
POCO or NVIDIA GPU. The user's accepted Beta 7 Android GPU/background evidence and
unchanged native hashes are retained, but a new physical installation/copy test and
CachyOS RTX 4060 inference/offload check remain manual acceptance. No driver/kernel
changes or phone installation are performed by this workflow.
