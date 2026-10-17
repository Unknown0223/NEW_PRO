# SALEC — production deploy va yangilash

**Oxirgi yangilanish:** 2026-08-25 (face A+B, work-slots ikonlar, **ixtiyoriy** mobil OTA)

## Loyiha papkasi (shu nusxa)

```
D:\SALEC — копия\
├── deploy-prod.cmd              ← Veb + API + mobil APK (server OTA)
├── deploy-all.cmd               ← Xuddi shu (to‘liq deploy)
├── deploy-mobile-prod.cmd       ← Faqat mobil APK (veb o‘zgarmasa)
├── start-dev.cmd                ← Lokal ishlab chiqish
├── run-mobile.cmd               ← Mobil emulyator (lokal API)
├── backend\                     ← API (Dockerfile → Railway servis)
├── frontend\                    ← Veb panel (Dockerfile → Railway servis)
├── mobile\                      ← Flutter ilova manbasi
└── scripts\railway\deploy-all.ps1
```

## Production URL (hozirgi Railway)

| Nima | URL |
|------|-----|
| **Veb panel** | https://sales-arena.up.railway.app |
| **Backend API** | https://backend-production-3cf2.up.railway.app |
| **Health** | `GET /health` → `{"status":"ok"}` |
| **Tizim migratsiyasi** | https://sales-arena.up.railway.app/settings/system-migration |
| **Mobil OTA** | https://sales-arena.up.railway.app/settings/mobile-app |

---

## 1. Serverni yangilash (veb + API + mobil)

### Bir buyruq (tavsiya)

```powershell
cd "D:\SALEC — копия"
.\deploy-prod.cmd
```

Bu buyruq:
1. Backend + Frontend → Railway
2. Mobil release APK yig‘adi
3. APK ni serverga yuklaydi — **sukutda ixtiyoriy** (`force_update=false`): agentlar «Обновить» / «Позже»
   Majburiy uchun: `upload-mobile-apk-prod.ps1 -ForceUpdate` yoki vebda checkbox.

Faqat veb (mobilni o‘tkazib yuborish):

```powershell
.\deploy-prod.cmd -SkipMobile
```

Yoki:

```powershell
npm run deploy:prod
```

**Birinchi marta** Railway CLI:

```powershell
npx @railway/cli login
npx @railway/cli whoami
```

### Nima bo‘ladi?

1. `backend\` → Railway **backend** servisiga build + deploy  
2. `frontend\` → Railway **frontend** servisiga build + deploy  
3. Migratsiyalar Dockerfile ichida (`prisma migrate deploy`) avtomatik ishlaydi  
4. Mobil release APK yig‘iladi va serverga yuklanadi (**ixtiyoriy OTA**, `force_update=false`)  

`-SkipBootstrap` — mavjud DB va adminni **o‘chirmaydi** (oddiy yangilash uchun).  
`-SkipMobile` — faqat veb/API (APK yig‘ishni o‘tkazib yuborish).  
Majburiy mobil: `.\scripts\railway\upload-mobile-apk-prod.ps1 -ForceUpdate`

### Ma’lumotni boshqa serverga ko‘chirish

Kod deploydan **alohida**:

1. Eski server: **Sozlamalar → Tizim → Tizim migratsiyasi** → to‘liq zaxira (v5)  
2. Yangi/bo‘sh tenant: ZIP import  

---

## 2. Faqat mobil ilovani yangilash (veb o‘zgarmasa)

```powershell
cd "D:\SALEC — копия"
.\deploy-mobile-prod.cmd
```

Bu buyruq:
1. Production APK yig‘adi (`pubspec.yaml` versiyasi, masalan `3.1.21+330`)
2. Railway API ga **avtomatik yuklaydi** (`/api/mobile/apk-download`)
3. Siyosat: **ixtiyoriy** yangilash (`force_update=false`) — dialog «Обновить» / «Позже»  
   Majburiy kerak bo‘lsa: `upload-mobile-apk-prod.ps1 -ForceUpdate`
3. Versiya siyosatini o‘rnatadi (`force_update`) — agentlar **ilova ichida** yangilaydi

Yoki alohida:

```powershell
npm run deploy:mobile:apk      # faqat yig‘ish
npm run deploy:mobile:upload   # faqat serverga yuklash
```

**Admin panel:** https://sales-arena.up.railway.app/settings/mobile-app

Agentlar eski versiyada login qilganda **ilova ichida** yangilash dialogi chiqadi (kesh saqlanadi).

### Chiqish joylari

| Fayl | Yo‘l |
|------|------|
| APK (asosiy) | `C:\salesdoc_mobile\build\app\outputs\flutter-apk\app-release.apk` |
| Nusxa (repo) | `mobile\releases\SalesDoc-<ver>-release.apk` |
| Lokal sinov | `mobile\releases\SalesDoc-local-*-release.apk` (`build-apk-local.cmd`) |

Qo‘lda o‘rnatish: `adb install -r` yoki APK faylini telefonga yuborish.

---

## 3. «Server papkasiga qo‘ysam, ilova o‘zi yangilanadimi?»

| Qism | O‘zi yangilanadimi? | Izoh |
|------|---------------------|------|
| **Veb panel** (brauzer) | **Ha** — deploy tugagach | `deploy-prod.cmd`. Foydalanuvchi sahifani yangilasa (F5) yangi versiya keladi. |
| **Backend API** | **Ha** — xuddi shu deploy bilan | Mobil va veb yangi API dan foydalanadi. |
| **Mobil APK** (telefon) | **Ha (OTA)** | `deploy-prod.cmd` APK ni serverga yuklaydi; agentlar ilova ichida «Обновить» bosadi. Birinchi o‘rnatish — APK kerak. |
| **Baza ma’lumotlari** | **Yo‘q** | Kod yangilanganda DB o‘zgarmaydi. Migratsiya uchun ZIP eksport/import. |

**Qisqa:** `deploy-prod.cmd` — **veb + API + mobil OTA** birga. Faqat veb kerak bo‘lsa: `-SkipMobile`.

---

## 4. VPS / PM2 (ixtiyoriy, Railway emas)

Agar o‘z serveringiz bo‘lsa:

| Komponent | Serverdagi yo‘l |
|-----------|-----------------|
| Kod | `/opt/salec/` |
| PM2 | `infrastructure/pm2/ecosystem.config.cjs` |
| Nginx | `infrastructure/nginx/salec-prod.conf` |

Yangilash tartibi:

```bash
cd /opt/salec
git pull   # yoki yangi fayllarni nusxalash
cd backend && npm ci && npm run build && npx prisma migrate deploy
cd ../frontend && npm ci && npm run build
pm2 restart all
```

---

## 5. Tekshiruv

```powershell
cd "E:\SALEC — копия"
npm run prod:verify
```

```powershell
cd "E:\SALEC — копия\backend"
npm run prod:ops-check
```

---

## 6. Asosiy fayllar

| Fayl | Vazifa |
|------|--------|
| `deploy-prod.cmd` | Railway backend + frontend |
| `deploy-mobile-prod.cmd` | Release APK |
| `scripts/railway/deploy.ps1` | Deploy mantiq |
| `docs/RAILWAY-DEPLOY.md` | Railway o‘zgaruvchilari |
| `mobile/.env.production` | Prod API URL |
| `frontend/app/(dashboard)/settings/system-migration/` | To‘liq zaxira UI |
