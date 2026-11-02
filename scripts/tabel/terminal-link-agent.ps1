# Faqat shu kompyuter: 127.0.0.1:39221. Parol tashqariga chiqmaydi.
$ErrorActionPreference = "Stop"
$prefix = "http://127.0.0.1:39221/"
$script = Join-Path $PSScriptRoot "link-face-terminal.ps1"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "TERMINAL_AGENT_OK $prefix"

function Send($ctx, [int]$code, $obj) {
  $json = $obj | ConvertTo-Json -Compress -Depth 6
  $bytes = [Text.Encoding]::UTF8.GetBytes($json)
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = "application/json; charset=utf-8"
  $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
  $ctx.Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
  $ctx.Response.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS")
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.Close()
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    if ($ctx.Request.HttpMethod -eq "OPTIONS") { Send $ctx 204 @{ ok = $true }; continue }
    $path = $ctx.Request.Url.AbsolutePath
    if ($ctx.Request.HttpMethod -ne "POST" -or ($path -ne "/link" -and $path -ne "/push-face")) {
      Send $ctx 404 @{ ok = $false; error = "not_found" }
      continue
    }
    if ($path -eq "/push-face") {
      $reader = New-Object IO.StreamReader($ctx.Request.InputStream, [Text.Encoding]::UTF8)
      $raw = $reader.ReadToEnd()
      $reader.Close()
      $body = $raw | ConvertFrom-Json
      $ip = [string]$body.ip
      $pass = [string]$body.password
      $emp = [string]$body.employee_no
      $name = ([string]$body.name).Replace('"','')
      if ($name.Length -gt 32) { $name = $name.Substring(0, 32) }
      if (-not $ip -or -not $pass -or -not $emp) { Send $ctx 400 @{ ok = $false; error = "bad_request" }; continue }
      $probe = & curl.exe -sS --max-time 4 "http://$ip/ISAPI/System/deviceInfo" 2>$null
      if ($probe -match "<lockStatus>\s*lock\s*</lockStatus>") { Send $ctx 423 @{ ok = $false; error = "locked" }; continue }
      $userJson = '{"UserInfo":{"employeeNo":"' + $emp + '","name":"' + $name + '","userType":"normal","Valid":{"enable":true,"beginTime":"2017-08-01T00:00:00","endTime":"2037-12-31T23:59:59","timeType":"local"},"doorRight":"1","RightPlan":[{"doorNo":1,"planTemplateNo":"1"}]}}'
      $userFile = Join-Path $env:TEMP ("salec-user-" + $emp + ".json")
      Set-Content -Path $userFile -Value $userJson -Encoding ascii
      $userOut = & curl.exe -sS --max-time 20 --digest -u "admin:$pass" -X PUT -H "Content-Type: application/json" --data-binary "@$userFile" "http://$ip/ISAPI/AccessControl/UserInfo/SetUp?format=json" 2>$null
      Remove-Item $userFile -ErrorAction SilentlyContinue
      if ($userOut -match "<lockStatus>\s*lock\s*</lockStatus>|`"lockStatus`"\s*:\s*`"lock`"") { Send $ctx 423 @{ ok = $false; error = "locked" }; continue }
      if ($userOut -match "401|Unauthorized") { Send $ctx 401 @{ ok = $false; error = "unauthorized" }; continue }
      if ($userOut -notmatch "ok|OK|statusCode.:.1") { Send $ctx 422 @{ ok = $false; error = "user_failed"; detail = ([string]$userOut).Substring(0, [Math]::Min(180, ([string]$userOut).Length)) }; continue }
      if (-not $body.face_base64) { Send $ctx 200 @{ ok = $true; face = $false }; continue }
      $jpg = Join-Path $env:TEMP ("salec-face-" + $emp + ".jpg")
      [IO.File]::WriteAllBytes($jpg, [Convert]::FromBase64String([string]$body.face_base64))
      $py = Join-Path $PSScriptRoot "push-face.py"
      $faceOut = & python $py $ip "admin" $pass $emp $name $jpg 2>$null
      Remove-Item $jpg -ErrorAction SilentlyContinue
      if ($faceOut -match "LOCKED|UNAUTHORIZED") { Send $ctx 423 @{ ok = $false; error = "locked" }; continue }
      if ($faceOut -match "OK") { Send $ctx 200 @{ ok = $true; face = $true } } else { Send $ctx 422 @{ ok = $false; error = "face_failed" } }
      continue
    }
    $reader = New-Object IO.StreamReader($ctx.Request.InputStream, $ctx.Request.ContentEncoding)
    $raw = $reader.ReadToEnd()
    $reader.Close()
    $body = $raw | ConvertFrom-Json
    $pass = [string]$body.password
    if (-not $pass) { Send $ctx 400 @{ ok = $false; error = "password_required"; message = "Admin paroli kerak." }; continue }
    $outFile = Join-Path $env:TEMP ("salec-link-" + [guid]::NewGuid().ToString() + ".json")
    $args = @(
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $script,
      "-Password", $pass,
      "-Branch", ([string]$body.branch),
      "-PairingCode", ([string]$body.pairing_code),
      "-IngestUrl", $(if ($body.ingest_url) { [string]$body.ingest_url } else { "https://api.salesarena.sale/api/aksit/mobile/attendance/device-ingest" })
    )
    $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $args -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $outFile
    $text = if (Test-Path $outFile) { Get-Content $outFile -Raw } else { "" }
    Remove-Item $outFile -ErrorAction SilentlyContinue
    $code = if ($proc.ExitCode -eq 0) { 200 } elseif ($proc.ExitCode -eq 3) { 401 } else { 422 }
    try { $parsed = $text | ConvertFrom-Json } catch { $parsed = @{ ok = $false; message = $text } }
    Send $ctx $code $parsed
  } catch {
    try { Send $ctx 500 @{ ok = $false; error = "agent_error"; message = $_.Exception.Message } } catch {}
  }
}
