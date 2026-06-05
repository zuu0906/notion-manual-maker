param([string]$ImagePath)
$ErrorActionPreference = 'SilentlyContinue'

# Force UTF-8 output to avoid encoding issues on Japanese Windows
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# C# helper for proper JSON escaping (avoids ConvertTo-Json encoding bugs)
Add-Type -TypeDefinition @"
using System;
using System.Text;
public static class OcrJson {
    public static string Escape(string s) {
        if (s == null) return "";
        var sb = new StringBuilder();
        foreach (char c in s) {
            switch (c) {
                case '"':  sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b");  break;
                case '\f': sb.Append("\\f");  break;
                case '\n': sb.Append("\\n");  break;
                case '\r': sb.Append("\\r");  break;
                case '\t': sb.Append("\\t");  break;
                default:
                    if ((int)c < 0x20) sb.AppendFormat("\\u{0:x4}", (int)c);
                    else sb.Append(c);
                    break;
            }
        }
        return sb.ToString();
    }
}
"@

# Load System.Runtime.WindowsRuntime
try {
    $srrPath = [System.IO.Path]::Combine(
        [System.Runtime.InteropServices.RuntimeEnvironment]::GetRuntimeDirectory(),
        'System.Runtime.WindowsRuntime.dll'
    )
    if (Test-Path $srrPath) { Add-Type -Path $srrPath }
    else { Add-Type -AssemblyName System.Runtime.WindowsRuntime }
} catch {}

# Load WinRT types
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapAlphaMode, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType=WindowsRuntime]

# AsTask generic helper
function Await-As($asyncOp, [Type]$resultType) {
    $found = $null
    foreach ($m in [System.WindowsRuntimeSystemExtensions].GetMethods()) {
        if ($m.Name -eq 'AsTask' -and $m.IsGenericMethodDefinition -and $m.GetParameters().Count -eq 1) {
            $found = $m
            break
        }
    }
    $task = $found.MakeGenericMethod($resultType).Invoke($null, @($asyncOp))
    $task.Wait()
    return $task.Result
}

try {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) {
        $lang = New-Object Windows.Globalization.Language('ja')
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }
    if ($null -eq $engine) { Write-Output '[]'; exit 0 }

    $bytes = [System.IO.File]::ReadAllBytes($ImagePath)
    $ms = New-Object System.IO.MemoryStream(,$bytes)
    $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)

    $decoder = Await-As ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap  = Await-As ($decoder.GetSoftwareBitmapAsync(
        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8,
        [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied
    )) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $ocrResult = Await-As ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

    # Build JSON manually to avoid ConvertTo-Json encoding bugs
    $parts = [System.Collections.Generic.List[string]]::new()
    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $esc = [OcrJson]::Escape($word.Text)
            $parts.Add('{"t":"' + $esc + '","x":' + [int]$word.BoundingRect.X + ',"y":' + [int]$word.BoundingRect.Y + ',"w":' + [int]$word.BoundingRect.Width + ',"h":' + [int]$word.BoundingRect.Height + '}')
        }
    }

    [Console]::Out.Write('[' + [string]::Join(',', $parts) + ']')
    [Console]::Out.Flush()
} catch {
    "CATCH: $($_.Exception.Message) LINE: $($_.ScriptStackTrace)" | Out-File "$ImagePath.ocr.log"
    Write-Output '[]'
}
