# Part 2 Beta 7 test candidate

Base: physically accepted Beta 6, `738ce9e`. VersionCode 10518; package
`com.kalendarz.offline.diagnostics` and update certificate remain unchanged.
Distribution contains no GGUF. PR #20 stays Draft; no Release or merge.

The Android CPU executable remains the accepted b12189 binary, SHA-256
`83949aeb80b5f899e3b6297df2b547379e63570bffe8eb5276bc44516e034ed5`.
A separate static b12189 ARM64 Vulkan executable is built by the private workflow
from pinned sources with NDK 29. Its recipe, source hashes, ELF dependencies,
binary hash and package contents are checked before signing. CPU does not acquire
a Vulkan loader dependency. The Beta 6 independent Compute helper remains intact.
Enumeration, loaded layers and token-confirmed inference remain distinct; software
Compute in CI is not Mali or GGUF GPU inference. Auto falls back to CPU; explicit
GPU reports failure. Failed model/context/layer combinations are cached for the
process session; applying the backend/layer setting explicitly permits a retry.

Native SSE deltas cross Capacitor/Electron IPC before completion. A durable message
ID ties chunks, Stop, fallback reset, history and recovery to the same answer.
Calendar extraction JSON is never shown as chat text or executed without validation
and confirmation. Interrupted extraction after WebView recreation requires retry.
Partial natural answers remain copyable and are checkpointed. Long-press menus are
positioned near the gesture, including in long messages. The compact header has
one exit, five accessible controls, and no repeated Offline badges.

Background generation and model residency are independent preferences. Android
uses a user-started `specialUse` foreground service with a Stop notification and
a bounded wake lock. Its application-owned engine has no strong Activity reference;
recreated bridges can recover the matching message. Resident cancellation disconnects
the request while retaining the server, after checking its actual state. Memory
pressure and manual release take precedence. Force-stop/process death cannot be
bypassed; persisted partial answers survive, but killed generations do not restart.
See Android's [foreground service types](https://developer.android.com/develop/background-work/services/fgs/service-types#special-use).

Android folders use SAF tree grants, bounded metadata reads, and a held seekable
descriptor exposed to the child through `/proc/<app-pid>/fd/<fd>`. Content URIs
are never guessed as storage paths. Pipes/nonseekable providers are rejected;
there is no automatic full-model copy or broad storage permission. Missing entries
retain metadata and preferences, can be checked/relinked/forgotten, and never delete
provider files. Linux also retains unavailable entries across restart. Retired base
Qwen Q4_K_M/IQ4_XS descriptors remain solely for existing installations/preferences;
they are not offered as new downloads. Owned files require explicit deletion approval.

## POCO acceptance after installing the signed update

1. Update over Beta 6; check events, settings, history and installed models.
2. Test short PL/EN chat and a confirmed event, then undo. Check live chunks,
   Unicode, Stop/partial history, both copy gestures, rotation and large fonts.
3. Test all four background/RAM preference combinations, notification Stop,
   lock/unlock, returning from another app, Activity recreation and manual RAM release.
   HyperOS/system termination and thermal behavior require the physical phone.
4. Add two SAF model folders, load an external GGUF without copying, revoke access,
   refresh, relink a moved file and remove only its entry. Provider/SELinux access
   to the held descriptor must be confirmed on POCO; device tests are compiled in CI.
5. Apply GPU with 8 layers, then try a larger/automatic limit. Generate an answer.
   Export diagnostics: package/backend availability, selected device, load/offload
   evidence, actual layers, `gpuActive`, token counts, TTFT and speed. Test Auto
   fallback and unchanged CPU. Only nonzero offload plus generated tokens confirms GPU.
6. Check protected/unprotected QR and JSON import/export using the system picker.

The APK and verification JSON are delivered only through private Actions artifacts.
Cloud artifact-storage policy may prevent local downloads; the private workflow also
records the verified checksum/certificate/provenance report in the private repository.
