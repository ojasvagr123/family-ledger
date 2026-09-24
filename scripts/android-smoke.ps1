$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Read-Ui {
  for ($snapshotAttempt = 0; $snapshotAttempt -lt 3; $snapshotAttempt++) {
    $strictPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'SilentlyContinue'
      & $adb shell uiautomator dump /sdcard/familyledger-smoke.xml 2>$null | Out-Null
      $dumpExitCode = $LASTEXITCODE
      $rawDocument = if ($dumpExitCode -eq 0) { & $adb shell cat /sdcard/familyledger-smoke.xml 2>$null } else { $null }
    } finally {
      $ErrorActionPreference = $strictPreference
    }
    if ($rawDocument) {
      try { return [xml]$rawDocument } catch { }
    }
    Start-Sleep -Milliseconds 500
  }
  return $null
}
function Open-Route([string]$route, [string]$expected) {
  # Windows PowerShell turns adb's harmless "already-running activity" stderr
  # warning into an ErrorRecord under Stop. Isolate the native call, retain its
  # exit code, and restore strict handling immediately afterwards.
  $strictPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'SilentlyContinue'
    & $adb shell am start -n com.familyledger.app/.MainActivity -a android.intent.action.VIEW -d "familyledger:///$route" 2>$null | Out-Null
    $startExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $strictPreference
  }
  if ($startExitCode -ne 0) { throw "Unable to open Android route: $route" }
  for ($attempt=0; $attempt -lt 8; $attempt++) {
    Start-Sleep -Seconds 1
    $document = Read-Ui
    if ($null -ne $document -and $document.OuterXml.Contains($expected)) { return $document }
  }
  throw "Screen did not show expected text: $expected"
}
function Screenshot([string]$name) {
  & $adb shell screencap -p "/sdcard/$name.png"
  & $adb pull "/sdcard/$name.png" (Join-Path $projectRoot "artifacts\$name.png") | Out-Null
}
$document = Open-Route 'home' 'Pilot QA'
if (-not $document.OuterXml.Contains('750.00')) { throw 'QA Home net does not match 750.00' }
Screenshot 'day2-home'
Write-Output 'PASS Android Home control totals'
$document = Open-Route 'transactions' 'QA INCOME'
# The modern filter controls make the second fixture card fall below the first
# viewport on a phone. Scroll once and verify the expense row instead of assuming
# both records are simultaneously present in the accessibility snapshot.
& $adb shell input swipe 540 1800 540 650 500 | Out-Null
for ($attempt = 0; $attempt -lt 8; $attempt++) {
  Start-Sleep -Seconds 1
  $document = Read-Ui
  if ($null -ne $document -and $document.OuterXml.Contains('QA EXPENSE')) { break }
}
if ($null -eq $document -or -not $document.OuterXml.Contains('QA EXPENSE')) { throw 'Android Activity did not render the expense fixture after scrolling' }
Screenshot 'day2-activity'
Write-Output 'PASS Android Activity renders income and expense'
$document = Open-Route 'reports' 'Monthly report'
if (-not $document.OuterXml.Contains('750.00')) { throw 'Monthly net does not match 750.00' }
Screenshot 'day2-report'
Write-Output 'PASS Android Monthly Report control totals'
$document = Open-Route 'accounts' 'QA Cash'
if (-not $document.OuterXml.Contains('850.00')) { throw 'Account balance does not match 850.00' }
Screenshot 'day2-accounts'
Write-Output 'PASS Android Accounts opening balance plus transactions'
$document = Open-Route 'home' 'Pilot QA'
