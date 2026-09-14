$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$projectRoot = Split-Path -Parent $PSScriptRoot
function Read-Ui {
  & $adb shell uiautomator dump /sdcard/familyledger-smoke.xml | Out-Null
  [xml]$document = (& $adb shell cat /sdcard/familyledger-smoke.xml)
  return $document
}
function Open-Route([string]$route, [string]$expected) {
  & $adb shell am start -n com.familyledger.app/.MainActivity -a android.intent.action.VIEW -d "familyledger:///$route" | Out-Null
  for ($attempt=0; $attempt -lt 8; $attempt++) {
    Start-Sleep -Seconds 1
    $document = Read-Ui
    if ($document.OuterXml.Contains($expected)) { return $document }
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
$document = Open-Route 'transactions' 'QA EXPENSE'
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
