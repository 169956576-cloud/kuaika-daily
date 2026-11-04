$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (-not (Test-Path -LiteralPath $nodePath)) { throw '请先安装 Node.js 22 或更新版本，再重新启动。' }
$sitePort = 3211
$envPath = Join-Path $siteRoot '.env'
if (Test-Path -LiteralPath $envPath) {
    $portMatch = Get-Content -LiteralPath $envPath | Select-String '^PORT=(\d+)$' | Select-Object -First 1
    if ($portMatch) { $sitePort = [int]$portMatch.Matches[0].Groups[1].Value }
}
$alreadyRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:$sitePort/" -TimeoutSec 2 -UseBasicParsing
    $alreadyRunning = $response.Content -match 'kuaika.com'
} catch {}
if (-not $alreadyRunning) {
    Start-Process -FilePath $nodePath -ArgumentList @('server.mjs') -WorkingDirectory $siteRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $siteRoot 'server.log') -RedirectStandardError (Join-Path $siteRoot 'server-error.log')
    Start-Sleep -Seconds 2
}
Start-Process "http://localhost:$sitePort/"
Write-Host "网站已启动：http://localhost:$sitePort/"
