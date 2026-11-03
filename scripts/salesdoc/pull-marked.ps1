# Belgilangan 9 diler. Parol faqat muhitdan. Foto olinmaydi.
$ErrorActionPreference = "Stop"
$root = "D:\salesdoc-pull"
$script = Join-Path $PSScriptRoot "pull-andijon.ps1"
$dealers = @(
  @{ id = 1; name = "Andijon"; dir = "andijon" },
  @{ id = 2; name = "Namangan"; dir = "namangan" },
  @{ id = 5; name = "Qoqon"; dir = "qoqon" },
  @{ id = 6; name = "Farg'ona"; dir = "fargona" },
  @{ id = 7; name = "Xorazm"; dir = "xorazm" },
  @{ id = 8; name = "Nukus"; dir = "nukus" },
  @{ id = 9; name = "Samarqand"; dir = "samarqand" },
  @{ id = 10; name = "Buxoro"; dir = "buxoro" },
  @{ id = 11; name = "Navoiy"; dir = "navoiy" }
)
foreach ($d in $dealers) {
  $out = Join-Path $root $d.dir
  Write-Host "START $($d.name) $($d.id) -> $out"
  & $script -DealerId $d.id -DealerName $d.name -From "2020-01-01" -OutDir $out -Group "all"
  Write-Host "DONE $($d.name)"
}
Write-Host "ALL_DEALERS_DONE"
