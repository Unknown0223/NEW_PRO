---
name: utverzhdayushchih-rejasi
overview: "«Планы → Настройка утверждающих» (tasdiqlovchilarni sozlash) funksiyasini prototipdan haqiqiy full-stack modulга aylantirish. Har yo'nalish (Направление торговли = TradeDirection) va har supervayzer uchun ko'p bosqichli tasdiqlash zanjirini (approval chain) hamda tenant bo'yicha umumiy «главные утверждающие» (asosiy rahbarlar) ro'yxatini sozlash: Prisma modellari + migratsiya, Fastify backend modul (CRUD + pickerlar + RBAC), Next.js «Планы» bo'limini sidebarda jonlantirish va prototip UIni shadcn/dnd-kit/TanStack Query bilan moslashtirish."
todos:
  - id: phase0
    content: "Faza 0: Prisma modellari (PlanApproverConfig, PlanApproverLevel, PlanApproverLeader) + Tenant/User/ProductBrand back-relationlar + migratsiya (db:migrate)"
    status: completed
  - id: phase1
    content: "Faza 1: Backend `plans` modul — Zod schema, service (tenant-scoped, GET config + PUT replace), pickerlar (brendlar/supervayzerlar/xodimlar/rahbarlar), route read/write split, app.ts ga register"
    status: completed
  - id: phase2
    content: "Faza 2: Backend RBAC — `plans.nastroyka_utverzhdayushchih.view/update` kalitlarini route'larga ulash (requirePermission + ROUTE_PERMISSION_RULES), default rol presetlariga qo'shish"
    status: completed
  - id: phase3
    content: "Faza 3: Frontend «Планы» bo'limini jonlantirish — nav-config (dashboardPlansNav + placeholder o'rniga real kind), app-shell expandable section + ikonка + breadcrumb, mobil nav"
    status: completed
  - id: phase4
    content: "Faza 4: Frontend `/plans/approvers` sahifa + workspace — yo'nalish (Направление) tablari, jadval (supervayzer × bosqichlar), dropdownlar, leaderlarni dnd-kit bilan tartiblash, per-row/per-column bosqich qo'shish/o'chirish, butun ustunga qo'llash, Saqlash/Bekor qilish"
    status: completed
  - id: phase5
    content: "Faza 5: Frontend↔backend ulash (TanStack Query useQuery/useMutation, /api/:slug/plans/...), RBAC gating (canWrite, <Can>), loading/empty/error holatlar, validatsiya"
    status: completed
  - id: phase6
    content: "Faza 6: Test + seed + sayqal — backend service unit/integration test, frontend smoke, demo seed skripti, max-loc/typecheck/lint tekshiruvi"
    status: completed
  - id: verify-final
    content: "plans:verify (BE 7 + FE 7 test), yakunlandi hujjat"
    status: completed
isProject: false
---

> **✅ YAKUNLANDI (2026-06-26)** — [docs/PLAN_APPROVERS_YAKUNLANDI.md](../../docs/PLAN_APPROVERS_YAKUNLANDI.md)

# «Настройка утверждающих» (tasdiqlash zanjiri) full-stack rejasi

## Maqsad
Prototip (`0223.rar`, `SalesERP — Настройка утверждающих`) — statik, ma'lumotlari qattiq yozilgan (hardcoded) bitta sahifa. Uni mavjud **SALEC** monorepo arxitekturasiga mos **to'liq full-stack** funksiyaga aylantirish:

- Har **yo'nalish** (Направление торговли = `TradeDirection`) uchun, har **supervayzer** bo'yicha — buyurtmani tasdiqlash zanjiri (ko'p bosqichli: «Степень 1, 2, 3…»). Har bosqichda tasdiqlovchi **xodim** tanlanadi.
- **«Главные утверждающие»** (asosiy rahbarlar) — zanjirning yakuniy bosqichlari sifatida barcha qatorlarga umumiy qo'shiladigan, tartibi sudrab o'zgartiriladigan rahbarlar ro'yxati.
- Ma'lumot bazada saqlanadi, ruxsatlar (RBAC) bilan himoyalanadi, ko'p-tenantli (multi-tenant) bo'ladi.

## Hozirgi holat (audit natijasi)
- **Permission kalitlari allaqachon mavjud**: `plans.nastroyka_utverzhdayushchih.view` va `plans.nastroyka_utverzhdayushchih.update` — `backend/src/modules/access/permission-model.ts` (PERMISSION_SECTIONS, `plans` moduli). Katalogga qo'shimcha kiritish shart emas, faqat route'larga ulash kerak.
- **«Планы» bo'limi — placeholder**: `frontend/components/dashboard/nav-config.ts` da `{ kind: "placeholder", label: "Планы", icon: "plans" }` (sariq «скоро» yorlig'i). Haqiqiy route/sub-menu yo'q.
- **Backend modul yo'q**, **Prisma modellari yo'q**, migratsiya yo'q.
- Stack: Fastify 4 + Prisma 6 + PostgreSQL + Zod (backend), Next.js 14 App Router + React 18 + TanStack Query + Zustand + Tailwind 3 + shadcn + **@dnd-kit** (frontend).

