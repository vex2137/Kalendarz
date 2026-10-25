# KALENDARZ 1.4.1 publication verification

The official release uses the original verified packages and preserves their bytes and signatures. Publication requires no Android private key, no signing secrets and no model downloads.

## Immutable recovery inputs

- Original application source: `1ea6f9ed19ce08964b72a1723a6a8855d9150757`.
- APK recovery commit: `7f55cdabc9baaea2f752fe60f551ff98f509b7c1`.
- Linux/Windows/Web recovery commit: `f3de8e05e63b4fe565b515979b6adaa2e3b18545`.

The source includes the original 29 development commits and the three later manual-CI commits. The publication commit changes only CI and documentation. The workflow checks ancestry and application-source equivalence before creating `v1.4.1` at the integrated source commit, never the old main/1.3.0 commit. An existing tag pointing elsewhere is an error and is never moved.

| Package | Bytes | SHA-256 |
| --- | ---: | --- |
| KALENDARZ-1.4.1-ANDROID.apk | 24005277 | d187778c9185af75dfc8c61d8436fe1412e8f0c5c6f85a2cbc5abe8e633a5c89 |
| KALENDARZ-1.4.1-linux-x86_64.AppImage | 165035840 | 1dd853fc8e64d62337ad0dcee7119a34d7c07b969d8c979ce8f0f01a0564d7ad |
| KALENDARZ-1.4.1-WINDOWS-x86_64.exe | 117048817 | ed39c29581b232ec195a77a7de9601b053b8605340bcef822ca86aa3069be0d3 |
| KALENDARZ-1.4.1-WEB.zip | 6954776 | 029906228d815547c24ec5b11709dcb755725baf2ab70a440d95be71790cd8da |

## Publication gates

1. Fetch immutable recovery commits, verify every transport part and restore all four files.
2. Verify complete sizes and the four recorded hashes; generate `SHA256SUMS.txt`.
3. Verify release source/version, original-history ancestry and the exact tag target.
4. Create a draft and upload exactly four full packages plus `SHA256SUMS.txt`.
5. Download every draft asset and check its size and SHA-256. Parts are never release assets.
6. Only then publish, set Latest, and verify public status, asset metadata and tag target.

The workflow retains `release-evidence.json` as an Actions artifact even on failure. A failure is not a completed release; a draft is left available for diagnosis. Reruns do not clobber assets or move tags. Existing mismatched assets are a hard error.

Legacy release builds no longer run on main pushes or the v1.4.1 tag. The historical 1.2.0 publisher is manual-only, and the generic workflow_run publisher explicitly skips 1.4.1. Publishers share the same concurrency group.

Successful package verification is not evidence of physical GPU compatibility. See [known limitations](known-limitations-1.4.1.md). The publication does not alter the application UI language or deploy the Web site.
