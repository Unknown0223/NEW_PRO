# SALEC — Railway deploy

> **Tezkor yo‘riqnoma (2026-06-30):** [PROD_DEPLOY_YAKUNLANDI.md](./PROD_DEPLOY_YAKUNLANDI.md) — `deploy-prod.cmd`, mobil APK, tizim migratsiyasi.

[Railway](https://railway.com) da **salec** loyihasiga to‘liq deploy qilish.

## Talablar

- [Railway](https://railway.com) hisobi
- GitHub repo yoki lokal `railway up`
- Node.js 22+ (lokal bootstrap uchun)

## 1. Railway CLI login

```powershell
npx @railway/cli login
npx @railway/cli whoami
```

## 2. Railway loyihasida servislar

Dashboard → **salec** → 4 ta komponent:

| Servis | Root Directory | Builder |
|--------|----------------|---------|
| **postgres** | — | PostgreSQL plugin |
| **redis** | — | Redis plugin |
| **backend** | `backend` | Dockerfile |
| **frontend** | `frontend` | Dockerfile |

Har bir servis uchun **Settings → Root Directory** ni to‘g‘ri qo‘ying.

## 3. Backend muhit o‘zgaruvchilari

Backend servis → **Variables**:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_ACCESS_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>.up.railway.app
```

`CORS_ALLOWED_ORIGINS` — frontend public URL (vergul bilan bir nechta bo‘lishi mumkin).

## 4. Frontend muhit o‘zgaruvchilari

Frontend servis → **Variables** + **Build** args:

```env
NODE_ENV=production
API_INTERNAL_ORIGIN=https://<backend-domain>.up.railway.app
```

Docker build args (Railway Variables, build vaqtida):

```env
API_INTERNAL_ORIGIN=https://<backend-domain>.up.railway.app
```

Ixtiyoriy (proxy o‘rniga to‘g‘ridan-to‘g‘ri API):

```env
NEXT_PUBLIC_API_URL=https://<backend-domain>.up.railway.app
```

## 5. Deploy (terminal)

```powershell
cd "E:\SALEC — копия\backend"
npx @railway/cli link
# Project: salec, Service: backend
npx @railway/cli up --detach

cd "..\frontend"
npx @railway/cli link
# Project: salec, Service: frontend
npx @railway/cli up --detach
```

Yoki dashboard dan **Deploy** tugmasi.

## 6. Bazani tozalash + faqat admin

**Yangi bo‘sh Postgres** da migratsiya avtomatik (`prisma migrate deploy` Dockerfile CMD da).

Mavjud ma’lumotni to‘liq o‘chirish + faqat admin:

```powershell
cd backend
npx @railway/cli link   # backend servisi

# 1) Bazani nolga tushirish (seed YO'Q)
$env:CONFIRM_DB_ZERO_RESET="yes"
$env:DB_ZERO_SKIP_SEED="1"
$env:ALLOW_PROD_DB_ZERO="true"
npx @railway/cli run npm run db:zero-reset

# 2) Admin + RBAC + minimal spravochniklar
$env:ALLOW_RAILWAY_PROD_INIT="true"
$env:ADMIN_PASSWORD="secret123"
$env:IMPORT_TENANT_SLUG="test1"
npx @railway/cli run npm run railway:prod-init
```

**Kirish (veb panel):**

- Tenant slug: `test1`
- Login: `admin`
- Parol: `secret123` (yoki `ADMIN_PASSWORD` da bergan qiymat)

## 7. Mobil ilova

`mobile/.env` yoki build vaqtida:

```env
API_BASE_URL=https://<backend-domain>.up.railway.app
```

Android/iOS build:

```powershell
cd mobile
# .env ni yangilang
flutter run
```

Mobil login: tenant **test1**, **admin** / parol.

## 8. Tekshirish

- Backend health: `https://<backend>/health`
- Frontend: `https://<frontend>/auth/login`
- Login → dashboard ochilishi

## 9. Avtomatik deploy skripti

```powershell
.\scripts\railway\deploy.ps1
```

(`railway login` dan keyin)

## Muammolar

| Muammo | Yechim |
|--------|--------|
| `Unauthorized` | `npx @railway/cli login` |
| Backend crash: CORS | `CORS_ALLOWED_ORIGINS` ga frontend URL |
| Frontend 404 on `/auth/login` | `API_INTERNAL_ORIGIN` build va runtime da backend URL |
| Redis xato | Redis plugin ulangan va `REDIS_URL` reference |
| Login ishlamaydi | `railway run npm run railway:prod-init` qayta |
