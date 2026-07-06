# SALEC — production deploy va yangilash

**Oxirgi yangilanish:** 2026-07-01 (mobil serverdan yangilash, balans formati, deploy skriptlari)

## Loyiha papkasi (shu nusxa)

```
E:\SALEC — копия\
├── deploy-prod.cmd              ← Veb + API serverga chiqarish (Railway)
├── deploy-mobile-prod.cmd       ← Mobil APK yig‘ish (telefonlarga qo‘lda)
├── start-dev.cmd                ← Lokal ishlab chiqish
├── run-mobile.cmd               ← Mobil emulyator (lokal API)
├── backend\                     ← API (Dockerfile → Railway servis)
├── frontend\                    ← Veb panel (Dockerfile → Railway servis)
├── mobile\                      ← Flutter ilova manbasi
└── scripts\railway\deploy.ps1   ← Asosiy deploy skripti
```

## Production URL (hozirgi Railway)

| Nima | URL |
|------|-----|
| **Veb panel** | https://sales-arena.up.railway.app |
| **Backend API** | https://backend-production-3cf2.up.railway.app |
| **Health** | `GET /health` → `{"status":"ok"}` |
| **Tizim migratsiyasi** | https://sales-arena.up.railway.app/settings/system-migration |

---

## 1. Serverni yangilash (veb + API)

### Bir buyruq (tavsiya)

```powershell
cd "E:\SALEC — копия"
.\deploy-prod.cmd
```

Yoki:

```powershell
cd "E:\SALEC — копия"
.\scripts\railway\deploy.ps1 -SkipBootstrap
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

`-SkipBootstrap` — mavjud DB va adminni **o‘chirmaydi** (oddiy yangilash uchun).

### Ma’lumotni boshqa serverga ko‘chirish

Kod deploydan **alohida**:

1. Eski server: **Sozlamalar → Tizim → Tizim migratsiyasi** → to‘liq zaxira (v5)  
2. Yangi/bo‘sh tenant: ZIP import  

---

## 2. Mobil ilovani yangilash (APK + server)

```powershell
cd "E:\SALEC — копия"
.\deploy-mobile-prod.cmd
```

Bu buyruq:
1. Production APK yig‘adi (`3.1.0+301`)
2. Railway API ga **avtomatik yuklaydi**
3. Versiya siyosatini o‘rnatadi (`force_update`)

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
| Nusxa (repo) | `mobile\releases\SalesDoc-3.1.0-release.apk` |
| Lokal sinov | `mobile\releases\SalesDoc-local-3.0.0-release.apk` (`build-apk-local.cmd`) |

Qo‘lda o‘rnatish: `adb install -r` yoki APK faylini telefonga yuborish.

---

## 3. «Server papkasiga qo‘ysam, ilova o‘zi yangilanadimi?»

| Qism | O‘zi yangilanadimi? | Izoh |
|------|---------------------|------|
| **Veb panel** (brauzer) | **Ha** — deploy tugagach | `deploy-prod.cmd` yoki Railway dashboard **Deploy**. Foydalanuvchi sahifani yangilasa (F5) yangi versiya keladi. Faylni qo‘lda server papkasiga nusxalash **yetarli emas** — build + restart kerak. |
| **Backend API** | **Ha** — xuddi shu deploy bilan | Mobil va veb yangi API dan foydalanadi. |
| **Mobil APK** (telefon) | **Qisman** | `deploy-mobile-prod.cmd` APK ni serverga yuklaydi; agentlar ilova ichida yangilaydi. Birinchi o‘rnatish yoki qo‘lda — APK kerak. |
| **Baza ma’lumotlari** | **Yo‘q** | Kod yangilanganda DB o‘zgarmaydi. Migratsiya uchun ZIP eksport/import. |

**Qisqa:** Railway ga `deploy-prod.cmd` bilan chiqarsangiz — **veb va API yangilanadi**. **Telefon ilovasi** alohida yangi APK talab qiladi.

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
