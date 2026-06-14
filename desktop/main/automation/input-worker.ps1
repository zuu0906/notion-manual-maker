# input-worker.ps1 — 常駐入力ワーカー（W2）
#
# stdin から JSON Lines でコマンドを受け取り、実行して stdout に JSON 1行で返す。
# input-driver.js が spawn して常駐させる（1コマンド数msで応答）。
#
# 設計方針:
#   - 座標はすべて「物理ピクセル」。SetCursorPos は物理px前提なので、起動時に
#     プロセスを Per-Monitor DPI Aware にする（これを怠ると座標が仮想化されてズレる）。
#   - 入力は SendInput。文字入力は KEYEVENTF_UNICODE で IME 非依存。
#   - UIA は System.Windows.Automation（PADと同方式の要素特定）。
#   - 出力は ocr.ps1 と同じく手動JSON生成（ConvertTo-Json のエンコーディングバグ回避）。

$ErrorActionPreference = 'SilentlyContinue'
# stdin/stdout を UTF-8 に固定（日本語Windowsでの type 入力・JSON出力の文字化け回避）
try { [Console]::InputEncoding = [System.Text.Encoding]::UTF8 } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ── Win32 + DPI + 入力 C# ヘルパー ──────────────────────────────────────────
$csharp = @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class Win32Input {
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
    static readonly IntPtr PER_MONITOR_AWARE_V2 = new IntPtr(-4);
    public static void EnsureDpiAware() {
        try { if (SetProcessDpiAwarenessContext(PER_MONITOR_AWARE_V2) != IntPtr.Zero) return; } catch {}
        try { SetProcessDPIAware(); } catch {}
    }

    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT { public uint type; public InputUnion U; }
    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }

    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] inputs, int cb);

    const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1;
    const uint MOUSEEVENTF_LEFTDOWN = 0x0002, MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008, MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint KEYEVENTF_KEYUP = 0x0002, KEYEVENTF_UNICODE = 0x0004;

    static void SendMouse(uint flags, uint data) {
        var inp = new INPUT[1];
        inp[0].type = INPUT_MOUSE;
        inp[0].U.mi = new MOUSEINPUT { dx=0, dy=0, mouseData=data, dwFlags=flags, time=0, dwExtraInfo=IntPtr.Zero };
        SendInput(1, inp, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void Move(int x, int y) { SetCursorPos(x, y); }

    public static void Click(int x, int y, string button) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(15);
        if (button == "right") { SendMouse(MOUSEEVENTF_RIGHTDOWN, 0); SendMouse(MOUSEEVENTF_RIGHTUP, 0); }
        else { SendMouse(MOUSEEVENTF_LEFTDOWN, 0); SendMouse(MOUSEEVENTF_LEFTUP, 0); }
    }

    public static void Scroll(int delta) { SendMouse(MOUSEEVENTF_WHEEL, unchecked((uint)delta)); }

    public static void TypeText(string text) {
        if (string.IsNullOrEmpty(text)) return;
        var list = new System.Collections.Generic.List<INPUT>();
        foreach (char c in text) {
            for (int k = 0; k < 2; k++) {
                var inp = new INPUT();
                inp.type = INPUT_KEYBOARD;
                inp.U.ki = new KEYBDINPUT {
                    wVk = 0, wScan = c,
                    dwFlags = KEYEVENTF_UNICODE | (k == 1 ? KEYEVENTF_KEYUP : 0),
                    time = 0, dwExtraInfo = IntPtr.Zero
                };
                list.Add(inp);
            }
        }
        var arr = list.ToArray();
        SendInput((uint)arr.Length, arr, Marshal.SizeOf(typeof(INPUT)));
    }

    public static void KeyVk(ushort vk) {
        var inp = new INPUT[2];
        inp[0].type = INPUT_KEYBOARD;
        inp[0].U.ki = new KEYBDINPUT { wVk=vk, wScan=0, dwFlags=0, time=0, dwExtraInfo=IntPtr.Zero };
        inp[1].type = INPUT_KEYBOARD;
        inp[1].U.ki = new KEYBDINPUT { wVk=vk, wScan=0, dwFlags=KEYEVENTF_KEYUP, time=0, dwExtraInfo=IntPtr.Zero };
        SendInput(2, inp, Marshal.SizeOf(typeof(INPUT)));
    }

    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder s, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

    public static string GetTitle(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
    public static uint GetPid(IntPtr h) { uint pid; GetWindowThreadProcessId(h, out pid); return pid; }
    public static void Restore(IntPtr h) { ShowWindow(h, 9); }
}
'@
Add-Type -TypeDefinition $csharp

[Win32Input]::EnsureDpiAware() | Out-Null

# UIA アセンブリ
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, WindowsBase -ErrorAction SilentlyContinue

# ── JSON ヘルパー（ocr.ps1 と同方式）───────────────────────────────────────
function Esc([string]$s) {
    if ($null -eq $s) { return "" }
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $s.ToCharArray()) {
        switch ($c) {
            '"'  { [void]$sb.Append('\"') }
            '\'  { [void]$sb.Append('\\') }
            "`b" { [void]$sb.Append('\b') }
            "`f" { [void]$sb.Append('\f') }
            "`n" { [void]$sb.Append('\n') }
            "`r" { [void]$sb.Append('\r') }
            "`t" { [void]$sb.Append('\t') }
            default {
                if ([int]$c -lt 0x20) { [void]$sb.AppendFormat('\u{0:x4}', [int]$c) }
                else { [void]$sb.Append($c) }
            }
        }
    }
    return $sb.ToString()
}

