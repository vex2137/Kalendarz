# Android 1.4.2 with private Qwen v2 weights

This update targets the existing `com.kalendarz.offline.diagnostics` installation:
version `1.4.2`, code `10407`, certificate SHA-256
`ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`.
It uses a separate `calendarQwenV2Update=true` Gradle path and
`.github/workflows/build-apk-v142.yml`. The guarded 1.4.1 workflow and init script
are unchanged. Ordinary, beta and model-free Gradle variants keep their existing
version calculations. Do not use a regular diagnostics APK for this update.

## Code and data preservation

The bundled default is `kalendarz-qwen35-v2-q4-k-m`, revision
`local-finetune-v142-v2`. Its GGUF must be exactly **529297056 bytes**, SHA-256
`fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5`.
There is no public weight URL. A normal build fails if verified local weights
are unavailable; it never substitutes the base model.

On first use, the saved old default ID `qwen3.5-0.8b-q4-k-m` migrates to v2.
Other selected model IDs are retained. A migration marker allows a subsequent
explicit choice of the old base model. Its descriptor stays in the optional
catalogue so existing messages keep their original model labels. Existing
releases recorded only a selected ID, so an old automatic choice and an old
explicit choice of that same default cannot be distinguished retroactively.

The migration changes only the active model preference and its migration marker.
It does not rewrite events, chat records, language settings, model imports or
existing weights. The package identity, Capacitor origin and data stores remain
unchanged. Android's same-package, same-certificate update with a higher code
retains the application's data. Confirm actual retained data on the phone after
installation; unit tests cannot prove device state preservation.

The existing native plugin copies bundled assets to a private native cache once,
checks their size and SHA-256, and starts the pinned ARM64 llama.cpp engine.
This is a local copy, not a download. A file in `/sdcard/Download` alone is not
installed in the app. Do not import or download the bundled v2 model again.

## Private CI depot: input GGUF and output APK

Do not upload either the model **or the APK containing it** as an artifact of a
public repository. The new workflow uses an existing **private repository and
draft release** for both inputs and outputs. It refuses public/internal
repositories and published releases, including on the output path. It does not
publish releases, create repositories, overwrite assets or change secrets.

GitHub release assets have a 2 GiB per-file limit; the approximately 505 MiB GGUF
and expected APK fit individually. Unlike Actions artifacts, release assets have
no configured retention expiry: they remain until removed, the repository is
deleted, or access changes. Keep a local copy and retain the private depot. They
consume GitHub storage and require repository access. Do not change the depot's
visibility or publish its draft. The output APK name includes source commit,
run ID and attempt. Uploads address the checked numeric draft release ID directly,
never resolve a tag, never overwrite assets, and check the returned asset size
and server SHA-256 when available.

The workflow's normal `GITHUB_TOKEN` has only `contents: read`. Add a separate
fine-grained token as `CALENDAR_MODEL_DEPOT_TOKEN` in `vex2137/Kalendarz`, scoped
only to the private depot with **Contents: read and write**. Write access uploads
the verified APK; it does not need access to account administration, workflows
or signing secrets. The four existing production signing secrets are left unchanged. The update uses
`CALENDAR_ANDROID_UPDATE_KEYSTORE_BASE64`, `CALENDAR_ANDROID_UPDATE_STORE_PASSWORD`,
`CALENDAR_ANDROID_UPDATE_KEY_ALIAS` and `CALENDAR_ANDROID_UPDATE_KEY_PASSWORD`.
They must contain the original diagnostics key, not the production release key.
Tokens and keys are passed only to the steps that need them.

One-time local preparation, using **fish** and authenticated GitHub CLI:

