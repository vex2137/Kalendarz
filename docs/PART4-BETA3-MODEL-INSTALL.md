# Part 4 Beta 3: model-free default installation

## Root cause and correction

The desktop main process unconditionally protected the first catalogue ID as a
bundled model. Model-free packages consequently rejected `begin`/`remove` with
`model-bundled` and resolved inference to a nonexistent packaged GGUF. The main
process now derives the protected ID from packaged build metadata, rather than
catalogue preference. Real bundled builds retain their read-only behaviour.

A failed native commit now retains verified import staging. Recovery searches
complete transfer/import files in the existing OPFS directory, verifies the
expected exact size and full SHA-256, and commits them through the native store.
It neither edits raw Chromium OPFS files nor marks unknown bytes installed.
Partial/corrupt files are not adopted or deleted by recovery. Duplicate imports
reuse a verified native file. Existing profiles and model-folder registrations
are unchanged; no GGUF is included in any package.

## Related chat corrections

Natural chat receives the same current device-local clock used by the command
parser. The generic unsaved-response footer is removed; actual false write
claims remain guarded. Pending proposals survive unrelated chat; a new proposal
still supersedes the previous proposal and calendar writes require confirmation.

## Verification

Targeted native-store tests use real files, checksums and injected commit I/O
failure. Browser recovery tests use real HTTP, OPFS, IndexedDB and NativeModelStore
with a small synthetic GGUF; those are not inference tests. The chat browser test
uses a controlled inference boundary and clock.

The private Beta 3 workflow requires successful full browser/migration regressions and builds
all five formats from one immutable current application SHA. Android is 10524,
package/certificate unchanged. AppImage, Windows and installed Flatpak additionally
import the approved private Qwen 0.8B, run real CPU inference, remove the test model,
download the same hash-pinned bytes through an isolated localhost HTTPS server,
run inference again and verify managed registration after restart. This tests the
production commit path, unlike an external model-folder test. Localhost uses an
ephemeral test TLS certificate; certificate bypass is confined to test processes.
Weights and temporary TLS material are excluded from artifacts. Flatpak receives
test input in its own XDG data directory; this does not verify a real portal picker.

Physical RTX 4060 CUDA/Vulkan, Android GPU, system file pickers and updates on the
user's existing device still require manual verification. Native runtimes are
unchanged. No public release or automatic PR merge is authorized.

The final package-harness correction reuses completed validation job 129410962608
(run 42691166742, application 946d8ce). A strict diff allowlist rejects changes to
any application/runtime/unit/browser test code; immutable job and migration
artifact evidence are verified before reuse. Unit/type/native checks and actual
package tests run again. Async bridge installation results are awaited on the
controller side; the download scenario starts in an empty profile, before import.
Further application changes must restore full regression execution.
