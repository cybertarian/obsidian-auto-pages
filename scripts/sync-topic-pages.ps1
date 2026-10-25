param([string]$Vault = 'D:\doc\Obsidian Vault')
$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$clipFolders = @('00-inbox', 'Clippings')
$topicDir = Join-Path $Vault '10-topics'
$tmpl = Join-Path $Vault '90-templates\topic-template.md'

function Get-FmTopic($path) {
    $t = [System.IO.File]::ReadAllText($path)
    $m = [regex]::Match($t, '^(?s)---\r?\n(.*?)\r?\n---')
    if (-not $m.Success) { return $null }
    $lm = [regex]::Match($m.Groups[1].Value, '(?m)^topic:\s*(.+?)\s*$')
    if (-not $lm.Success) { return $null }
    return $lm.Groups[1].Value.Trim([char]34, [char]39)
}

$topics = [System.Collections.Generic.List[string]]::new()
foreach ($f in $clipFolders) {
    $dir = Join-Path $Vault $f
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter *.md | ForEach-Object {
        $v = Get-FmTopic $_.FullName
        if ($v -and $v -ne '' -and -not $topics.Contains($v)) { $topics.Add($v) }
    }
}

$existing = [System.Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $topicDir) {
    Get-ChildItem -LiteralPath $topicDir -Filter *.md | ForEach-Object { $existing.Add($_.BaseName) }
}

$tmplText = [System.IO.File]::ReadAllText($tmpl)
$created = @(); $skipped = @()
foreach ($t in ($topics | Sort-Object)) {
    if ($existing.Contains($t)) { $skipped += $t; continue }
    $path = Join-Path $topicDir ($t + '.md')
    [System.IO.File]::WriteAllText($path, $tmplText.Replace('{{title}}', $t), $enc)
    $created += $t
}

$drift = @()
if (Test-Path -LiteralPath $topicDir) {
    Get-ChildItem -LiteralPath $topicDir -Filter *.md | ForEach-Object {
        $v = Get-FmTopic $_.FullName
        if ($v -and $v -ne $_.BaseName) { $drift += ($_.Name + ' (property: ' + $v + ')') }
    }
}

if ($created.Count -eq 0 -and $skipped.Count -eq 0 -and $drift.Count -eq 0) {
    Write-Host 'nothing to do'
} else {
    if ($created.Count) { Write-Host ('created: ' + ($created -join ', ')) } else { Write-Host 'created: (none)' }
    if ($skipped.Count) { Write-Host ('already: ' + ($skipped -join ', ')) }
    if ($drift.Count) { Write-Host ('DRIFT (filename vs property): ' + ($drift -join '; ')) }
}