```fish
cd ~
set model "$HOME/Kalendarz-142-trening/training/runs/v142-rtx4060-v2/kalendarz-qwen35-v2-q4_k_m.gguf"
set depot vex2137/Kalendarz-private-builds
python3 -c 'import hashlib,sys; from pathlib import Path; p=Path(sys.argv[1]); assert p.stat().st_size==529297056; f=p.open("rb"); assert hashlib.file_digest(f,"sha256").hexdigest()=="fecd8b646db036ca27801f8a4c2d84c5f8baf981ba9a635ea0d2553b652eb1b5"' "$model"
and gh repo create "$depot" --private --add-readme
and test (gh api "repos/$depot" --jq '.visibility') = private
and gh release create model-v142-v2 "$model" --repo "$depot" --draft --title "Private Kalendarz 1.4.2 build depot" --notes "Private weights and APKs. Keep this release as a draft and this repository private."
```

Run this as one block. Fish `and` stops the remaining operations if verification,
repository creation or the privacy check fails. An existing repository name
causes creation to fail; do not continue with uploads after an error. Choose a
fresh private repository name, or separately verify an existing private depot
before reusing it. The original project is only read for the GGUF; no Git
operation, build, reset or write runs in `~/Kalendarz-142-trening`.

After the upload succeeds, obtain the exact draft ID:

```fish
set release_id (gh api --paginate "repos/$depot/releases" --jq '.[] | select(.draft == true and .tag_name == "model-v142-v2") | .id')
test (count $release_id) -eq 1
and string match --quiet --regex '^[1-9][0-9]*$' "$release_id"
```

In GitHub, open **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**. Set the resource owner to `vex2137`,
choose **Only select repositories**, select only the private depot and grant
**Repository permissions → Contents: Read and write** (Metadata read is
implicit). Use a short expiration sufficient for the build. No Actions,
Workflows, Administration or access to other repositories is required.

Store the token through the CLI's hidden interactive prompt:

```fish
gh secret set CALENDAR_MODEL_DEPOT_TOKEN --repo vex2137/Kalendarz
```

Alternatively use **vex2137/Kalendarz → Settings → Secrets and variables →
Actions → New repository secret**, name `CALENDAR_MODEL_DEPOT_TOKEN`. Do not
change the existing signing secrets or paste token values into commands, chat,
files or logs. No weights, APKs or secrets are uploaded/changed by the remote
review session; these commands are for the user to execute.

## Run the build

PRs #12 and #13 have been merged after successful CI. The workflow is registered
on `main`, and the application source is integrated into
`dev/1.4.2-qwen35-finetune`. Configure the update-specific signing secrets above,
then dispatch using the **development branch ref**, not `main`. No changes to
the training worktree are needed. The old 1.4.1 workflow and production signing
identity remain separate.

```fish
gh workflow run build-apk-v142.yml --repo vex2137/Kalendarz --ref dev/1.4.2-qwen35-finetune -f preflight_only=true -f model_repository="$depot" -f model_release_id="$release_id"
```

After successful signing/depot preflight, start the full build:

```fish
gh workflow run build-apk-v142.yml --repo vex2137/Kalendarz --ref dev/1.4.2-qwen35-finetune -f preflight_only=false -f model_repository="$depot" -f model_release_id="$release_id"
gh run list --repo vex2137/Kalendarz --workflow build-apk-v142.yml --limit 5
```

Select the run ID printed by GitHub CLI and use `gh run watch RUN_ID --repo
vex2137/Kalendarz`. The successful run summary links the private draft containing
the APK and checksum. No model-containing public Actions artifact is produced.
The build runs TypeScript, unit/native tests, release-guard tests, Android JVM
tests, bundled web build, ARM64 native build, Capacitor sync and signed assembly.
Gradle rejects an incorrect signing key before assembly. Final checks verify the
actual APK certificate, package/version, source commit, GGUF hash/size, license,
exactly one uncompressed GGUF, ARM64 ELF provenance and 16 KiB ZIP alignment.
CI does not prove successful inference on a POCO X7 Pro.

