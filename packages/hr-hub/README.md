# @salec/hr-hub

Mustaqil **HR Hub** — kadrlar, bo‘limlar, davomat. SALEC Arena (`backend` / `frontend` / Prisma) dan **alohida** paket; pivot kabi `packages/` ichida yashaydi.

## Tez start

```bash
cd packages/hr-hub
cp .env.example .env
npm install
npm run db:up
npm run db:push
npm run db:seed
npm run dev
```

Brauzer: [http://127.0.0.1:3100](http://127.0.0.1:3100)

Demo login:

- `admin@demo.local` / `admin123` (`org_admin`)
- `manager@demo.local` / `manager123`
- `ali@demo.local` / `employee123`

Postgres: `127.0.0.1:5433` (SALEC default 5432 dan alohida).

## Stack

- Next.js App Router + TypeScript + Tailwind
- Drizzle ORM + PostgreSQL
- JWT cookie session (`jose` + `bcryptjs`)

## Papka

```
packages/hr-hub/
  src/app/          UI + API routes
  src/db/           schema, seed
  src/lib/          auth, helpers
  docs/ROADMAP.md   kelajak fazalar
  docs/INTEGRATION.md  SALEC sync (keyin)
```

## Root dan

```bash
npm run dev --workspace=@salec/hr-hub
```

## Integratsiya

Hozircha **yo‘q**. Keyin faqat xodimlar + tabel — qarang [`docs/INTEGRATION.md`](docs/INTEGRATION.md).
