$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$adb = 'C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe'
if (-not (Test-Path -LiteralPath $adb)) { throw 'Android SDK platform-tools not found.' }
$devices = & $adb devices
if (-not ($devices -match '\sdevice$')) { throw 'Start the Android emulator in Android Studio, then rerun this script.' }
& $adb reverse tcp:54321 tcp:54321
& $adb reverse tcp:8083 tcp:8083
if ($LASTEXITCODE -ne 0) { throw 'ADB port bridge failed.' }
# Process-local Node setting; no Windows PATH or DNS configuration is changed.
$env:NODE_OPTIONS = "$env:NODE_OPTIONS --dns-result-order=ipv4first".Trim()
Set-Location -LiteralPath (Join-Path $projectRoot 'apps\mobile')
& '.\node_modules\.bin\expo.cmd' start --dev-client --host localhost --port 8083 --android
