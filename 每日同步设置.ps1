param([ValidatePattern('^([01]\d|2[0-3]):[0-5]\d$')][string]$At = '08:30')
$ErrorActionPreference = 'Stop'
$taskName = 'Delta Daily ZXFPS Price Sync'
$scriptPath = Join-Path $PSScriptRoot 'daily-sync.mjs'
$runtimeNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else { $runtimeNode }
if (-not (Test-Path -LiteralPath $nodePath)) { throw '请先安装 Node.js 22 或更新版本。' }
if (-not (Test-Path -LiteralPath $scriptPath)) { throw '每日同步程序缺失。' }
$atTime = [datetime]::ParseExact($At, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$action = New-ScheduledTaskAction -Execute $nodePath -Argument ('"' + $scriptPath + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $atTime
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description '每日从公开页面同步卡战备和特勤处制造参考价格' -Force | Out-Null
Write-Host "已设置每天 $At（北京时间）同步。电脑需开机并处于登录状态；当前可先手动运行 daily-sync.mjs。"
