KALENDARZ 1.4.1 - recovery of the original Linux, Windows and Web packages

These are byte-for-byte copies of existing packages, not a new build or an
official GitHub Release. No signing keys, passwords or private backups are included.
Every binary transport file is at most 40 MiB (41,943,040 bytes).

Download into a NEW EMPTY directory. Keep the original filenames; if your browser
opens a preview, choose Download raw file or save the direct binary link.
Download all 4 AppImage parts, all 3 EXE parts, the Web ZIP, and both manifests.
Alternatively use Git to download this artifact-only branch:
git clone --single-branch --branch artifacts/141-packages-recovery https://github.com/vex2137/Kalendarz.git KALENDARZ-141-recovery

Linux (run inside the directory containing the downloaded files):
  sha256sum -c PARTS-SHA256SUMS.txt
Continue only if ALL transport files report OK. Then join parts in numeric order:
  cat KALENDARZ-1.4.1-linux-x86_64.AppImage.part00[1-4] > KALENDARZ-1.4.1-linux-x86_64.AppImage
  cat KALENDARZ-1.4.1-WINDOWS-x86_64.exe.part00[1-3] > KALENDARZ-1.4.1-WINDOWS-x86_64.exe
  sha256sum -c SHA256SUMS.txt
Continue only if ALL THREE original package hashes report OK.
  chmod +x KALENDARZ-1.4.1-linux-x86_64.AppImage
  ./KALENDARZ-1.4.1-linux-x86_64.AppImage

Windows PowerShell (run inside the directory containing the downloaded files):
The following commands verify every part, join both binaries using streaming I/O,
refuse to overwrite existing output files, and verify all three original hashes.

function Test-Manifest([string]$Manifest) {
  foreach ($line in Get-Content -LiteralPath $Manifest) {
    if (-not $line.Trim()) { continue }
    $entry = $line -split '\s+', 2
    if ((Get-FileHash -LiteralPath $entry[1] -Algorithm SHA256).Hash -ne $entry[0]) {
      throw "SHA-256 mismatch: $($entry[1])"
    }
    Write-Host "OK: $($entry[1])"
  }
}
function Join-Parts([string]$Name, [int]$Count) {
  $destination = Join-Path (Get-Location).Path $Name
  $output = [IO.File]::Open($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
  try {
    for ($n = 1; $n -le $Count; $n++) {
      $part = Join-Path (Get-Location).Path ($Name + ('.part{0:D3}' -f $n))
      $inputFile = [IO.File]::OpenRead($part)
      try { $inputFile.CopyTo($output) } finally { $inputFile.Dispose() }
    }
  } finally { $output.Dispose() }
}
$ErrorActionPreference = 'Stop'
Test-Manifest 'PARTS-SHA256SUMS.txt'
Join-Parts 'KALENDARZ-1.4.1-linux-x86_64.AppImage' 4
Join-Parts 'KALENDARZ-1.4.1-WINDOWS-x86_64.exe' 3
Test-Manifest 'SHA256SUMS.txt'

The WEB.zip is already complete; never concatenate or rename it as a part.
It is a deployment artifact; uploading it here does not deploy the website.
Do not run a restored binary if any size or checksum check fails.
Keep the original local packages and the old environment until recovery is confirmed.
