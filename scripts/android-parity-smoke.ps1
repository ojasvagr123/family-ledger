$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe'

function Read-Ui {
  for ($snapshotAttempt = 0; $snapshotAttempt -lt 3; $snapshotAttempt++) {
    $strictPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'SilentlyContinue'
      & $adb shell uiautomator dump /sdcard/familyledger-parity.xml 2>$null | Out-Null
      $dumpExitCode = $LASTEXITCODE
      $rawDocument = if ($dumpExitCode -eq 0) { & $adb shell cat /sdcard/familyledger-parity.xml 2>$null } else { $null }
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
  for ($attempt = 0; $attempt -lt 10; $attempt++) {
    Start-Sleep -Seconds 1
    $document = Read-Ui
    if ($null -ne $document -and $document.OuterXml.Contains($expected)) {
      Write-Output "PASS Android route $route renders $expected"
      return
    }
  }
  throw "Route $route did not show expected text: $expected"
}

Open-Route 'transactions' 'Search description, remarks, category or account'
Open-Route 'accounts' 'Accounts dashboard'
Open-Route 'settings/categories' 'Categories'
Open-Route 'settings/family' 'Family settings'
Open-Route 'family/members' 'Family members'
Open-Route 'family/invitations' 'Invitation links'
Open-Route 'family/join-requests' 'Join requests'
Open-Route 'transactions/trash' 'Transaction trash'
Open-Route 'imports/csv' 'Import CSV'
Open-Route 'reports/custom' 'Custom report'
Open-Route 'reports/annual' 'Annual report'
Open-Route 'help' 'Help'
Open-Route 'create-family' 'See a complete sample ledger'
Open-Route 'home' 'Pilot QA'

Write-Output 'PASS Android workbook-parity route suite'
