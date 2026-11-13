# Tuzatish navbati (doimiy)

Oxirgi yangilanish: 2026-11-12

## Kod + prod — asosan ✅

| # | Vazifa | Holat |
|---|---|---|
| 1–12 | Audit F0→P1 | ✅ |
| 13 | To‘lov + mobil `client_uuid` | ✅ |
| 14 | Vazvrat `client_uuid` | ✅ |
| 15 | Frontend zakaz/to‘lov UUID | ✅ |
| 16 | `must_change_password` web+mobil | ✅ |
| 17 | Worker + CRON_VIA_WORKER + TRUST_PROXY | ✅ prod |
| 18 | Migrations `client_uuid` ×3 | ✅ prod |
| 19 | Frontend deploy | ✅ |

## Mobil Sa redesign (2026-11-12)

| Holat | Nima |
|---|---|
| ✅ | Sa design_system + motion, tezkor panel + customize, list/grid katalog |
| ✅ | ANR yumshatish, role_guard `/settings/quick` + `/bonuses` |
| ✅ | Seed agent mijozlari (`clients=8` sync) + KPI/marshrut/xarita/drawer Sa motion |
| ✅ | Bonus ladder + shelf-return Sa motion |
| ✅ | ANR stress smoke (sync + tab nav, `ANR_CLEAN`) |
| ✅ | Nav sahifalar to‘liq Sa design (visits/orders/report/clients/debtors/warehouse/draft/settings/tabel/search/…) |

## Hali ochiq

| # | Nima | Sabab / qadam |
|---|---|---|
| A | Andijon `device_token` URL | Bu PC LAN da emas (`192.168.100.127` ochilmaydi) — ofis PC |
| B | GitHub Private | `gh auth login` → `gh repo edit Unknown0223/NEW_PRO --visibility private` |
| C | `git filter-repo` | Private dan keyin, force-push |
| D | Yangi OTA jks | Mavjud kalitni buzmang (telefonlar) |
| E | TOTP / Fastify 5 | Keyingi katta PR |
| F | Mobil redesign | ✅ nav + shallow `create_order` / order detail Sa* |

## Andijon (ofis)

```powershell
powershell -File scripts/tabel/link-face-terminal.ps1 `
  -Password "<terminal>" -PairingCode 605622 -Branch Andijon `
  -DeviceToken "<meta.device_token>" `
  -IngestUrl "https://api.salesarena.sale/api/aksit/mobile/attendance/device-ingest"
```
