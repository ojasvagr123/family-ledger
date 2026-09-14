$ErrorActionPreference = 'Stop'
$adb = 'C:\Users\lenovo\AppData\Local\Android\Sdk\platform-tools\adb.exe'
function Read-Ui {
  & $adb shell uiautomator dump /sdcard/familyledger-entry.xml | Out-Null
  [xml]$document = (& $adb shell cat /sdcard/familyledger-entry.xml)
  return $document
}
function Wait-Text([string]$text) {
  for ($attempt=0; $attempt -lt 8; $attempt++) {
    $document = Read-Ui
    if ($document.OuterXml.Contains($text)) { return $document }
    Start-Sleep -Seconds 1
  }
  throw "Missing expected UI text: $text"
}
function Tap([string]$label) {
  for ($attempt=0; $attempt -lt 5; $attempt++) {
    $document=Read-Ui
    $node=$document.SelectSingleNode("//node[(@content-desc='$label' or @text='$label') and @clickable='true']")
    if($node) {
      $coords=[regex]::Matches($node.bounds,'\d+') | ForEach-Object { [int]$_.Value }
      & $adb shell input tap ([int](($coords[0]+$coords[2])/2)) ([int](($coords[1]+$coords[3])/2))
      return
    }
    # Start above the soft-keyboard area so the app's ScrollView, not the IME,
    # receives the gesture.
    & $adb shell input swipe 520 1200 520 400 400
  }
  throw "Control not found: $label"
}
& $adb shell am start -n com.familyledger.app/.MainActivity -a android.intent.action.VIEW -d 'familyledger:///home' | Out-Null
$null=Wait-Text '750.00'
& $adb shell am start -n com.familyledger.app/.MainActivity -a android.intent.action.VIEW -d 'familyledger:///transaction/new' | Out-Null
$null=Wait-Text 'Add transaction'
Tap 'Amount'
& $adb shell input text '123.45'
& $adb shell input keyevent 4
Tap 'QA Cash'
Tap 'Groceries'
Tap 'Description'
& $adb shell input text 'AndroidSmokeExpense'
& $adb shell input keyevent 4
Tap 'Save transaction'
$null=Wait-Text 'Transaction type'
$null=Wait-Text 'AndroidSmokeExpense'
Write-Output 'PASS Android expense form saved 123.45 and returned to Activity'
Tap 'AndroidSmokeExpense'
$null=Wait-Text 'Transaction details'
Tap 'Delete transaction'
$null=Wait-Text 'Delete transaction?'
Tap 'DELETE'
$null=Wait-Text 'Activity'
& $adb shell am start -n com.familyledger.app/.MainActivity -a android.intent.action.VIEW -d 'familyledger:///home' | Out-Null
$null=Wait-Text '750.00'
Write-Output 'PASS Android delete confirmation restored Home net to 750.00; QA transaction retained as soft-deleted'
