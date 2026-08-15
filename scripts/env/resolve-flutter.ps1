# Flutter, Java, Android SDK yo'llarini avtomatik topish
$ErrorActionPreference = "Stop"

function Find-FlutterBin {
  $candidates = @(
    (Get-Command flutter -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source),
    "C:\src\flutter\bin\flutter.bat",
    "$env:LOCALAPPDATA\flutter\bin\flutter.bat",
    "C:\flutter\bin\flutter.bat"
  ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
  if (-not $candidates) { throw "Flutter topilmadi. PATH ga qo'shing yoki C:\src\flutter o'rnating." }
  return (Split-Path $candidates[0] -Parent)
}

function Find-JavaHome {
  $candidates = @(
    $env:JAVA_HOME,
    "C:\Program Files\Android\Android Studio\jbr"
  ) | Where-Object { $_ -and (Test-Path (Join-Path $_ "bin\java.exe")) } | Select-Object -Unique
  if (-not $candidates) { throw "JAVA_HOME topilmadi (Android Studio JBR kerak)." }
  return $candidates[0]
}

function Set-MobileBuildEnv {
  $flutterBin = Find-FlutterBin
  $javaHome = Find-JavaHome
  $androidHome = if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) {
    $env:ANDROID_HOME
  } else {
    Join-Path $env:LOCALAPPDATA "Android\Sdk"
  }
  if (-not (Test-Path $androidHome)) { throw "Android SDK topilmadi: $androidHome" }

  $env:JAVA_HOME = $javaHome
  $env:ANDROID_HOME = $androidHome
  $env:PATH = "$flutterBin;$javaHome\bin;$androidHome\platform-tools;$env:PATH"
  return @{
    FlutterBin = $flutterBin
    JavaHome   = $javaHome
    AndroidHome = $androidHome
  }
}
