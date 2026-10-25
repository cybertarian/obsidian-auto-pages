param(
    [Parameter(Mandatory)][string]$Note,
    [string]$OutDir
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Note)) { throw 'Note not found: ' + $Note }
if (-not $OutDir) { $OutDir = Split-Path -LiteralPath $Note }
$name = (Split-Path $Note -Leaf).Replace('.md','')

$urls = [System.Collections.Generic.List[string]]::new()

# 1) URLs written in the topic page itself (curated section)
$text = [System.IO.File]::ReadAllText($Note)
[regex]::Matches($text, 'https?://[^\s"<>|,\[\]]+') | ForEach-Object {
    $u = $_.Value
    if ($u -notmatch 'xxx' -and $u -notmatch '\.(png|jpe?g|gif|webp|mp4)(\?|$)' -and $u -notmatch '/attachments/' -and -not $urls.Contains($u)) { $urls.Add($u) }
}

# 2) source property of clip notes tagged with this topic
$clipFolders = @('00-inbox', 'Clippings')
$vault = Split-Path (Split-Path $Note -Parent) -Parent
foreach ($f in $clipFolders) {
    $dir = Join-Path $vault $f
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter *.md | ForEach-Object {
        $t = [System.IO.File]::ReadAllText($_.FullName)
        $m = [regex]::Match($t, '^(?s)---\r?\n(.*?)\r?\n---')
        if (-not $m.Success) { return }
        $fm = $m.Groups[1].Value
        $tm = [regex]::Match($fm, '(?m)^topic:\s*(.+?)\s*$')
        if (-not $tm.Success) { return }
        $tv = $tm.Groups[1].Value.Trim([char]34, [char]39)
        if ($tv -ne $name) { return }
        $sm = [regex]::Match($fm, '(?m)^source:\s*(.+?)\s*$')
        if ($sm.Success) { $sv = $sm.Groups[1].Value.Trim([char]34); if ($sv -match '^https?://' -and -not $urls.Contains($sv)) { $urls.Add($sv) } }
    }
}

$arr = @($urls | Sort-Object -Unique)
if ($arr.Count -eq 0) { throw 'no URLs found (page has none, no clips with source property)' }

# 3) write .bat (one window, all tabs) and .html (importable bookmarks)
$nl = [System.Environment]::NewLine
$q = '"'
$bat = Join-Path $OutDir ('open-' + $name + '.bat')
$html = Join-Path $OutDir ('bookmarks-' + $name + '.html')
$allQ = (($arr | ForEach-Object { $q + $_ + $q }) -join ' ')
$batLines = @('@echo off', 'REM one-click open all in one new window; if chrome is not on PATH replace with your browser full path', ('start ' + $q + $name + $q + ' chrome ' + $allQ))
[System.IO.File]::WriteAllText($bat, ($batLines -join $nl))
$anchors = $arr | ForEach-Object { '<A HREF=' + $q + ($_ -replace [char]34, '') + $q + '>' + $_ + '</A>' }
$doc = @('<!DOCTYPE NETSCAPE-Bookmark-file-1>', '<TITLE>Bookmarks</TITLE>', '<H1>Bookmarks</H1>', '<DL><p>', '<DT><H3>' + $name + '</H3>', '<DL><p>', ($anchors -join $nl), '</DL><p>', '</DL><p>') -join $nl
[System.IO.File]::WriteAllText($html, $doc)
Write-Host ('Exported ' + $arr.Count + ' URLs -> ' + $bat + ' / ' + $html)