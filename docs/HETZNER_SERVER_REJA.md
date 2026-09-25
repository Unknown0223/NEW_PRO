# SALEC — Hetzner ga ko‘chirish: qilingan ishlar va reja

**Yangilangan:** 2026-09-24  
**Maqsad:** Railway → **Hetzner CX43 (Helsinki) + Coolify + Cloudflare R2**  
**Yuk:** 100–150 xodim; agent boshiga ~40 fotootchyot/kun  
**Ish usuli:** navbatma-navbat — agent qiladigan / foydalanuvchi qiladigan. Foydalanuvchi qadami bo‘lsa, natija kutiladi.

**Prod VPS:** `salec-prod` — **157.180.116.50** (HEL1, CX43). Coolify: http://157.180.116.50:8000

Texnik cutover (dump, DNS, rollback): [SERVER_MIGRATION_PLAN.md](./SERVER_MIGRATION_PLAN.md).  
Hozirgi Railway URL: [PROD_DEPLOY_YAKUNLANDI.md](./PROD_DEPLOY_YAKUNLANDI.md).

---

## 1. Bitta qaror (o‘zgarmaydi)

| Band | Qiymat |
|------|--------|
| Server | **Hetzner CX43** — Helsinki (`HEL1`), Ubuntu 24.04 |
| Resurs | 8 vCPU / **16 GB RAM** / 160 GB NVMe / 20 TB trafik |
| Narx | ~**$22–28/oy** (IPv4 + R2 bilan). Railway shu yukda ~$120–210 |
| Deploy | **Coolify** (yoki `docker compose` — `infrastructure/docker-compose.prod.yml`) |
| Foto | **Cloudflare R2** (Postgresda base64 saqlanmasin) |
| Sifat | **1600 px / JPEG 75** (~140 KB/rasm). Polka/vitrina o‘qiladi |
| Saqlash | 100 agent × 40 rasm × 60 kun ≈ **34 GB** (~$0.36/oy R2) |

**Nima uchun 8 GB emas:** 150 user + Postgres + Redis + backend/worker + frontend + Coolify pikda 8 GB da siqiladi.

**Ma’lumot:** to‘g‘ri dump/restore da **yo‘qolmaydi**. Railway **7 kun** zaxirada qoladi. Cutoverning 15–30 daqiqasida yozish to‘xtatiladi (dumpdan keyingi zakaz yangi serverga tushmasligi mumkin).

Kod xatosi / noto‘g‘ri qarz **server almashishi bilan tuzalmaydi**. Tezlik (RAM/CPU/disk) yaxshilanadi.

---

## 2. Holat (2026-09-20)

| # | Qadam | Kim | Holat |
|---|--------|-----|--------|
| 0 | Tahlil + bitta taklif (Hetzner CX43 + R2 + 1600/75) | Agent | ✅ |
| 1 | Production compose, env shablon, bootstrap/restore skript | Agent | ✅ |
| 2 | Foto: serverda siqish, mobil default 1600/75 | Agent | ✅ |
| 3 | Hetzner hisob ochish | Foydalanuvchi | ✅ Console ochildi |
| 4 | Hetzner **Verification** ($25 karta / Document) | Foydalanuvchi | ✅ |
| 5 | Project `Sales_Arena` | Foydalanuvchi | ✅ |
| 6 | CX43 server (HEL1, Ubuntu 24.04, IPv4) | Agent (API) | ✅ `salec-prod` **157.180.116.50** |
| 7 | Coolify/Docker o‘rnatish (`bootstrap-ubuntu.sh`) | Agent (SSH) | ✅ Docker + Coolify |
| 8 | Cloudflare R2 bucket + kalitlar | Foydalanuvchi | ⏳ |
| 9 | Domen (`app.` / `api.`) DNS | Foydalanuvchi | ⏳ |
| 10 | Env: JWT (Railway bilan bir xil), CORS, R2 | Agent + foydalanuvchi | ⏳ |
| 11 | Test dump Railway → yangi Postgres | Ikkala | ⏳ |
| 8 | Cloudflare R2 bucket + kalitlar | Foydalanuvchi | ⏳ |
| 9 | Domen (`app.` / `api.`) DNS | Foydalanuvchi | ⏳ |
| 10 | Env: JWT (Railway bilan bir xil), CORS, R2 | Agent + foydalanuvchi | ✅ JWT sync (R2 hali ixtiyoriy) |
| 11 | Test dump Railway → yangi Postgres | Ikkala | ✅ to‘liq restore: 124 table, 15168 client, 502 order |
| 12 | Smoke (login, zakaz, to‘lov, mobil) | Ikkala | 🔄 IP orqali ochiq: app `:3000`, api `:4000` |
| 13 | Cutover (final dump, DNS, 15–30 daqiqa yozish yo‘q) | Ikkala | ⏳ domen/DNS |
| 14 | Railway 7 kun zaxira, keyin o‘chirish | Foydalanuvchi | ⏳ |
| 15 | Mobil OTA (agar API `*.railway.app` da qolgan bo‘lsa) | Agent + foydalanuvchi | ✅ 3.1.33 force OTA → Hetzner API |

**Hozirgi to‘siq:** Hetzner loyiha ochishdan oldin hisobni tasdiqlash shart. Verification sahifasida **Credit card → $25** tanlandi (kredit server to‘loviga ketadi). **Document** (passport) alternativi — sekinroq. Chap menyudagi `Invoices → Credit` verificationdan **oldin** ishlamaydi.

---

## 3. Qilingan ishlar (kod / fayllar)

### 3.1 Infratuzilma