Public pull request checks build the explicit model-free frontend without access
to private weights or signing secrets. Their desktop inference regression uses
the pinned public base Qwen through the existing external-folder installation
path. This is baseline regression coverage, not evidence of Qwen v2 inference.
Only the separate private release workflow bundles v2.

## Local build prerequisites

For a local web build with the real private GGUF, use:

```fish
set -x CALENDAR_MODEL_FILE "$model"
npm run build
```

The Android release additionally needs Java 21, SDK 36, build-tools 35.0.0,
NDK 29.0.14206865, CMake 3.31.6, the built native engine and the original signing
key. Prefer CI to keep that key out of the local machine. A local debug keystore
cannot update the installed 1.4.1. A model-free test build is not a release APK.

## Install without clearing data

Download the **specific APK and matching checksum** from the successful run's
private draft link, using their full names in place of the placeholders:

```fish
mkdir -p release/private-v142
gh release download model-v142-v2 --repo "$depot" --pattern 'KALENDARZ-1.4.2-ANDROID-COMMIT-RUN-ATTEMPT.apk*' --dir release/private-v142
cd release/private-v142
sha256sum -c KALENDARZ-1.4.2-ANDROID-COMMIT-RUN-ATTEMPT.apk.sha256
cd ../..
set apk "$PWD/release/private-v142/KALENDARZ-1.4.2-ANDROID-COMMIT-RUN-ATTEMPT.apk"
set build_commit FULL_40_CHARACTER_SOURCE_COMMIT_FROM_THE_RUN
python3 scripts/install-android-v142.py "$apk" --sdk "$ANDROID_HOME" --commit "$build_commit"
```

Use your SDK path if `ANDROID_HOME` is unset. The installer verifies the incoming
APK completely, pulls only the installed base APK to verify its certificate and
`1.4.1/10406` identity (or a reinstall of `1.4.2/10407`), then runs exactly:

```fish
adb install -r "$apk"
adb shell dumpsys package com.kalendarz.offline.diagnostics
```

The script also checks the installed version afterwards. For multiple devices,
pass `--serial DEVICE_SERIAL`. Never uninstall, clear app data, change package
identity, or add a downgrade flag to resolve an install error. If Android rejects
the update, stop and inspect the package/certificate/version mismatch.

After installation, confirm old events, chats, settings and the language choice.
Enable airplane mode, open the assistant and check a Polish request (for example
`Znajdź dentystę jutro`) and an English request (`Find dentist tomorrow`). Confirm
the displayed model is Qwen v2 and the backend uses the native ARM64 engine.
Calendar changes should still require the existing confirmation flow. Record
actual device results before considering this release tested on the phone.

## Recovered diagnostics signing identity

The original diagnostics key was located in the retained Android build cache.
Its certificate is the required `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`,
and a signing challenge verified access to the matching private key. The
production secrets instead contain certificate
`b6b7bc0499ab59af54404a90aaa785e3d40f2738e83fdf9e6306f8e210c79a01`.
The two identities serve different packages and must not replace one another.

A private backup can contain `calendar-update-142.p12` and `signing.json` outside
the checkout. Protect both files and retain an offline copy; never commit them
or upload them as release/Actions artifacts. Rewrapping the original key into
PKCS12 with a new strong container password preserves its signing identity.

After reviewing the helper, verify a backup without changing secrets:

```fish
node scripts/configure-android-update-signing.cjs --dry-run /private/update-signing-backup
```

Only with the owner's approval, configure the four update-specific secrets:

```fish
node scripts/configure-android-update-signing.cjs --apply /private/update-signing-backup
```

The helper verifies the certificate and private-key proof before any write,
passes secret values to GitHub CLI through stdin, and preserves the existing
production secrets. The caller needs GitHub permission to manage Actions secrets.
The current integration can dispatch/build but cannot manage those secrets;
an owner-authorized local GitHub CLI can run the helper. No secret values are
printed. A standalone private backup may include the helper and validator so
it can be configured outside the training project.
