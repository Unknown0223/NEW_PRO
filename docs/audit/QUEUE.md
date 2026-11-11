# Tuzatish navbati (doimiy)

Oxirgi yangilanish: 2026-11-11

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

## Mobil Sa redesign (2026-11-11)

| Holat | Nima |
|---|---|
| ✅ | Sa design_system + motion, tezkor panel + customize, list/grid katalog |
| ✅ | ANR yumshatish, role_guard `/settings/quick` + `/bonuses` |
| ⏳ | Seed mijozlar, sahifa visual parity, ANR stress — batafsil: `mobile/REDESIGN_STATUS.md` |

## Hali ochiq

| # | Nima | Sabab / qadam |
|---|---|---|
| A | Andijon `device_token` URL | Bu PC LAN da emas (`192.168.100.127` ochilmaydi) — ofis PC |
| B | GitHub Private | `gh auth login` → `gh repo edit Unknown0223/NEW_PRO --visibility private` |
| C | `git filter-repo` | Private dan keyin, force-push |
| D | Yangi OTA jks | Mavjud kalitni buzmang (telefonlar) |
| E | TOTP / Fastify 5 | Keyingi katta PR |
| F | Mobil redesign qoldiq | `mobile/REDESIGN_STATUS.md` — seed clients, parity |

## Andijon (ofis)

```powershell
powershell -File scripts/tabel/link-face-terminal.ps1 `
  -Password "<terminal>" -PairingCode 605622 -Branch Andijon `
  -DeviceToken "<meta.device_token>" `
  -IngestUrl "https://api.salesarena.sale/api/aksit/mobile/attendance/device-ingest"
```
