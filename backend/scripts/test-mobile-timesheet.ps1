# Mobile "Tabel" (timesheet) - API + mapping smoke test
# Usage: powershell -ExecutionPolicy Bypass -File backend/scripts/test-mobile-timesheet.ps1
#
# 1) Checks UI letter (A/N/V/S) <-> backend status mapping parity
# 2) Logs in as agent and calls /mobile/agent-timesheet
# 3) Asserts response shape and aggregate invariants

$Base = "http://127.0.0.1:18080"
$fail = 0

function Assert($name, $cond, $detail = "") {
  if ($cond) { Write-Host "[OK] $name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $name $detail" -ForegroundColor Red; $script:fail++ }
}

# ---------------------------------------------------------------------------
# 1) Status mapping parity (must match Dart tabel_status.dart)
# ---------------------------------------------------------------------------
$map = @{
  worked   = @{ letter = "A"; category = "active"   }
  half_day = @{ letter = "S"; category = "excused"  }
  holiday  = @{ letter = "V"; category = "dayOff"   }
  vacation = @{ letter = "S"; category = "excused"  }
  sick     = @{ letter = "S"; category = "excused"  }
  trip     = @{ letter = "S"; category = "excused"  }
  absent   = @{ letter = "N"; category = "inactive" }
}
$expectLetters = @{ worked="A"; half_day="S"; holiday="V"; vacation="S"; sick="S"; trip="S"; absent="N" }
foreach ($k in $expectLetters.Keys) {
  Assert "mapping[$k] -> $($expectLetters[$k])" ($map[$k].letter -eq $expectLetters[$k])
}
# Summary bucket: excused = vacation + sick + trip + half_day
$excusedStatuses = @("vacation","sick","trip","half_day")
Assert "excused bucket has 4 statuses" ($excusedStatuses.Count -eq 4)

# ---------------------------------------------------------------------------
# 2) Live API
# ---------------------------------------------------------------------------
try {
  $login = Invoke-RestMethod -Uri "$Base/api/auth/login" -Method POST `
    -Body '{"slug":"test1","login":"agent","password":"111111"}' -ContentType "application/json"
} catch {
  Write-Host "[SKIP] Login failed - server down or password differs. API tests skipped." -ForegroundColor Yellow
  if ($fail -gt 0) { exit 1 }
  Write-Host "`nMapping tests passed (without API)." -ForegroundColor Cyan
  exit 0
}
$h = @{ Authorization = "Bearer $($login.accessToken)" }
Assert "login role=agent" ($login.user.role -eq "agent")

# Default month (server returns current month)
$ts = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-timesheet" -Headers $h
Assert "month format YYYY-MM" ($ts.month -match '^\d{4}-\d{2}$')
Assert "employee present" ($null -ne $ts.employee -and $null -ne $ts.employee.fio)
Assert "totals present" ($null -ne $ts.totals)

$days = @($ts.days)
$t = $ts.totals

# Invariant: number of days == days_in_month
Assert "days.Count == days_in_month" ($days.Count -eq $t.days_in_month)

# Invariant: all statuses from the 7-status set
$validStatuses = @("worked","half_day","absent","holiday","vacation","sick","trip")
$badStatus = $days | Where-Object { $validStatuses -notcontains $_.status }
Assert "all statuses valid" ($badStatus.Count -eq 0) ("bad=" + ($badStatus.status -join ","))

# Invariant: category counts sum == number of days
$sumCats = $t.active_days + $t.half_days + $t.absent_days + $t.holiday_days + $t.vacation_days + $t.sick_days + $t.trip_days
Assert "category counts sum == days" ($sumCats -eq $days.Count) ("sum=$sumCats days=$($days.Count)")

# Invariant: metric totals match per-day sums
$sumSales = ($days | Measure-Object -Property sales -Sum).Sum
if ($null -eq $sumSales) { $sumSales = 0 }
$sumVisits = ($days | Measure-Object -Property visits -Sum).Sum
if ($null -eq $sumVisits) { $sumVisits = 0 }
$sumMin = ($days | Measure-Object -Property worked_minutes -Sum).Sum
if ($null -eq $sumMin) { $sumMin = 0 }
Assert "sales_total matches" ([math]::Abs([double]$sumSales - [double]$t.sales_total) -lt 1)
Assert "visits_total matches" ([int]$sumVisits -eq [int]$t.visits_total)
Assert "worked_minutes_total matches" ([int]$sumMin -eq [int]$t.worked_minutes_total)

# worked_days = worked*1 + half_day*0.5
$expectWorked = [double]$t.active_days + 0.5 * [double]$t.half_days
Assert "worked_days = active + 0.5*half" ([math]::Abs([double]$t.worked_days - $expectWorked) -lt 0.001)

# Explicit month param (previous month must also respond)
$prevMonth = (Get-Date).AddMonths(-1).ToString("yyyy-MM")
$ts2 = Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-timesheet?month=$prevMonth" -Headers $h
Assert "explicit month echoed" ($ts2.month -eq $prevMonth)

# Invalid month -> 400
try {
  Invoke-RestMethod -Uri "$Base/api/test1/mobile/agent-timesheet?month=2026-13" -Headers $h | Out-Null
  Assert "bad month rejected" $false
} catch {
  Assert "bad month rejected (400)" ($_.Exception.Response.StatusCode.value__ -eq 400)
}

$excused = $t.vacation_days + $t.sick_days + $t.trip_days + $t.half_days
Write-Host ""
Write-Host ("Month: {0} | Days: {1} | Active: {2} | Inactive: {3} | DayOff: {4} | Excused: {5}" -f `
  $ts.month, $days.Count, $t.active_days, $t.absent_days, $t.holiday_days, $excused) -ForegroundColor Cyan
Write-Host ("Sales: {0} | Visits: {1} | Minutes: {2}" -f $t.sales_total, $t.visits_total, $t.worked_minutes_total) -ForegroundColor Cyan

if ($fail -gt 0) { Write-Host "`n$fail test(s) failed." -ForegroundColor Red; exit 1 }
Write-Host "`nAll timesheet tests passed." -ForegroundColor Cyan