function Reply([int]$id, [string]$body) {
    [Console]::Out.WriteLine('{"id":' + $id + ',"ok":true,' + $body + '}')
    [Console]::Out.Flush()
}
function ReplyOk([int]$id) {
    [Console]::Out.WriteLine('{"id":' + $id + ',"ok":true}')
    [Console]::Out.Flush()
}
function ReplyErr([int]$id, [string]$msg) {
    [Console]::Out.WriteLine('{"id":' + $id + ',"ok":false,"error":"' + (Esc $msg) + '"}')
    [Console]::Out.Flush()
}

# ── UIA ヘルパー ────────────────────────────────────────────────────────────
function Uia-ControlTypeName($el) {
    try { return $el.Current.ControlType.ProgrammaticName -replace '^ControlType\.', '' } catch { return '' }
}

function Uia-Info($el) {
    if ($null -eq $el) { return $null }
    $name = ''; $aid = ''; $cls = ''; $isPwd = $false
    $rx = 0; $ry = 0; $rw = 0; $rh = 0
    try { $name = $el.Current.Name } catch {}
    try { $aid = $el.Current.AutomationId } catch {}
    try { $cls = $el.Current.ClassName } catch {}
    try { $isPwd = $el.Current.IsPassword } catch {}
    try { $r = $el.Current.BoundingRectangle; $rx = [int]$r.X; $ry = [int]$r.Y; $rw = [int]$r.Width; $rh = [int]$r.Height } catch {}
    $ct = Uia-ControlTypeName $el

    $pathParts = [System.Collections.Generic.List[string]]::new()
    try {
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $p = $walker.GetParent($el)
        $depth = 0
        while ($null -ne $p -and $depth -lt 4) {
            $pn = ''
            try { $pn = $p.Current.Name } catch {}
            $pct = Uia-ControlTypeName $p
            if ($pn -or $pct) { [void]$pathParts.Add('"' + (Esc ("${pct}:$pn")) + '"') }
            $p = $walker.GetParent($p)
            $depth++
        }
    } catch {}
    $pathJson = '[' + [string]::Join(',', $pathParts) + ']'

    $out = '"name":"' + (Esc $name) + '","controlType":"' + (Esc $ct) + '"'
    $out += ',"automationId":"' + (Esc $aid) + '","className":"' + (Esc $cls) + '"'
    $out += ',"isPassword":' + ($isPwd.ToString().ToLower())
    $out += ',"path":' + $pathJson
    $out += ',"rect":{"x":' + $rx + ',"y":' + $ry + ',"w":' + $rw + ',"h":' + $rh + '}'
    return $out
}

function Uia-FromPoint([int]$x, [int]$y) {
    try { return [System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($x, $y))) }
    catch { return $null }
}

