$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
$ownerExpected = '169956576-cloud'
$repositoryName = 'kuaika-daily'
$repository = "$ownerExpected/$repositoryName"
$ghPath = 'C:\Program Files\GitHub CLI\gh.exe'
$gitCommand = Get-Command git -ErrorAction SilentlyContinue
$gitPath = if ($gitCommand) { $gitCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe' }

if (-not (Test-Path -LiteralPath $ghPath)) { throw 'GitHub CLI was not found. Install it and reopen PowerShell.' }
if (-not (Test-Path -LiteralPath $gitPath)) { throw 'Git was not found. Install Git for Windows and reopen PowerShell.' }

if (-not $env:HTTPS_PROXY -and (Test-NetConnection 127.0.0.1 -Port 9674 -InformationLevel Quiet)) {
    $env:HTTPS_PROXY = 'http://127.0.0.1:9674'
    $env:HTTP_PROXY = $env:HTTPS_PROXY
    $env:https_proxy = $env:HTTPS_PROXY
    $env:http_proxy = $env:HTTPS_PROXY
}

& $ghPath auth status
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in. Run gh auth login first.' }
$owner = (& $ghPath api user --jq .login).Trim()
if ($owner -ne $ownerExpected) { throw "Current account is $owner; expected $ownerExpected. No repository was created." }

Push-Location $siteRoot
$oldGitConfigCount = $env:GIT_CONFIG_COUNT
$gitConfigIndex = if ([string]::IsNullOrWhiteSpace($oldGitConfigCount)) { 0 } else { [int]$oldGitConfigCount }
$gitConfigKeyName = "GIT_CONFIG_KEY_$gitConfigIndex"
$gitConfigValueName = "GIT_CONFIG_VALUE_$gitConfigIndex"
$oldGitConfigKey = [Environment]::GetEnvironmentVariable($gitConfigKeyName, 'Process')
$oldGitConfigValue = [Environment]::GetEnvironmentVariable($gitConfigValueName, 'Process')
try {
    $env:GIT_CONFIG_COUNT = [string]($gitConfigIndex + 1)
    [Environment]::SetEnvironmentVariable($gitConfigKeyName, 'safe.directory', 'Process')
    [Environment]::SetEnvironmentVariable($gitConfigValueName, $siteRoot.Replace('\', '/'), 'Process')
    if (-not (Test-Path -LiteralPath (Join-Path $siteRoot '.git'))) {
        & $gitPath init --initial-branch=main
        if ($LASTEXITCODE -ne 0) { throw 'Could not initialize the local repository.' }
    }
    & $gitPath config user.name $ownerExpected
    & $gitPath config user.email "${ownerExpected}@users.noreply.github.com"
    & $gitPath add -A
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage the site files.' }
    & $gitPath add -f data/zxfps-latest.json
    if ($LASTEXITCODE -ne 0) { throw 'Could not stage the latest market snapshot.' }
    & $gitPath diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
        & $gitPath commit -m 'Publish kuaika.com daily dashboard'
        if ($LASTEXITCODE -ne 0) { throw 'Could not commit the site files.' }
    }
    $remotes = @(& $gitPath remote)
    if ($remotes -contains 'origin') {
        $remoteUrl = (& $gitPath remote get-url origin).Trim()
        if ($remoteUrl -ne "https://github.com/$repository.git") { throw "Unexpected origin remote: $remoteUrl. Stopped before pushing." }
    } else {
        & $ghPath repo create $repository --public --source $siteRoot --remote origin
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the public repository. Check whether it already exists and verify the network.' }
    }
    & $gitPath push --set-upstream origin main
    if ($LASTEXITCODE -ne 0) { throw 'Push failed. The repository may exist; fix the network and retry git push.' }
    Write-Host "Site files pushed. GitHub Pages URL: https://${ownerExpected}.github.io/${repositoryName}/"
    Write-Host 'Wait for the Publish kuaika.com workflow to finish in the GitHub Actions page.'
} finally {
    $env:GIT_CONFIG_COUNT = $oldGitConfigCount
    [Environment]::SetEnvironmentVariable($gitConfigKeyName, $oldGitConfigKey, 'Process')
    [Environment]::SetEnvironmentVariable($gitConfigValueName, $oldGitConfigValue, 'Process')
    Pop-Location
}
