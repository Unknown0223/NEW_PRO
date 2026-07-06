# Infrastructure (lokal ishlab chiqish)

## Servislar

- **PostgreSQL 16** — host port **`15432`**, DB: `savdo_db`, foydalanuvchi: `postgres`, parol: **`.env.local` dagi `POSTGRES_PASSWORD`** (namuna: `.env.local.example`).
- **Redis 7** — host port **`16479`** (`REDIS_URL=redis://127.0.0.1:16479`).

## Ishga tushirish

Docker Desktop **yoqilgan** bo‘lishi kerak (Windows: trey ikonka, “Engine running”).

```powershell
cd d:\SALESDOC\infrastructure
copy .env.local.example .env.local
# .env.local da POSTGRES_PASSWORD ni o'rnating
docker compose up -d
```

Holatni tekshirish:

```powershell
docker compose ps
```

To‘xtatish:

```powershell
docker compose down
```

Hajmni tozalash (barcha ma’lumot o‘chadi):

```powershell
docker compose down -v
```

---

## Muammo: «daemon ishlamayapti» / `dockerDesktopLinuxEngine`

**Sabab:** Docker Desktop o‘chiq yoki WSL2 backend ishlamayapti.

**Qadamlar:**

1. **Docker Desktop** ni Windows da oching va kutib turing (birinchi marta uzoqroq).
2. *Settings → General* da **Use the WSL 2 based engine** yoqilgan bo‘lsin (tavsiya).
3. *Settings → Resources → WSL integration* — ishlatayotgan distro uchun yoqilgan bo‘lsin.
4. Keyin yana `docker compose up -d`.

Agar Docker ishlatmasangiz, PostgreSQL ni [postgresql.org](https://www.postgresql.org/download/windows/) dan o‘rnatib, `backend\.env` dagi `DATABASE_URL` ni shu serverga moslang (parolni o‘zingiz belgilaysiz).

---

## `.env` va ulanish manzili

- Ilovadan (host mashinadan) ulanishda **`localhost:15432`** (PostgreSQL) ishlating.
- Konteyner **ichki** IP (`172.x.x.x`) konteyner qayta yaratilganda o‘zgarishi mumkin — `.env` ga yozmang.
- `backend\.env` namunasi: `postgresql://postgres:YOUR_PASSWORD@localhost:15432/savdo_db`

---

## Backend bilan bog‘lash

```powershell
cd d:\SALESDOC\backend
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

---

## Tavsiyalar

| Tavsiya | Sabab |
|--------|--------|
| Docker faqat dev uchun | Production da managed DB (RDS, Hetzner DB) + alohida backup rejasi. |
| `localhost` + port | Barqaror ulanish; ichki Docker IP dan qoching. |
| CI va lokal parollar farq qilishi mumkin | GitHub Actions da `postgres:postgres`; lokal compose `.env.local` orqali — ikkalasi ham `.env` / workflow orqali boshqariladi. |
| Redis hozircha ixtiyoriy | Keyingi bosqichlarda navbat/kesh uchun ishlatiladi. |

---

## Production: sekin SQL so‘rovlarni loglash

PostgreSQL da vaqtincha `log_min_duration_statement` (masalan, 500 ms) yoqib, sekin querylarni toping. Batafsil: [docs/SLO_AND_OBSERVABILITY.md](../docs/SLO_AND_OBSERVABILITY.md).

Seed paroli (test): tenant `test1`, login `admin`, parol `secret123`.

---

## Production shablonlar

- Nginx: `infrastructure/nginx/salec-prod.conf`
- PM2: `infrastructure/pm2/ecosystem.config.cjs`
- Deploy tartibi: `docs/PROD-CHECKLIST.md`
- Backup/restore: `scripts/db-backup.ps1`, `scripts/db-restore.ps1`
