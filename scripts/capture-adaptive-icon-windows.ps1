param([IntPtr]$WindowHandle,[int]$ProcessId)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
if(-not ('CalendarAdaptiveScreenshot' -as [type])){Add-Type @'
using System;using System.Runtime.InteropServices;
public static class CalendarAdaptiveScreenshot {
 [DllImport("user32.dll")]public static extern bool PrintWindow(IntPtr h,IntPtr dc,uint flags);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);
 public struct RECT{public int Left,Top,Right,Bottom;}
}
'@}
$out=Join-Path (Get-Location) 'part4-artifacts/windows/visual';[void](New-Item -ItemType Directory -Force $out)
[CalendarAdaptiveScreenshot+RECT]$rect=New-Object CalendarAdaptiveScreenshot+RECT
if(-not [CalendarAdaptiveScreenshot]::GetWindowRect($WindowHandle,[ref]$rect)){throw 'Cannot read actual window rectangle'}
$bitmap=New-Object System.Drawing.Bitmap(($rect.Right-$rect.Left),($rect.Bottom-$rect.Top));$g=[System.Drawing.Graphics]::FromImage($bitmap);$dc=$g.GetHdc()
try{if(-not [CalendarAdaptiveScreenshot]::PrintWindow($WindowHandle,$dc,2)){throw 'Cannot capture actual Calendar window'}}finally{$g.ReleaseHdc($dc);$g.Dispose()}
try{$bitmap.Save((Join-Path $out "running-window-$ProcessId.png"))}finally{$bitmap.Dispose()}
