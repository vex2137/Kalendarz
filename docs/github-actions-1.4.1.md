# KALENDARZ 1.4.1 manual artifact builds

The manual workflow reuses `.github/workflows/build-apk.yml`, which is already
registered on GitHub. The build branch is `ci/141-manual-packages`. Application
files must match secured commit `1ea6f9ed19ce08964b72a1723a6a8855d9150757`;
only `.github/` and documentation may differ. Version remains 1.4.1.
The old automatic Android build is unchanged on the default branch. The dedicated
CI branch has only a manual trigger for this workflow, read-only repository
permissions and no release/deployment operation. It does not trigger the existing
`Publish tested packages` workflow, which listens to `Release packages` on `main`.

## Signing prerequisite

Configure these repository Actions secrets in **Settings → Secrets and variables
→ Actions → Repository secrets**:

- `CALENDAR_ANDROID_KEYSTORE_BASE64`: base64 of the **existing update keystore**.
- `CALENDAR_ANDROID_STORE_PASSWORD`: its store password.
- `CALENDAR_ANDROID_KEY_ALIAS`: the existing private-key alias.
- `CALENDAR_ANDROID_KEY_PASSWORD`: its private-key password.

Use the existing Beta/diagnostic signing identity, whose public certificate SHA-256
is `ae055d7e4c95b51890af802776390a8eb6d6a45449cffad47ff447b88b564143`.
The separately signed official production key will fail this check. Do not
generate a new key: it cannot update the earlier installation. Never put key
material/passwords in Git, workflow inputs, issues, logs or artifacts. Set secrets
directly through GitHub's secret UI or a trusted local secret-management process;
do not send them through chat. This workflow does not use an environment, so
environment-only secrets are insufficient.

The first job checks that all four values are available, opens the keystore,
checks certificate validity/fingerprint and performs a private-key sign/verify
challenge. It exposes only success/failure. Temporary keystores have restrictive
permissions and are removed on success/failure. Signing steps have no caches or
directory-wide artifact uploads. As with all hosted jobs, forced runner termination
relies on destruction of the ephemeral runner.

## Run

First perform the signing-only check (no application build and no artifacts):

```sh
gh workflow run build-apk.yml --repo vex2137/Kalendarz \
  --ref ci/141-manual-packages -f preflight_only=true
```

After it succeeds, start packaging:

```sh
gh workflow run build-apk.yml --repo vex2137/Kalendarz \
  --ref ci/141-manual-packages -f preflight_only=false
```

Each packaging run repeats the signing check before **any** platform builds.
On failure, all builds are skipped. GitHub may show the default branch's old
workflow name/form until its workflow registry refreshes. The CLI commands select
the existing registered workflow and explicit CI branch, without merging to main.
Do not run the legacy release/publish workflows to obtain these packages.

The Android build uses `calendarStableUpdate=true`, the existing diagnostic ID
`com.kalendarz.offline.diagnostics`, versionName `1.4.1`, versionCode `10406`, and
the native ARM64 CPU/Vulkan runtime. A CI init script selects the validated
existing signing key for that build type; it does not change application sources
or version values. Output checks enforce the certificate, ID, code, native engine
and 16 KiB alignment. This APK updates the Beta/diagnostic line; it does not update
the separate official 1.4.0 production application. Physical installation remains
a device check.

All four distributions are model-free, as in the secured final-package report.
Existing user models/data stay in application storage; a new installation imports
or downloads a supported model. Desktop packaging uses existing native runtime
checksum verification. Windows builds a portable x86_64 EXE on Windows, without
Authenticode signing. Web uses the existing production ZIP packager with hosting
instructions/headers; creating the ZIP does not deploy a website.

## Download

1. Sign in to GitHub and open **vex2137/Kalendarz → Actions**.
2. Open the manual run for **ci/141-manual-packages**, named
   **KALENDARZ 1.4.1 manual packages**. Select the packaging run, not the
   signing-only run. Require successful `web`, both `desktop` jobs, `android`
   and `checksums`.
3. On the run's **Summary**, scroll to **Artifacts** and download:

   | Actions artifact | File inside its download ZIP |
   | --- | --- |
   | `KALENDARZ-1.4.1-Android` | `KALENDARZ-1.4.1-ANDROID.apk` |
   | `KALENDARZ-1.4.1-Linux` | `KALENDARZ-1.4.1-linux-x86_64.AppImage` |
   | `KALENDARZ-1.4.1-Windows` | `KALENDARZ-1.4.1-WINDOWS-x86_64.exe` |
   | `KALENDARZ-1.4.1-Web` | `KALENDARZ-1.4.1-WEB.zip` |
   | `KALENDARZ-1.4.1-SHA256` | `KALENDARZ-1.4.1-SHA256SUMS.txt` |

4. Extract the five outer Actions ZIPs into one folder. Keep the inner Web ZIP
   intact when verifying checksums. GitHub retains these artifacts for 30 days
   (subject to repository policy).
5. Verify **the extracted packages**, not the outer Actions ZIPs:

   ```sh
   sha256sum -c KALENDARZ-1.4.1-SHA256SUMS.txt
   ```

   Windows PowerShell:

   ```powershell
   Get-Content .\KALENDARZ-1.4.1-SHA256SUMS.txt | ForEach-Object {
     $expected, $file = $_ -split '  ', 2
     if ((Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant() -ne $expected) {
       throw "SHA-256 mismatch: $file"
     }
     Write-Output "OK: $file"
   }
   ```

The checksum job requires exactly four packages and calculates every SHA-256
from this run's uploaded files. Historical sums are never copied. A successful
signing-only run intentionally produces no downloadable artifacts. A failed
packaging run may contain partial platform artifacts; it is not a complete set.
