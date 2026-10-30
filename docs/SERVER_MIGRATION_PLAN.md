# SALEC — Server migratsiya rejasi (sezsiz cutover)

**Maqsad:** Railway → yangi server (masalan Hetzner + Coolify) ga **to‘liq** ko‘chirish.
Foydalanuvchi (veb + mobil) deyarli hech narsa sezmasin: login, zakaz, balans, APK OTA — hammasi ishlasin.

**Taxminiy RPO:** dump olish vaqtiga qarab (ideal ≤ 15 daqiqa).  
**Taxminiy RTO:** 1–2 soat (DNS/API almashtirish bilan).

---

## 1. Nima ko‘chadi / nima emas

| Komponent | Ko‘chadi? | Izoh |
|-----------|-----------|------|
| PostgreSQL (barcha jadvallar, tenant, RBAC, to‘lov, zakaz, …) | **Ha — majburiy** | `pg_dump` / restore |
| Fotootchyot / binary (DB yoki ZIP) | **Ha** | System migration ZIP yoki volume |
| Mobil APK + OTA sozlamalari | **Ha** | DB + `/settings/mobile-app` |
| Redis (kesh, BullMQ navbat) | **Ixtiyoriy** | Bo‘sh Redis bilan ishlaydi; faol import bo‘lsa kutish |
| Kod (backend/frontend/worker) | Git → yangi deploy | Image qayta build |
| JWT secret, CORS, env | Qo‘lda / secret vault | **Bir xil** `JWT_*` saqlansa sessiyalar uzilmaydi |

---

## 2. Tavsiya etilgan target (100+ user)

| Resurs | Minimal | Tavsiya |
|--------|---------|---------|
| RAM | 8 GB | **16 GB** |
| CPU | 4 vCPU | 4–8 vCPU |
| Disk | 40 GB SSD | **80 GB+** SSD |
| Stack | Docker Compose yoki Coolify/Dokploy | |

Servislar: `postgres` + `redis` + `backend` (+ worker) + `frontend`.

---

## 3. Oldindan tayyorgarlik (D−7 … D−1)

1. Yangi VPS ochish, Docker + Coolify/Dokploy.
2. Domen (tavsiya): `api.sizning-domen.uz`, `app.sizning-domen.uz` — DNS ni oldindan yangi IP ga yo‘naltirish mumkin (TTL past).
3. Stagingda bo‘sh Postgres + Redis bilan `docker compose` smoke.
4. Eski Railway dan **test dump** olish va restore qilib tekshirish.
5. Mobil: production API URL domen orqali bo‘lsa — APK o‘zgarmaydi; to‘g‘ridan-to‘g‘ri `*.railway.app` bo‘lsa — yangi API URL + OTA APK kerak.
6. Checklist: login, zakaz create, bonus, nachalniy balans, client-expenses, mobil sync.

Loyiha skriptlari:

```powershell
cd backend
$env:DATABASE_URL = "<eski-railway-public-url>"
.\scripts\backup\pg-backup.ps1
```

Yoki veb: **Настройки → Tizim migratsiyasi** → backup ZIP (tenant).

---

## 4. Cutover kuni (D-day)

### A. Maintenance oynasi (5–30 daqiqa)

1. Eski frontend/backend da qisqa «texnik ishlar» banner (ixtiyoriy).
2. Yangi yozuvlarni to‘xtatish: backend scale 0 yoki read-only (imkon bo‘lsa).
3. **Final `pg_dump`** (custom yoki plain SQL gzip).
4. Dump ni yangi Postgres ga restore.
5. `cd backend && npm run db:migrate deploy` (yoki container start migrate).
6. Env: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ALLOWED_ORIGINS`, `API_INTERNAL_ORIGIN`.
7. Backend + frontend + worker start; `GET /health` → ok.
8. DNS / reverse proxy ni yangi serverga yo‘naltirish.
9. Smoke: admin login, 1 zakaz, 1 to‘lov/расход, balanslar, mobil login.

### B. Rollback (agar xato)

1. DNS ni yana Railway ga qaytarish.
2. Yangi serverni o‘chirmasdan saqlash (debug).
3. Eski DB o‘zgarmagan bo‘lsa — ma’lumot yo‘qolmaydi.

---

## 5. Cutover dan keyin (D+1 … D+7)

1. Eski Railway ni **kamida 7 kun** zaxira sifatida saqlash.
2. Avtomatik backup: kunlik `pg_dump` + offsite (S3/Backblaze).
3. Monitoring: disk, RAM, `/health`, Postgres connections.
4. Mobil agentlarga OTA (agar API host o‘zgargan bo‘lsa).

---

## 6. «Hech narsa sezilmasin» qoidalari

1. **Domen o‘zgarmasin** — eng muhim shart.
2. **JWT secret bir xil** bo‘lsin — sessiyalar yashaydi.
3. Dump **to‘liq** bo‘lsin (`--clean` ehtiyotkorlik bilan; restore bo‘sh DB ga).
4. Cutover vaqtida yangi zakaz/to‘lov yozilmasin (ikki DB diverge).
5. Redis bo‘sh — OK; uzoq import/job bo‘lsa cutover oldin tugating.

---

## 7. Qisqa buyruqlar (namuna)

```bash
# Eski (Railway public URL)
pg_dump "$OLD_DATABASE_URL" -Fc -f salec_final.dump

# Yangi
pg_restore -d "$NEW_DATABASE_URL" --no-owner --role=postgres salec_final.dump
```

Compose: `infrastructure/docker-compose.prod.yml` + `infrastructure/env.production.example`.  
Navbatma-navbat holat: [HETZNER_SERVER_REJA.md](./HETZNER_SERVER_REJA.md).

---

## 8. Holat

| Band | Status |
|------|--------|
| Reja hujjati | ✅ shu fayl |
| Production compose / Coolify shablon | ✅ `infrastructure/docker-compose.prod.yml` |
| DNS / domen | ⏳ sizdan |
| Final dump + cutover | ⏳ server tayyor bo‘lgach |

**Keyingi qadam:** [HETZNER_SERVER_REJA.md](./HETZNER_SERVER_REJA.md) — hozir Hetzner Verification ($25), keyin project `salec` + CX43.
