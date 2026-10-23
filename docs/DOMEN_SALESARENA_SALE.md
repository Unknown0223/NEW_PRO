# Domen: salesarena.sale — DNS qadamlar

**Server IP:** `157.180.116.50`

## Siz qilasiz (domen kabinetida)

Domen sotib olgan saytda **DNS / Manage DNS / Zone** oching va quyidagi yozuvlarni qo‘ying:

| Type | Name / Host | Value | TTL |
|------|-------------|-------|-----|
| **A** | `@` (yoki `salesarena.sale`) | `157.180.116.50` | 300 / Auto |
| **A** | `www` | `157.180.116.50` | 300 / Auto |
| **A** | `api` | `157.180.116.50` | 300 / Auto |
| **A** | `app` (ixtiyoriy) | `157.180.116.50` | 300 / Auto |

**CNAME** emas — **A** yozuv.

Saqlang. 5–30 daqiqa (ba’zan 1–2 soat) kutish mumkin.

### Tekshirish (kompyuterda)

```powershell
nslookup salesarena.sale
nslookup api.salesarena.sale
```

Javobda `157.180.116.50` chiqishi kerak.

## Keyin menga yozing

`DNS tayyor` — men HTTPS (`https://salesarena.sale`) ni yakunlab, silkalarni beraman.

## Tayyor bo‘lgach ochiladigan manzillar

| Nima | Silka |
|------|--------|
| Veb | https://salesarena.sale/login |
| API | https://api.salesarena.sale/health |

Hozircha (DNS oldidan) test: http://157.180.116.50:3000/login
