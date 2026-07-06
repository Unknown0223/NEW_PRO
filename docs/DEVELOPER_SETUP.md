# SALEC — Developer Setup

## Talablar

- Node.js 20+
- PostgreSQL 15+ (Docker yoki lokal)
- Redis 7+ (Docker yoki lokal)
- Flutter 3.x (mobile ishlari uchun)

## Birinchi marta sozlash

```bash
# 1. Infrastructure (Docker)
cd infrastructure
copy .env.local.example .env.local   # Windows
docker compose up -d

# 2. Backend
cd ../backend
copy .env.example .env
# DATABASE_URL, JWT secretlarni to'ldiring
npm install
npm run db:deploy
npm run db:seed
npm run dev

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

## Git hooks (Husky)

Backend papkasida `prepare` skripti Husky ni ulaydi. Git `core.hooksPath` = `backend/.husky/_` (repo ildizidan `npm install` dan keyin avtomatik).

```bash
cd backend
npm install          # "prepare": "husky" avtomatik ishlaydi
```

Agar hooklar ishlamasa (monorepo ildizida `.git` bor, lekin `backend/` ichida yo‘q):

```bash
# repo ildizidan
node backend/node_modules/husky/bin.js backend/.husky
git config core.hooksPath backend/.husky/_
```

Pre-commit tekshiruvi: `backend/.husky/pre-commit` → `scripts/pre-commit-check.sh` (tsc + audit:max-loc).

**Windows:** Git Bash yoki WSL kerak (`.husky/pre-commit` shell skript). PowerShell-only muhitda:

```powershell
cd backend
npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
```

## Backup (Windows)

Bash skript o‘rniga PowerShell:

```powershell
cd backend
.\scripts\backup\pg-backup.ps1
.\scripts\dr-drill.ps1
```

Yoki WSL: `npm run backup:pre-release` (bash).

## Asosiy tekshiruvlar

```bash
cd backend
npm run build
npm run prod:verify          # to'liq gate
npm run test:coverage:orders # orders domain coverage
vitest run tests/ready.test.ts tests/auth.integration.test.ts tests/metrics.smoke.test.ts
```

## Hujjatlar

- Production deploy: `docs/PRODUCTION_DEPLOY_CHECKLIST.md`
- Auth token strategiyasi: `docs/AUTH_TOKEN_STRATEGY.md`
- Backup/DR: `docs/BACKUP_AND_DR.md`
