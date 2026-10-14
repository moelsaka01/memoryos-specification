# MemoryOS 1.3.1 release media: a small Win32 input agent. It reads one JSON command per line on stdin and answers one JSON line on stdout.
# Everything it does is real operating-system input (mouse, keyboard, window placement): no application is scripted from the inside.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public static class W {
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int i);
  [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint ms);
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort vk, scan; public uint flags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] public struct IU { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public IU u; }
  public static void Mouse(uint flags, uint data) {
    INPUT[] a = new INPUT[1]; a[0].type = 0; a[0].u.mi.dwFlags = flags; a[0].u.mi.mouseData = data;
    SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }
  // a real (absolute) mouse-move input event; Chromium ignores a bare SetCursorPos for hover and mousemove
  public static void MoveAbs(int x, int y) {
    int w = GetSystemMetrics(0), h = GetSystemMetrics(1);
    INPUT[] a = new INPUT[1]; a[0].type = 0;
    a[0].u.mi.dx = (int)Math.Round(x * 65535.0 / (w - 1)); a[0].u.mi.dy = (int)Math.Round(y * 65535.0 / (h - 1));
    a[0].u.mi.dwFlags = 0x8001;
    SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }
  public static void Key(ushort vk, bool up, bool unicode, ushort scan) {
    INPUT[] a = new INPUT[1]; a[0].type = 1; a[0].u.ki.vk = vk; a[0].u.ki.scan = scan;
    a[0].u.ki.flags = (uint)((up ? 2 : 0) | (unicode ? 4 : 0));
    SendInput(1, a, Marshal.SizeOf(typeof(INPUT)));
  }
  public static List<string> Windows() {
    List<string> r = new List<string>();
    EnumWindows(delegate (IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      StringBuilder t = new StringBuilder(512); GetWindowTextW(h, t, 512);
      StringBuilder c = new StringBuilder(256); GetClassNameW(h, c, 256);
      uint pid; GetWindowThreadProcessId(h, out pid);
      RECT rc; GetWindowRect(h, out rc);
      r.Add(h.ToInt64() + "\t" + pid + "\t" + c + "\t" + rc.L + "," + rc.T + "," + rc.R + "," + rc.B + "\t" + t);
      return true;
    }, IntPtr.Zero);
    return r;
  }
}
'@
[void][W]::SetProcessDpiAwarenessContext([IntPtr]-4)   # per-monitor v2: every coordinate below is a physical pixel
[void][W]::timeBeginPeriod(1)
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
function UiaRoot([int64]$hwnd) { return [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$hwnd) }
# Finds visible UI Automation elements by exact Name (and optionally control type) under a window; returns their screen rectangles.
function UiaFind([int64]$hwnd, [string]$name, [string]$type) {
  $root = UiaRoot $hwnd
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, $name)
  $found = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond)
  $out = @()
  foreach ($el in $found) {
    $ct = $el.Current.ControlType.ProgrammaticName -replace "^ControlType.", ""
    if ($type -and $ct -ne $type) { continue }
    $r = $el.Current.BoundingRectangle
    if ($r.IsEmpty -or $r.Width -le 0) { continue }
    $out += @{ name = $el.Current.Name; type = $ct; rect = @([int]$r.Left, [int]$r.Top, [int]$r.Right, [int]$r.Bottom); offscreen = $el.Current.IsOffscreen }
  }
  return $out
}
function UiaDump([int64]$hwnd, [int]$limit) {
  $root = UiaRoot $hwnd
  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $out = @(); $n = 0
  foreach ($el in $all) {
    $r = $el.Current.BoundingRectangle
    if ($r.IsEmpty -or $el.Current.IsOffscreen) { continue }
    $out += ($el.Current.ControlType.ProgrammaticName -replace "^ControlType.", "") + " | " + $el.Current.Name + " | " + [int]$r.Left + "," + [int]$r.Top + "," + [int]$r.Right + "," + [int]$r.Bottom
    $n++; if ($n -ge $limit) { break }
  }
  return $out
}
$stdout = [Console]::Out
function Reply($o) { $stdout.WriteLine(($o | ConvertTo-Json -Compress -Depth 6)); $stdout.Flush() }
$rng = New-Object System.Random 20261013
function Ease([double]$t) { return $t * $t * (3 - 2 * $t) }
function MoveTo([int]$x, [int]$y, [int]$ms) {
  $p = New-Object W+POINT; [void][W]::GetCursorPos([ref]$p)
  $x0 = $p.X; $y0 = $p.Y
  if ($ms -le 0) { [W]::MoveAbs($x, $y); return }
  # a slight arc (perpendicular offset) so the pointer moves like a hand, not a ruler
  $dx = $x - $x0; $dy = $y - $y0; $len = [Math]::Sqrt($dx * $dx + $dy * $dy)
  $dir = 1; if ($rng.Next(2) -eq 0) { $dir = -1 }
  $bow = [Math]::Min(40, $len * 0.06) * $dir
  $nx = 0; $ny = 0
  if ($len -gt 0) { $nx = -$dy / $len; $ny = $dx / $len }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($true) {
    $t = [Math]::Min(1.0, $sw.ElapsedMilliseconds / [double]$ms); $e = Ease $t
    $arc = 4 * $e * (1 - $e) * $bow
    [W]::MoveAbs([int][Math]::Round($x0 + $dx * $e + $nx * $arc), [int][Math]::Round($y0 + $dy * $e + $ny * $arc))
    if ($t -ge 1.0) { break }
    [Threading.Thread]::Sleep(4)
  }
  [W]::MoveAbs($x, $y)
}
$VK = @{ ENTER = 0x0D; TAB = 0x09; ESC = 0x1B; BACKSPACE = 0x08; SPACE = 0x20; UP = 0x26; DOWN = 0x28; LEFT = 0x25; RIGHT = 0x27; HOME = 0x24; END = 0x23; PGUP = 0x21; PGDN = 0x22; DELETE = 0x2E; CTRL = 0x11; SHIFT = 0x10; ALT = 0x12; WIN = 0x5B; F4 = 0x73; F5 = 0x74; F11 = 0x7A; OEM_PLUS = 0xBB; OEM_MINUS = 0xBD }
function KeyCombo([string]$combo) {
  $parts = $combo.Split('+'); $codes = @()
  foreach ($part in $parts) {
    $u = $part.ToUpper()
    if ($VK.ContainsKey($u)) { $codes += [uint16]$VK[$u] } elseif ($u.Length -eq 1) { $codes += [uint16][int][char]$u } else { throw "unknown key $part" }
  }
  foreach ($c in $codes) { [W]::Key($c, $false, $false, 0); [Threading.Thread]::Sleep(8) }
  [Threading.Thread]::Sleep(40)
  for ($i = $codes.Count - 1; $i -ge 0; $i--) { [W]::Key($codes[$i], $true, $false, 0); [Threading.Thread]::Sleep(8) }
}
function TypeText([string]$text, [int]$cps) {
  $base = [Math]::Max(1, [int](1000 / [Math]::Max(1, $cps)))
  foreach ($ch in $text.ToCharArray()) {
    if ($ch -eq "`n") { KeyCombo 'ENTER'; continue }
    [W]::Key(0, $false, $true, [uint16][char]$ch); [W]::Key(0, $true, $true, [uint16][char]$ch)
    [Threading.Thread]::Sleep($base + $rng.Next(0, [Math]::Max(1, [int]($base * 0.6))))
  }
}
function Wheel([int]$notches, [int]$ms) {
  # positive notches scroll DOWN. One notch = 120 units; spread over the duration with an ease so the scroll starts and ends gently
  $n = [Math]::Abs($notches); $sign = [Math]::Sign($notches); if ($n -eq 0) { return }
  $sw = [Diagnostics.Stopwatch]::StartNew(); $sent = 0
  while ($sent -lt $n) {
    $t = [Math]::Min(1.0, $sw.ElapsedMilliseconds / [double][Math]::Max(1, $ms)); $due = [int][Math]::Ceiling((Ease $t) * $n)
    while ($sent -lt $due) { $d = -1 * $sign * 120; [W]::Mouse(0x0800, [BitConverter]::ToUInt32([BitConverter]::GetBytes([int]$d), 0)); $sent++ }
    [Threading.Thread]::Sleep(8)
  }
}
while (($line = [Console]::In.ReadLine()) -ne $null) {
  if ($line.Trim() -eq '') { continue }
  try {
    $c = $line | ConvertFrom-Json
    switch ($c.cmd) {
      'windows' { Reply @{ ok = $true; windows = @([W]::Windows()) } }
      'place' {
        $h = [IntPtr][int64]$c.hwnd
        [void][W]::ShowWindow($h, 9)
        $z = [IntPtr]0; if ($c.topmost) { $z = [IntPtr]-1 }
        [void][W]::SetWindowPos($h, $z, [int]$c.x, [int]$c.y, [int]$c.w, [int]$c.h, 0x0040)
        $r = New-Object W+RECT; [void][W]::GetWindowRect($h, [ref]$r)
        Reply @{ ok = $true; rect = @($r.L, $r.T, $r.R, $r.B) }
      }
      'focus' {
        $h = [IntPtr][int64]$c.hwnd
        # the Alt tap lets a background process take foreground
        [W]::Key(0x12, $false, $false, 0); [W]::Key(0x12, $true, $false, 0)
        [void][W]::BringWindowToTop($h); [void][W]::SetForegroundWindow($h)
        Reply @{ ok = $true; foreground = ([W]::GetForegroundWindow().ToInt64()) }
      }
      'fg' { Reply @{ ok = $true; foreground = ([W]::GetForegroundWindow().ToInt64()) } }
      'rect' { $h = [IntPtr][int64]$c.hwnd; $r = New-Object W+RECT; [void][W]::GetWindowRect($h, [ref]$r); $cr = New-Object W+POINT; [void][W]::ClientToScreen($h, [ref]$cr); Reply @{ ok = $true; rect = @($r.L, $r.T, $r.R, $r.B); client = @($cr.X, $cr.Y) } }
      'move' { MoveTo ([int]$c.x) ([int]$c.y) ([int]$c.ms); Reply @{ ok = $true } }
      'click' {
        if ($c.x -ne $null) { MoveTo ([int]$c.x) ([int]$c.y) ([int]$c.ms) }
        $b = @(0x0002, 0x0004); if ($c.button -eq 'right') { $b = @(0x0008, 0x0010) }
        $count = 1; if ($c.count) { $count = [int]$c.count }
        for ($i = 0; $i -lt $count; $i++) { [W]::Mouse($b[0], 0); [Threading.Thread]::Sleep(55); [W]::Mouse($b[1], 0); [Threading.Thread]::Sleep(90) }
        Reply @{ ok = $true }
      }
      'wheel' { if ($c.x -ne $null) { [W]::MoveAbs([int]$c.x, [int]$c.y) }; Wheel ([int]$c.notches) ([int]$c.ms); Reply @{ ok = $true } }
      'type' { $cps = 22; if ($c.cps) { $cps = [int]$c.cps }; TypeText ([string]$c.text) $cps; Reply @{ ok = $true } }
      'key' { KeyCombo ([string]$c.keys); Reply @{ ok = $true } }
      'sleep' { [Threading.Thread]::Sleep([int]$c.ms); Reply @{ ok = $true } }
      'cursor' { $p = New-Object W+POINT; [void][W]::GetCursorPos([ref]$p); Reply @{ ok = $true; x = $p.X; y = $p.Y } }
      'uia' { $t = ""; if ($c.type) { $t = [string]$c.type }; Reply @{ ok = $true; found = @(UiaFind ([int64]$c.hwnd) ([string]$c.name) $t) } }
      'uiadump' { $l = 80; if ($c.limit) { $l = [int]$c.limit }; Reply @{ ok = $true; items = @(UiaDump ([int64]$c.hwnd) $l) } }
      'quit' { Reply @{ ok = $true }; exit 0 }
      default { Reply @{ ok = $false; error = "unknown cmd $($c.cmd)" } }
    }
  } catch { Reply @{ ok = $false; error = $_.Exception.Message } }
}
