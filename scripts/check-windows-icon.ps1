param([string]$Executable, [switch]$CheckOpenWindow)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
function Compare-Icon($actual, $expected, [double]$limit) {
  if ($actual.Width -ne $expected.Width -or $actual.Height -ne $expected.Height) { throw 'Icon dimensions differ' }
  [double]$sum=0
  for ($y=0;$y -lt $actual.Height;$y++) { for ($x=0;$x -lt $actual.Width;$x++) {
    $a=$actual.GetPixel($x,$y);$b=$expected.GetPixel($x,$y)
    foreach ($bg in @(0,255)) { foreach ($c in @('R','G','B')) {
      $sum += [Math]::Abs(($a.$c*$a.A+$bg*(255-$a.A))/255.0-($b.$c*$b.A+$bg*(255-$b.A))/255.0)
    }}
  }}
  $mean=$sum/($actual.Width*$actual.Height*6)
  if ($mean -gt $limit) { throw "Rendered icon differs from Android reference: $mean" }
  return $mean
}
$root=Split-Path $PSScriptRoot -Parent
if ($Executable) {
  $icon=[System.Drawing.Icon]::ExtractAssociatedIcon((Resolve-Path $Executable))
  if ($null -eq $icon) { throw 'Missing executable icon' }
  $expected=New-Object System.Drawing.Icon -ArgumentList @((Join-Path $root 'packaging/icons/calendar.ico'),[int]$icon.Width,[int]$icon.Height)
  $a=$icon.ToBitmap();$b=$expected.ToBitmap()
  try { $iconMean=Compare-Icon $a $b 1.0; Write-Output "PASS PE icon pixels: $Executable; mean error=$iconMean" }
  finally {$a.Dispose();$b.Dispose();$expected.Dispose();$icon.Dispose()}
}
if ($CheckOpenWindow) {
 Add-Type @'
using System; using System.Runtime.InteropServices;
public static class CalendarWindowIcon {
 [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, IntPtr l, uint flags, uint timeout, out UIntPtr result);
}
'@
 $windows=@(Get-Process | Where-Object {$_.ProcessName -eq 'Calendar' -and $_.MainWindowHandle -ne [IntPtr]::Zero})
 if ($windows.Count -eq 0) { throw 'No actual Calendar window to inspect' }
 foreach ($window in $windows) {
  [UIntPtr]$handle=[UIntPtr]::Zero
  [void][CalendarWindowIcon]::SendMessageTimeout($window.MainWindowHandle,0x007F,[UIntPtr]::new([uint64]1),[IntPtr]::Zero,2,2000,[ref]$handle)
  if ($handle -eq [UIntPtr]::Zero) { throw 'Window did not publish ICON_BIG' }
  $icon=[System.Drawing.Icon]::FromHandle([IntPtr]([long]$handle.ToUInt64())).Clone();$a=$icon.ToBitmap()
  $source=[System.Drawing.Image]::FromFile((Join-Path $root 'public/desktop-icon.png'));$b=New-Object System.Drawing.Bitmap($a.Width,$a.Height)
  $g=[System.Drawing.Graphics]::FromImage($b);$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$g.DrawImage($source,0,0,$b.Width,$b.Height);$g.Dispose()
  try {$iconMean=Compare-Icon $a $b 4.0;Write-Output "PASS actual HWND icon pixels: $($window.Id); mean error=$iconMean"}
  finally {$a.Dispose();$b.Dispose();$source.Dispose();$icon.Dispose()}
  if($env:CALENDAR_CAPTURE_ICON_EVIDENCE -eq 'true') {
    $out=Join-Path $root 'part4-artifacts/windows/visual';[void](New-Item -ItemType Directory -Force $out)
    $copy=[System.Drawing.Icon]::FromHandle([IntPtr]([long]$handle.ToUInt64())).Clone();$bitmap=$copy.ToBitmap()
    try{$bitmap.Save((Join-Path $out "actual-window-icon-$($window.Id).png"))}finally{$bitmap.Dispose();$copy.Dispose()}
    & (Join-Path $PSScriptRoot 'capture-adaptive-icon-windows.ps1') -WindowHandle $window.MainWindowHandle -ProcessId $window.Id
  }
 }
}