# 前面ウィンドウ配下を探索し、記録時の uia 情報に最も一致する要素のrectを返す
function Uia-Find($q) {
    $h = [Win32Input]::GetForegroundWindow()
    if ($h -eq [IntPtr]::Zero) { return $null }
    $root = $null
    try { $root = [System.Windows.Automation.AutomationElement]::FromHandle($h) } catch {}
    if ($null -eq $root) { return $null }

    $cond = [System.Windows.Automation.Condition]::TrueCondition
    $all = $null
    try { $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $cond) } catch {}
    if ($null -eq $all) { return $null }

    $best = $null
    $bestScore = 0.0
    foreach ($el in $all) {
        $score = 0.0
        try {
            if ($q.automationId -and $el.Current.AutomationId -eq $q.automationId) { $score += 3 }
            if ($q.name -and $el.Current.Name -eq $q.name) { $score += 2 }
            if ($q.controlType -and (Uia-ControlTypeName $el) -eq $q.controlType) { $score += 2 }
            if ($q.className -and $el.Current.ClassName -eq $q.className) { $score += 1 }
        } catch {}
        if ($score -gt $bestScore) { $bestScore = $score; $best = $el }
    }
    if ($null -eq $best) { return $null }

    $maxPossible = 0.0
    if ($q.automationId) { $maxPossible += 3 }
    if ($q.name) { $maxPossible += 2 }
    if ($q.controlType) { $maxPossible += 2 }
    if ($q.className) { $maxPossible += 1 }
    if ($maxPossible -le 0) { return $null }
    $norm = [math]::Round($bestScore / $maxPossible, 3)

    $r = $best.Current.BoundingRectangle
    return '"rect":{"x":' + [int]$r.X + ',"y":' + [int]$r.Y + ',"w":' + [int]$r.Width + ',"h":' + [int]$r.Height + '},"score":' + $norm
}

# VKコード対応表（よく使うキー）
$VK = @{
    'enter' = 0x0D
    'return' = 0x0D
    'tab' = 0x09
    'esc' = 0x1B
    'escape' = 0x1B
    'backspace' = 0x08
    'delete' = 0x2E
    'space' = 0x20
    'up' = 0x26
    'down' = 0x28
    'left' = 0x25
    'right' = 0x27
    'home' = 0x24
    'end' = 0x23
    'pageup' = 0x21
    'pagedown' = 0x22
}

# ── メインループ ────────────────────────────────────────────────────────────
[Console]::Out.WriteLine('{"id":0,"ok":true,"ready":true}')
[Console]::Out.Flush()

# リダイレクトされた stdin を UTF-8 で確実に読む
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)

while ($null -ne ($line = $stdin.ReadLine())) {
    $line = $line.Trim()
    if (-not $line) { continue }
    $req = $null
    try { $req = $line | ConvertFrom-Json } catch { continue }
    $id = 0
    if ($req.id) { $id = [int]$req.id }

    try {
        switch ($req.cmd) {
            'ping'   { ReplyOk $id }
            'move'   { [Win32Input]::Move([int]$req.x, [int]$req.y); ReplyOk $id }
            'click'  { [Win32Input]::Click([int]$req.x, [int]$req.y, [string]$req.button); ReplyOk $id }
            'type'   { [Win32Input]::TypeText([string]$req.text); ReplyOk $id }
            'scroll' { [Win32Input]::Scroll([int]$req.delta); ReplyOk $id }
            'key' {
                $vkName = ([string]$req.vk).ToLower()
                if ($VK.ContainsKey($vkName)) { [Win32Input]::KeyVk([uint16]$VK[$vkName]); ReplyOk $id }
                else { ReplyErr $id "unknown key: $vkName" }
            }
            'foreground' {
                $h = [Win32Input]::GetForegroundWindow()
                $title = [Win32Input]::GetTitle($h)
                $wpid = [Win32Input]::GetPid($h)
                $pname = ''
                try { $pname = (Get-Process -Id $wpid -ErrorAction SilentlyContinue).ProcessName } catch {}
                Reply $id ('"title":"' + (Esc $title) + '","processName":"' + (Esc $pname) + '","hwnd":' + $h.ToInt64())
            }
            'activate' {
                $target = $null
                $procs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
                foreach ($p in $procs) {
                    $okName = (-not $req.processName) -or ($p.ProcessName -eq $req.processName)
                    $okTitle = (-not $req.titleSubstr) -or ($p.MainWindowTitle -like ('*' + $req.titleSubstr + '*'))
                    if ($okName -and $okTitle) { $target = $p; break }
                }
                if ($target) {
                    [Win32Input]::Restore($target.MainWindowHandle) | Out-Null
                    [Win32Input]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
                    Reply $id '"found":true'
                } else {
                    Reply $id '"found":false'
                }
            }
            'launch' {
                Start-Process -FilePath ([string]$req.path) -ErrorAction Stop
                ReplyOk $id
            }
            'uiaInspect' {
                $el = Uia-FromPoint ([int]$req.x) ([int]$req.y)
                $info = Uia-Info $el
                if ($null -eq $info) { Reply $id '"element":null' }
                else { Reply $id $info }
            }
            'uiaFind' {
                $res = Uia-Find $req.uia
                if ($null -eq $res) { Reply $id '"found":false' }
                else { Reply $id ('"found":true,' + $res) }
            }
            default { ReplyErr $id "unknown cmd: $($req.cmd)" }
        }
    } catch {
        ReplyErr $id $_.Exception.Message
    }
}