## Ma'lumot manbalari (mavjud modellar) — qarorlar tasdiqlangan
- **Yo'nalish (brend o'rnida)** → `TradeDirection` (`trade_directions`). Ro'yxat: `backend/src/modules/reference/...` / mavjud spravochnik. (LALAKU/DIELUX/GIGA… shu Направление торговли sifatida olinadi.)
- **Xodim↔yo'nalish bog'lanishi ALLAQACHON bor**: `User.trade_direction_id → TradeDirection` (relation `UserTradeDirection`, `TradeDirection.staff_users`). Demak alohida link jadvali shart emas — userlar shu maydon bo'yicha yo'nalishga filtrlanadi.
- **Supervayzer** → `User` (`role = "supervisor"`) `AND trade_direction_id = <tanlangan yo'nalish>`. Jadval qatorlari shu.
- **Xodimlar (dropdown)** → tanlangan yo'nalishdagi aktiv `User`lar (`trade_direction_id` mos). Kerak bo'lsa rol bo'yicha qo'shimcha filtr (SM/KD...).
- **Rahbarlar (leaderlar, tenant-global)** → `User` (masalan director/savdo direktori rollari yoki barcha aktiv userlardan tanlash).

> ✅ **Tasdiqlangan qarorlar:**
> 1. **Birlik = `TradeDirection`** (Направление торговли). Model maydoni `direction_id`.
> 2. **Yo'nalishga xos filtr** — supervayzerlar va xodimlar `User.trade_direction_id` bo'yicha filtrlanadi (mavjud bog'lanish ishlatiladi).
> 3. **«Главные утверждающие» — tenant bo'yicha umumiy** (barcha yo'nalishlarda bitta ro'yxat).

## Maqsadli ma'lumot modeli (Prisma)
Yangi fayl: `backend/prisma/models/group-08.prisma` (yoki mavjud guruhga). Konvensiya: `tenant_id`, `snake_case`, `@@map`, tenant-first indekslar, ikki tomonlama relation.

```
model PlanApproverConfig {            // bitta yo'nalish × bitta supervayzer = bitta zanjir egasi
  id                 Int      @id @default(autoincrement())
  tenant_id          Int
  direction_id       Int
  supervisor_user_id Int
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt
  tenant     Tenant         @relation(fields:[tenant_id], references:[id], onDelete: Cascade)
  direction  TradeDirection @relation(fields:[direction_id], references:[id], onDelete: Cascade)
  supervisor User           @relation("PlanApproverSupervisor", fields:[supervisor_user_id], references:[id], onDelete: Cascade)
  levels     PlanApproverLevel[]
  @@unique([tenant_id, direction_id, supervisor_user_id])
  @@index([tenant_id, direction_id])
  @@map("plan_approver_configs")
}

model PlanApproverLevel {             // zanjirdagi bitta bosqich (Степень N)
  id                Int      @id @default(autoincrement())
  tenant_id         Int
  config_id         Int
  position          Int                       // 0-based tartib
  approver_user_id  Int?                      // bo'sh bo'lishi mumkin (hali tanlanmagan)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  tenant   Tenant             @relation(fields:[tenant_id], references:[id], onDelete: Cascade)
  config   PlanApproverConfig @relation(fields:[config_id], references:[id], onDelete: Cascade)
  approver User?              @relation("PlanApproverEmployee", fields:[approver_user_id], references:[id], onDelete: SetNull)
  @@index([tenant_id, config_id])
  @@map("plan_approver_levels")
}

model PlanApproverLeader {            // tenant bo'yicha umumiy yakuniy rahbarlar (tartibli)
  id              Int      @id @default(autoincrement())
  tenant_id       Int
  position        Int
  leader_user_id  Int
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  tenant Tenant @relation(fields:[tenant_id], references:[id], onDelete: Cascade)
  leader User   @relation("PlanApproverLeader", fields:[leader_user_id], references:[id], onDelete: Cascade)
  @@unique([tenant_id, leader_user_id])
  @@index([tenant_id])
  @@map("plan_approver_leaders")
}
```

`Tenant`, `User`, `TradeDirection` modellariga teskari relation massivlari qo'shiladi (Prisma talabi).

## Backend API (modul: `backend/src/modules/plans/`)
work-slots modulини andoza qilib (`*.route.ts` aggregator + read/write split + `*.service.ts` + `*.schema.ts`):

- `GET  /api/:slug/plans/approvers/options?direction_id=` → `{ directions[], supervisors[], employees[], leaders[] }` (dropdownlar uchun; har biri `{id, name, role}`; supervisors/employees `direction_id` bo'yicha filtr).
- `GET  /api/:slug/plans/approvers?direction_id=` → `{ rows: [{ supervisor_user_id, supervisor_name, levels: (number|null)[] }], leaders: number[] }`.
- `PUT  /api/:slug/plans/approvers?direction_id=` → tanasi `{ rows: [{ supervisor_user_id, levels: (number|null)[] }], leaders: number[] }` — transaction ichida shu yo'nalish uchun config+levels'ni **to'liq almashtirish** (replace), leaders'ni tenant bo'yicha almashtirish.

Konvensiyalar: har handlerда `ensureTenantContext`, Zod `safeParse`, `{ data }` javob, xato kodlari (`NOT_FOUND` va h.k.) → `sendApiError`. `app.register(registerPlansRoutes)` `backend/src/app.ts` ga qo'shiladi.

## RBAC
- O'qish route'lari: `requirePermission("plans.nastroyka_utverzhdayushchih.view")` yoki `ROUTE_PERMISSION_RULES` ga `r(READ, /\/plans\/approvers(\/|$)/, "plans.nastroyka_utverzhdayushchih.view")`.
- Yozish: `r(WRITE, /\/plans\/approvers/, "plans.nastroyka_utverzhdayushchih.update")`.
- Default rol presetlariga (admin allaqachon hammasini ko'radi) kerakli rollarga (masalan director/savdo direktori) `view/update` qo'shish.

## Frontend
### «Планы» bo'limini jonlantirish
- `nav-config.ts`: `dashboardPlansNav = { sectionTitle: "Планы", items: [{ href: "/plans/approvers", label: "Настройка утверждающих", showIfAnyPermission: ["plans.nastroyka_utverzhdayushchih.view"] }] }` + `dashboardPlansNavFlatItems()`; `SidebarLayoutEntry` ga `{ kind: "plans" }`; layoutda placeholder o'rniga shu; `flattenMobileNavItems()` ga `plans` shox; `BREADCRUMB_ENTRIES` ga yozuv.
- `app-shell.tsx`: `openSection` union ga `"plans"`, `plansOpen`, `plansNavChildActive(pathname)`, `toggleSection("plans")` shox, `reports` shoxidan nusxa render branch, ikonка `CalendarRange`.

### Sahifa + workspace
- `frontend/app/(dashboard)/plans/approvers/page.tsx` — `"use client"`, `useAuthStore`/`useAuthStoreHydrated`/`useEffectiveRole`, gating, `canWrite`, workspace'ga uzatish (cash-desks andozasi).
- `frontend/components/plans/approval-workflow-workspace.tsx` — prototip `App.tsx` mantig'ini ko'chirish, lekin:
  - inline-style → Tailwind/shadcn;
  - native drag → **@dnd-kit** (`useSortable`) bilan leaderlarni tartiblash;
  - dropdownlar → shadcn `Select` yoki mavjud pattern;
  - ma'lumot → TanStack Query (`useQuery` options+config, `useMutation` PUT, `invalidateQueries`);
  - prototip xususiyatlari saqlanadi: yo'nalish (Направление) tablari, per-row `+`/`✕` (bosqich qo'shish/o'chirish), header `+`/`✕` (butun ustun), headerdan tanlab **butun ustunga qo'llash**, leader chip qo'shish/o'chirish/sudrash, pastda **Сохранить/Отменить**.
  - `!canWrite` bo'lsa — faqat o'qish (tugma/dropdownlar disabled).

## Texnik bosqichlar (todos bilan mos)
- **Faza 0** — Prisma modellari + back-relationlar + `npm run db:migrate` (migratsiya nomi: `<ts>_plan_approvers_foundation`).
- **Faza 1** — Backend `plans` modul (schema/service/route) + register.
- **Faza 2** — RBAC ulash + rol presetlari.
- **Faza 3** — «Планы» nav + app-shell + breadcrumb + mobil nav.
- **Faza 4** — `/plans/approvers` sahifa + workspace UI (to'liq prototip mantig'i).
- **Faza 5** — API ulash + RBAC gating + holatlar (loading/empty/error) + validatsiya.
- **Faza 6** — Test (backend unit/integration, frontend smoke) + demo seed + `typecheck`/`lint`/`audit:max-loc`.

## Tekshirish (har faza oxirida)
- Migratsiya `prisma migrate dev` toza o'tadi; `prisma generate` xatosiz.
- `GET options` to'g'ri brend/supervayzer/xodim/rahbar ro'yxatini qaytaradi.
- Brend tanlab zanjir tuzish → `PUT` → qayta `GET` da saqlangani ko'rinadi (replace ishlaydi).
- `plans.nastroyka_utverzhdayushchih.update` o'chirilgan rol → `PUT` 403, UIda tugmalar disabled/yashirin.
- `typecheck`, `lint`, `audit:max-loc`, smoke testlar yashil.
