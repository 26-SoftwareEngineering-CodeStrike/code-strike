# Dot-source from apps/server before Python/Alembic/worker commands:
# . ./scripts/load-env.ps1
# Values are literal; no shell interpolation, no output of secrets.
param([string]$Path = (Join-Path $PSScriptRoot '..\.env'))
if (-not (Test-Path -LiteralPath $Path)) {
    throw 'Create apps/server/.env from .env.example first.'
}
foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $entry = $line.Trim()
    if (-not $entry -or $entry.StartsWith('#')) { continue }
    $pair = $entry.Split('=', 2)
    if ($pair.Length -ne 2 -or $pair[0] -notmatch '^[A-Z][A-Z0-9_]*$') {
        throw 'Invalid .env entry; expected UPPER_CASE_KEY=literal_value.'
    }
    $value = $pair[1].Trim()
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($pair[0], $value, 'Process')
}
