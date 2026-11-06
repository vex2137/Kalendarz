# Part 2 Beta 2 artifact provenance

No new APK/AppImage was built for this change. Previously uploaded 10509/10514 packages are historical candidates, not builds of the current PR HEAD.

Use a clean, synchronized checkout. Set one expected application commit for both platforms (fish):

```fish
set -gx CALENDAR_EXPECTED_COMMIT (git rev-parse HEAD)
set -gx CALENDAR_PART2_BETA true
python3 scripts/part2_artifact_guard.py --source "$CALENDAR_EXPECTED_COMMIT" --check-remote
```

The preflight must succeed before the existing build/signing process. It requires the exact local HEAD and current remote `feat/1.5.0-part2` HEAD, not merely an ancestor or a matching source diff. Tracked local changes are rejected. If the branch advances, synchronize and choose a new expected commit; never relax the check or overwrite local changes. Review generated Capacitor tracked changes before packaging; they must not conceal source modifications.

Android's `calendarPart2Beta=true` path reads the shared `scripts/part2-beta2-version.json` policy and validates `dist/build-info.json` against the expected commit. The desktop `beforePack` hook performs the same preflight when `CALENDAR_PART2_BETA=true` (or `CALENDAR_EXPECTED_COMMIT` is set), before any native preparation. Keep the existing model-free flags and signing setup. Use clean per-platform build directories because Android and desktop have different `androidNative` metadata. The source commit must remain identical.

The next candidate code is **10515**, above the last tested **10514**. The shared validator rejects reuse/downgrade. When accepting a later tested code, update `lastTestedVersionCode` and reserve a larger `versionCode` together. Gradle and APK verification consume this same policy. Other release variants are unchanged.

After building (not part of this change), verify the APK using `scripts/verify-part2-beta2-candidate.py --source "$CALENDAR_EXPECTED_COMMIT" APK_PATH`. Keep the existing update certificate; a source match does not replace signature verification.

## Upload existing candidates only

`publish-142.yml` remains a manually dispatched, read-only artifact uploader, not a build or Release workflow. It checks out the exact dispatch SHA. It has no fixed application SHA or binary hashes. Supply its required `artifact_manifest` JSON input with:

- `source`: the exact expected 40-character application commit, equal to dispatch HEAD and live branch HEAD;
- `versionCode`: the shared policy's candidate code;
- `files`: **both** `Kalendarz-1.5.0-Part-2-Beta-2.apk` and `Kalendarz-1.5.0-Part-2-Beta-2-x86_64.AppImage`, each with actual `name`, integer `size` and full `sha256` from the completed build.

Store the files through the existing Git LFS object transfer, never a binary Git commit. The uploader validates the manifest before transfer, hashes each downloaded object, verifies APK signing/identity/alignment/native runtime, and reads the actual embedded `build-info.json` from APK and AppImage ASAR. Both must name the same clean expected commit. It rechecks live branch HEAD before artifact upload. A missing AppImage is an error, not a silently omitted platform. Do not redispatch an old workflow run to label old packages as current.

Offline regression checks (no build, signing, upload or network):

```fish
python3 -m unittest discover -s tests -p test_part2_artifact_guard.py
node --check scripts/verify-packaged-model.cjs
```

No CI dispatch, tag, Release, driver/backend change or APK installation is authorized by this validation alone. PR #20 stays Draft.
