param(
    [Parameter(Mandatory)][string]$Old,
    [Parameter(Mandatory)][string]$New,
    [string]$Vault = 'D:\doc\Obsidian Vault'
)
$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$clipFolders = @('00-inbox', 'Clippings')
$topicDir = Join-Path $Vault '10-topics'
$oldPage = Join-Path $topicDir ($Old + '.md')
$newPage = Join-Path $topicDir ($New + '.md')
if (-not (Test-Path -LiteralPath $oldPage)) { throw 'topic page not found: ' + $Old }
if (Test-Path -LiteralPath $newPage) { throw 'target page already exists: ' + $New }
$charClass = '["' + [char]39 + ']'

function Get-FmTopic($path) {
    $t = [System.IO.File]::ReadAllText($path)
    $m = [regex]::Match($t, '^(?s)---\r?\n(.*?)\r?\n---')
    if (-not $m.Success) { return $null }
    $lm = [regex]::Match($m.Groups[1].Value, '(?m)^topic:\s*(.+?)\s*$')
    if (-not $lm.Success) { return $null }
    return $lm.Groups[1].Value.Trim([char]34, [char]39)
}

# 1) update page content: quoted base-filter values, frontmatter topic, H1
$src = [System.IO.File]::ReadAllText($oldPage)
$newC = $src.Replace('"' + $Old + '"', '"' + $New + '"')
$newC = [regex]::Replace($newC, '(?m)^(topic:\s*)' + [regex]::Escape($Old) + '\s*$', ('$1' + $New))
$newC = [regex]::Replace($newC, '(?m)^# ' + [regex]::Escape($Old) + '$', '# ' + $New)
[System.IO.File]::WriteAllText($oldPage, $newC, $enc)
$destPath = Join-Path $topicDir ($New + '.md')
try { [System.IO.File]::Move($oldPage, $destPath) } catch { Write-Host ('MOVE FAILED old=[' + (($oldPage.ToCharArray() | Where-Object { [int]$_ -gt 126 }) -join '|') + '] dest=[' + (($destPath.ToCharArray() | Where-Object { [int]$_ -gt 126 }) -join '|') + ']'); throw }

# 2) update clip notes: frontmatter topic property (strip optional quotes)
$pat = '(?m)^(topic:\s*)' + $charClass + '?' + [regex]::Escape($Old) + $charClass + '?\s*$'
$n = 0
foreach ($f in $clipFolders) {
    $dir = Join-Path $Vault $f
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter *.md | ForEach-Object {
        $p = $_.FullName
        if ((Get-FmTopic $p) -eq $Old) {
            $t = [System.IO.File]::ReadAllText($p)
            $t2 = [regex]::Replace($t, $pat, ('$1' + $New), 1)
            [System.IO.File]::WriteAllText($p, $t2, $enc)
            $n++
        }
    }
}

# 3) remove stale export files (regenerate later if needed)
foreach ($f in @('open-' + $Old + '.bat', 'bookmarks-' + $Old + '.html')) {
    $p = Join-Path $topicDir $f
    if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p }
}

# 4) leftover scan
$left = 0
foreach ($f in $clipFolders) {
    $dir = Join-Path $Vault $f
    if (-not (Test-Path -LiteralPath $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Filter *.md | ForEach-Object {
        if ((Get-FmTopic $_.FullName) -eq $Old) { $left++; Write-Host ('leftover clip: ' + $_.Name) }
    }
}
Get-ChildItem -LiteralPath $topicDir -Filter *.md | ForEach-Object {
    $t = [System.IO.File]::ReadAllText($_.FullName)
    if ($t.Contains('"' + $Old + '"')) { $left++; Write-Host ('leftover page content: ' + $_.Name) }
    if ((Get-FmTopic $_.FullName) -eq $Old) { $left++; Write-Host ('leftover page property: ' + $_.Name) }
}
if ($left -gt 0) { throw ('rename left ' + $left + ' reference(s) to ' + $Old) }
Write-Host ('renamed topic: ' + $Old + ' -> ' + $New + ' (page + ' + $n + ' clip notes)')