| Fayl | Nima |
|------|------|
| `infrastructure/docker-compose.prod.yml` | postgres 16 + redis 7 + backend (API+worker) + frontend. PG tuning, Redis `noeviction`, portlar faqat `127.0.0.1` |
| `infrastructure/env.production.example` | Parol/JWT/CORS/R2 shablon. Nusxa: `.env.production` (gitga kirmaydi) |
| `infrastructure/nginx/salec-prod.conf` | `client_max_body_size 130m` (APK) |
| `scripts/hetzner/bootstrap-ubuntu.sh` | Ubuntu: Docker + UFW (22/80/443/8000) + Coolify |
| `scripts/hetzner/restore-pg.sh` | Dump (`.sql.gz` / `.dump`) ni yangi Postgres ga tiklash |
| `.gitignore` | `.env.production.example` istisnosi |

### 3.2 Fotootchyot (diskni saqlash)

Eski APK ham xom 3–8 MB yuborsa, **backend qayta siqadi**.

| Joy | Sozlama |
|-----|---------|
| `backend/src/lib/client-photo-storage.ts` | `1600` px, JPEG `75`, R2 yoki siqilgan data-URL |
| `backend/src/modules/staff/agent-mobile-config.defaults.ts` | Default agent/supervisor photo |
| `mobile/lib/core/camera/photo_service.dart` | Xom fayl yuborilmaydi; max 1600 / q≤75 |
| `frontend/components/staff/agent-configurations-dialog.tsx` | UI hint: 1600 / 75 |

Hajm (100 agent × 40 rasm, 60 kun): xom ~840 GB → siqilgan **~34 GB**.

### 3.3 Hozirgi production (hali Railway)

| Nima | URL |
|------|-----|
| Veb | https://sales-arena.up.railway.app |
| API | https://backend-production-3cf2.up.railway.app |

Mobil release fallback hali `*.railway.app`. Domen qo‘yilmasa — cutover dan keyin **yangi APK + OTA** kerak.

---

## 4. Keyingi qadamlar (navbat)

Har qadamda: **kim qiladi**, **nima kutiladi**, **keyin nima**.

### Qadam 4 — Hetzner Verification (foydalanuvchi, hozir)

1. Uzum OTP ni kiriting, **Yuborish** (kodni chatga yozmang).
2. Status: verified / approved.
3. Chatga: `approved` yoki xato matni.

Keyin: project ochiladi.

### Qadam 5 — Project (foydalanuvchi)

1. [console.hetzner.cloud](https://console.hetzner.cloud) → **New project**
2. Nom: `salec`

### Qadam 6 — Server CX43 (foydalanuvchi)

- Location: **Helsinki (HEL1)**
- Image: **Ubuntu 24.04**
- Type: **CX43**
- IPv4: yoqilgan
- SSH kalit yoki root parolni saqlash
- Name: `salec-prod`

Chatga: **IP**, SSH kalit ishladimi / root parol bormi.

### Qadam 7 — Coolify (agent, IP bo‘lsa SSH)

```bash
sudo bash scripts/hetzner/bootstrap-ubuntu.sh
```

Coolify: `http://IP:8000` — birinchi admin.

### Qadam 8 — Cloudflare R2 (foydalanuvchi)

1. Cloudflare → R2 → bucket `salec-uploads`
2. API token (Access Key + Secret)
3. Public URL (ixtiyoriy custom domen)

Chatga: endpoint, bucket nomi (kalitlarni xavfsiz ulashing yoki Coolify secret ga qo‘yish).

### Qadam 9 — Domen (foydalanuvchi)

Tavsiya: `app.sizning-domen.uz` (veb), `api.sizning-domen.uz` (mobil/API).  
TTL past. Cutover kuni A-record yangi IP ga.

### Qadam 10–12 — Env, test dump, smoke (ikkala)

- `JWT_*` Railway dagi bilan **bir xil**
- Compose: `docker compose -f infrastructure/docker-compose.prod.yml --env-file .env.production up -d --build`
- Test `pg_dump` → `scripts/hetzner/restore-pg.sh`
- Login, 1 zakaz, 1 to‘lov, foto, mobil

### Qadam 13 — Cutover

1. Yozishni to‘xtatish (15–30 daqiqa)
2. Final dump
3. Restore + health
4. DNS / proxy yangi serverga
5. Smoke
6. Xato: DNS ni Railway ga qaytarish

### Qadam 14–15 — Keyin

- Railway 7 kun
- Kunlik `pg_dump` + R2
- Kerak bo‘lsa mobil OTA

---

## 5. Kim nima qiladi (qisqa)

**Foydalanuvchi:** Hetzner to‘lov/verification, project, VPS, (ixtiyoriy) SSH, R2, domen DNS, Railway ni 7 kundan keyin o‘chirish.

**Agent:** compose/env/skript, foto siqish, VPS da Coolify/Docker (SSH bo‘lsa), env ulash, dump/restore, cutover buyruqlari, smoke, OTA.

**Ikkalasi to‘xtatadi:** cutover oynasida zakaz/to‘lov/foto yozish.

---

## 6. Xavfsizlik eslatmalari

- Root parol, JWT, R2 secret, karta, OTP — chatga to‘liq yozilmasin.
- `.env.production` gitga kirmaydi.
- Eski Railway ni cutover **muvaffaqiyatli smoke dan oldin** o‘chirmang.

---

## 7. Keyingi yozuv (shu faylni yangilash)

Verification **approved** bo‘lgach:

- §2 jadvalida qator 4 → ✅, qator 5 → 🔄
- sana yangilansin
- server IP paydo bo‘lgach shu yerga yozilsin (public IP — OK; parol emas)
