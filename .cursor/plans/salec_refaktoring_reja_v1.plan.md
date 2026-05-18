---
name: SALEC kod refaktoring reja v1
overview: "SALEC_Refaktoring_Reja_v1.docx asosida yangilangan: katta servislarni domain-driven bo‘lish, loyiha haqiqatiga mos (qisman ajratilgan orders moduli, staff ~2942 qator). Re-export orqali backward compatibility."
todos:
  - id: ref-plan-file
    content: salec_refaktoring_reja_v1.plan.md (ushbu fayl)
    status: completed
  - id: ref-orders-audit
    content: Orders moduli LOC/export xaritasi (B bo‘lim)
    status: completed
  - id: ref-orders-query
    content: domain/order.query.ts — list + detail
    status: completed
  - id: ref-orders-lifecycle
    content: domain/order.lifecycle.ts — status/bulk
    status: completed
  - id: ref-orders-meta
    content: domain/order.meta.ts — lines, meta, bulk expeditor
    status: completed
  - id: ref-orders-nakladnoy
    content: domain/order.nakladnoy.ts
    status: completed
  - id: ref-orders-create
    content: domain/order.create.ts + orders.service re-export
    status: completed
  - id: ref-bonus-split
    content: order-bonus-apply.ts bo‘linishi
    status: completed
  - id: ref-dashboard
    content: dashboard cache + domain bo‘linish
    status: completed
  - id: ref-payments
    content: payments domain 4 fayl
    status: completed
  - id: ref-staff
    content: staff kind bo‘yicha bo‘linish
    status: completed
  - id: ref-ci-coverage
    content: Coverage bosqichma CI
    status: completed
isProject: false
---

# SALEC — kod refaktoring rejasi (v1, yangilangan)

Manba: `SALEC_Refaktoring_Reja_v1.docx`  
Konventsiya: [`backend/docs/domain-boundary.md`](backend/docs/domain-boundary.md)

**Prinsip:** bir fayl = bir mas’uliyat (≤400 qator); eski import yo‘li `orders.service.ts` re-export orqali saqlanadi.

---

## A. Maqsad

- Parallel ishlash (Git conflict kamayishi)
- Test va code review soddalashishi
- Texnik qarzni boshqarish — yangi feature kichik fayllarga

**Tegmaslik zonasi (stabil modullar):** `work-slots`, `access`, `report-builder` — faqat import yo‘lini buzmaslik.

---

## B. Hozirgi holat — LOC audit (2026-05, bajarilgandan keyin)

### B.1 Orders moduli (`backend/src/modules/orders/`)

| Fayl | Qator | Holat |
|------|------:|-------|
| `orders.service.ts` | **7** | Barrel (`export * from './domain'`) |
| `orders.service.backup.ts` | 2816 | Rollback |
| `domain/order.meta.ts` + `order.meta.simple-patches.ts` | ~285 / ~130 | Meta patch (oddiy yo‘llar alohida) |
| `domain/order.create.ts` | ~234 | Orchestrator; `order.create-tx.ts` (~412), `order.create-lines.ts` (~175) |
| `domain/order.detail-mappers.ts` | 4 | Barrel → `detail-bonus` / `detail-row` / `detail-finance` |
| `domain/order.detail-*.ts` | 112–218 | Ajratilgan |
| `domain/order.nakladnoy.ts` | 343 | Ajratilgan |
| `domain/order.types.ts` | 345 | Ajratilgan |
| `domain/order.query.ts` | 302 | Ajratilgan |
| `domain/order.lifecycle.ts` | 323 | Ajratilgan |
| `order-bonus-rules.ts` | 4 | Barrel → `context` / `discount` / `qty-sum` |
| `order-bonus-resolve.ts` | 249 | Barrel qismi |
| `order-bonus-context.{fetch,match,prereq}` | 196 / 281 / 144 | Barrel `order-bonus-context.ts` |
| `order-bonus-{sum,qty}.ts` | — | Barrel `order-bonus-qty-sum.ts` |
| `order-create-context.{service,catalog}.ts` | — | Katalog kesimi alohida |
| `order-bonus-apply.ts` | 3 | Barrel |
| `order-nakladnoy-xlsx.{types,format,loading,consignment}.ts` | 52–242 | Barrel `order-nakladnoy-xlsx.ts` |
| `order-status.ts` | 174 | O‘zgarmagan |

**Integration:** `tests/orders.integration.test.ts` — 14/14 yashil (Postgres).

### B.2 Dashboard / payments / staff

| Fayl | Qator | Holat |
|------|------:|-------|
| `dashboard.service.ts` | 8 | Barrel |
| `dashboard.cache.ts`, `helpers.ts`, `supervisor.ts`, `monitoring.ts` | — | Ajratilgan |
| `dashboard.sales.{types,scope,snapshot}.ts` | 86 / 189 / 365 | Barrel `dashboard.sales.ts` |
| `dashboard.finance.{types,scope,snapshot}.ts` | 68 / 197 / 352 | Barrel `dashboard.finance.ts` |
| `dashboard.service.backup.ts` | 2378 | Rollback |
| `sales-monitoring.{types,scope,filters,snapshot*}.ts` | ≤400 | Barrel `sales-monitoring.service.ts`; `dashboard.cache` |
| `sales-monitoring.service.backup.ts` | 957 | Rollback |
| `payments.service.ts` | 8 | Barrel |
| `payment.balance.ts`, `create.ts`, `consignment.ts` | — | Ajratilgan |
| `payment.query.{types,mappers,update,read}.ts` | 123 / 294 / 191 / 175 | Barrel `payment.query.ts` |
| `staff.service.ts` | 9 | Barrel |
| `staff.shared.{types,helpers,filters}.ts` | 181 / 311 / 241 | Barrel `staff.shared.ts` |
| `staff.crud.{list,create,patch}.ts` | 285 / 361 / 141 | Barrel `staff.crud.ts` |
| `staff.patches.field.{agent,supervisor,roles}.ts` | 229 / 214 / 240 | Barrel `staff.patches.field.ts` |
| `staff.patches.sessions.ts` | ~87 | Sessiyalar |
| `staff.patches.web-presets.{store,api,bulk}.ts` | 211 / 183 / 78 | Barrel `staff.patches.web-presets.ts` |
| `staff.patches.web-agents.ts` | ~560 | Agent bulk + expeditor/collector/auditor patch |
| `staff.patches.web.ts` | 3 | Barrel |
| `staff.agent.ts` … `staff.core.ts` | — | Kind re-export |
| `agent-mobile-config.{types,parse,validate}.ts` | — | Barrel `agent-mobile-config.ts` |

### B.3 Docx dan eskirgan bandlar (bajarilmaydi)

| Docx taklifi | Haqiqat |
|--------------|---------|
| Yangi `order.status.ts` yaratish | Mavjud `order-status.ts` |
| Yangi `order.bonus.ts` ~250 qator | Mavjud `order-bonus-apply.ts` (~1233) |
| Birinchi `order.pricing.ts` | Narx `product-prices.service` da |

---

## C. Orders — tuzatilgan bo‘linish

```
backend/src/modules/orders/
  domain/
    order.types.ts
    order.detail-mappers.ts
    order.query.ts
    order.lifecycle.ts
    order.meta.ts
    order.nakladnoy.ts
    order.create.ts
    index.ts
  orders.service.ts          # re-export barrel
  orders.service.backup.ts   # 1–2 hafta rollback
  order-status.ts            # o‘zgarmaydi
  order-bonus-apply.ts       # barrel → rules + resolve
```

**Import tsikli:** `create` → `pricing/bonus` → `lifecycle`; `pricing` → `create` emas.

---

## D. Dashboard (3–4 kun)

| Fayl | Vazifa |
|------|--------|
| `dashboard.cache.ts` | `getSnapshotCache`, `setSnapshotCache`, `stableJsonStringify`, yagona TTL |
| `dashboard.supervisor.snapshot.ts` | ~560 | Visit/KPI; `snapshot-products.ts` (~288) |
| `dashboard.supervisor.ts` | Barrel |
| `dashboard.sales.ts` | `getSalesDashboardSnapshot` |
| `dashboard.monitoring.ts` | monitoring + `sales-monitoring.service` integratsiya |
| `dashboard.service.ts` | re-export + `getDashboardStats`, `getFinanceDashboardSnapshot` |

---

## E. Payments (2–3 kun)

| Fayl | Vazifa |
|------|--------|
| `payment.create.ts` | `createPayment`, confirm/reject |
| `payment.balance.ts` | balans bilan bog‘liq |
| `payment.consignment.ts` | konsignatsiya |
| `payment.query.ts` | `listPayments`, `getPaymentDetail` |
| `payment-allocations.service.ts` | **o‘zgarmaydi** |

---

## F. Staff (3–4 kun)

`staff.agent.ts`, `staff.expeditor.ts`, `staff.operator.ts`, `staff.skladchik.ts`, `staff.shared.ts` — `createStaff` / `listStaff` kind bo‘yicha.

---

## G. Test va CI

Har bosqichdan keyin:

```bash
cd backend
npm run test:contracts
npm run audit:max-loc
npx vitest run tests/orders.integration.test.ts
npm run test:work-slots
```

Coverage: bosqichma — `npm run test:coverage:orders` + CI qadam (threshold 0%, keyin 60%+). Paket: `@vitest/coverage-v8`.

---

## H. Jadval (realistik)

| Blok | Kun |
|------|-----|
| Orders domain + bonus split | 6–7 |
| Dashboard | 3–4 |
| Payments | 2–3 |
| Staff | 3–4 |
| **Jami** | **14–18 ish kuni** |

---

## I. Git

- Branch: `refactor/orders-domain-split`
- Kichik PR lar (har domain fayl)
- Backup: `orders.service.backup.ts`

---

## J. Checklist

- [x] `domain/` + `order.query.ts` + `orders.integration.test.ts` yashil
- [x] `order.lifecycle.ts`, `order.meta.ts`, `order.nakladnoy.ts`, `order.create.ts`
- [x] `orders.service.ts` faqat re-export + `orders.service.backup.ts`
- [x] `order-bonus-rules.ts` + `order-bonus-resolve.ts`
- [x] Dashboard domain + `dashboard.monitoring.ts`
- [x] Payments 4 fayl + allocations alohida
- [x] Staff `shared` + `crud` + kind re-export
- [x] CI: `test:coverage:orders`
- [x] CI: `audit:max-loc` (≤400 qator, `foundation:verify:fast` + GitHub Actions)
- [x] **2-bosqich (qisman):** `order.lines` + `order.meta`; bonus → `context`/`discount`/`qty-sum`; `staff.patches.{field,sessions,web}`; `order.detail-*`; `dashboard.supervisor.{scope,snapshot}`
- [x] **2-bosqich (qolgan):** `order.create-tx.ts`; `order-bonus-context.{fetch,match,prereq}`; `dashboard.supervisor.snapshot-{products,visits}`; `staff.patches.web-agents-{bulk,roles}`; `order-bonus-context.match-{scope,gifts}`
- [x] **2-bosqich (≤400):** `order.create-tx.{bonus,limits,stock,persist}`; `snapshot-visits.{query,map}`; `web-agents-{bulk,roles}`; `staff.shared.{types,helpers,filters}`; `staff.crud.{list,create,patch}`
- [x] **3-bosqich (≤400):** `staff.patches.field.{agent,supervisor,roles}`; `payment.query.{types,mappers,update,read}`; `dashboard.sales.{types,scope,snapshot}`; `dashboard.finance.{types,scope,snapshot}`
- [x] **4-bosqich (≤400):** `staff.patches.web-presets.{store,api,bulk}`
- [x] **5-bosqich (≤400):** `order-bonus-{sum,qty}`; `order-create-context.catalog`; `order.meta.simple-patches`
- [x] **6-bosqich:** `agent-mobile-config.{types,parse,validate}`; `order.lines` import tozalash
- [x] **7-bosqich (monitoring):** `sales-monitoring.{types,scope,filters,snapshot.base,rest}` + barrel; Redis kesh `dashboard.cache`
- [x] **7-bosqich (≤400):** `sales-monitoring.snapshot.{breakdown,matrix}` — `rest` orchestrator

**v1 yakunlandi (2026-05):** servis qatlami ≤400.

### J.1 v2 (route qatlami, boshlangan)

- [x] `orders.route.{list,catalog,detail,patch,bulk,write}.ts` + `orders.route.shared.ts`; barrel `orders.route.ts`; `orders.route.backup.ts`
- [x] `staff.route.{schemas,shared,agents,supervisors,collectors,auditors,expeditors,operators,skladchik}.ts`; barrel `staff.route.ts`; `staff.route.backup.ts`
- [x] `payment-allocations.{types,helpers,open,allocate,read,batch,aging}.ts` + barrel; backup
- [x] `order-nakladnoy-xlsx.{types,format,loading,consignment}.ts` + barrel; backup

**v2 yakunlandi (2026-05):** servis, route, allocations, nakladnoy-xlsx — barcha fayllar ≤400, barrel import yo‘llari saqlangan.

### J.2 v3 (clients moduli, boshlangan)

- [x] `clients.types.ts` — DTO va `normalizePhoneDigits`, `parseVisitWeekdaysJson`
- [x] `clients.helpers.ts` — kontakt/ref merge yordamchilari
- [x] `clients.agent-assignments.ts` — jamoa qatorlari CRUD
- [x] `clients.service.backup.ts` + barrel `clients.service.ts`
- [x] `clients.references.ts` — `getClientReferences`
- [x] `clients.list.ts` + `clients.list.where.ts` — list/export/bulk; `clients.audit.ts`
- [x] `clients.detail.ts` — detail, balans, akt-svercha PDF
- [x] `clients.write.ts` — create, update, audit logs
- [x] `clients.merge.ts`
- [x] `clients.import.{keys,parse,templates,runtime,scalar,assign,rows-create,rows-update,main}.ts` + barrel
- [x] `clients.service.ts` — faqat barrel (~15 qator)
- [x] `clients.route.{shared,schemas,list,import,dedupe,write,detail,assets,balance}.ts` + barrel; backup

### J.3 v3 (stock moduli) — yakunlandi

- [x] `stock.service.backup.ts` + barrel `stock.service.ts` (~17 qator)
- [x] `stock.{types,shared,list,balances.helpers,balances,movements}.ts`
- [x] `stock.import.{helpers,xlsx}.ts` + `stock.receipt-{report,import}.ts`
- [x] `stock.{recommended,by-date,material-report}.ts`
- [x] `stock.route.{shared,schemas,import,receipts-report,material-report,analytics,balances,core,corrections}.ts` + barrel; `stock.route.backup.ts`
- [x] `stock.receipt-report.ts` (417) / `stock.material-report.ts` (405) — ixtiyoriy ≤400 kesim

### J.4 v3 (products moduli) — yakunlandi

- [x] `products.service.backup.ts` + barrel `products.service.ts`
- [x] `products.{shared,types,crud,import.helpers,import.template,import.catalog,import.update,import.bulk,order-form}.ts`
- [x] `products.route.{shared,mappers,list,write,import,bulk}.ts` + barrel; `products.route.backup.ts`

### J.5 v3 (returns-enhanced moduli) — yakunlandi

- [x] `returns-enhanced.service.backup.ts` + barrel `returns-enhanced.service.ts`
- [x] `returns-enhanced.{types,helpers,warehouse,polki,client-data,compute,create-period,auto-mark,full-return}.ts`
- [x] `returns-enhanced.create-batch.{prepare,persist}.ts` + barrel `create-batch.ts`

### J.6 v3 (client-balances moduli) — yakunlandi

- [x] `client-balances.service.backup.ts` + barrel `client-balances.service.ts`
- [x] `client-balances.{types,constants,date,where,payments.data,payments.util,payments.aggregate,ledger,delivery,mappers,territory,report}.ts`
- [x] `client-balances.report.ts` (~516) — ixtiyoriy ≤400 kesim

### J.7 v3 (tenant-settings moduli) — yakunlandi

- [x] `tenant-settings.service.backup.ts` + barrel `tenant-settings.service.ts`
- [x] `tenant-settings.{shared,bonus,types,refs,territory,profile.read,profile.patch}.ts`
- [x] `tenant-settings.territory.ts` (326) / `tenant-settings.profile.patch.ts` (321) — ixtiyoriy ≤400 kesim

### J.8 v3 (bonus-rules moduli) — yakunlandi

- [x] `bonus-rules.service.backup.ts` + barrel `bonus-rules.service.ts`
- [x] `bonus-rules.{types,mappers,validate,crud.create,crud.update,crud.lifecycle,qty}.ts`
- [x] `bonus-rules.preview.test.ts` + `bonus-and-discount.pure.test.ts` — 25/25
- [x] `bonus-rules.route.{shared,schemas,list,read,write,lifecycle}.ts` + barrel; `bonus-rules.route.backup.ts`

### J.9 v3 (reference moduli) — yakunlandi

- [x] `reference.service.backup.ts` + barrel `reference.service.ts`
- [x] `reference.{shared,warehouse.types,warehouse.constants,warehouse.list,warehouse.links,warehouse.pickers,warehouse.table,warehouse.crud,users,category.types,category.helpers,category.list,price-types,finance-overview,category.crud}.ts`
- [x] `reference.route.{shared,schemas,warehouses,users,categories,price}.ts` + barrel; `reference.route.backup.ts`

### J.10 v3 (linkage moduli) — yakunlandi

- [x] `linkage.service.backup.ts` + barrel `linkage.service.ts`
- [x] `linkage.{types,shared,resolve.agent,resolve.warehouse,resolve.cashdesk,resolve.expeditor,territory,resolve.client,scope}.ts`

### J.11 v3 (expenses moduli) — yakunlandi

- [x] `expenses.service.backup.ts` + barrel `expenses.service.ts`
- [x] `expenses.{types,shared,list,crud,lifecycle,read,summary,pnl}.ts`

### J.12 v3 (product-catalog moduli) — yakunlandi

- [x] `product-catalog.service.backup.ts` + barrel `product-catalog.service.ts`
- [x] `product-catalog.{types,shared,groups,brands,manufacturers,segments,interchangeable,interchangeable-assert}.ts`

### J.13 v3 (keyingi kandidatlar) — yakunlandi

- [x] `sales-directions.service.ts` — barrel + `sales-directions.{shared,labels,trade,channels,kpi*}.ts`; backup
- [x] `client-dedupe.service.ts` — barrel + `client-dedupe.{types,constants,helpers,sql,preview,merge}.ts`; backup
- [x] `warehouse-transfers.service.ts` — barrel + `warehouse-transfers.{types,shared,create,list,read,receive}.ts`; backup
- [x] `income-report.service.ts` — barrel + `income-report.{types,query,fetch,report,filters,xlsx}.ts`; backup
- [x] `opening-balances.service.ts` — barrel + `opening-balances.{types,shared,list,write}.ts`; backup
- [x] `audit:max-loc` — barcha `src/**/*.ts` ≤400 (backup/test dan tashqari)
- [x] `access`, `report-builder`, `work-slots` — route/rbac/metadata/query ≤400; servis import yo‘llari saqlangan

| Qolgan (ixtiyoriy) | Holat |
|--------------------|--------|
| `stock.receipt-report.{list,daily,timeline,export,shared}.ts` | [x] barrel; backup |
| `stock.material-report.{list,export}.ts` | [x] barrel; backup |
| `clients.route.schemas.{forms,parsers}.ts` | [x] barrel; backup; ortiqcha importlar olib tashlandi |
| `staff.patches.web-agents-{bulk,roles}.ts` | [x] ≤400 (oldingi 2-bosqich) |
| `staff.crud.create.{shared,web,skladchik,field,types}.ts` | [x] barrel; backup |
| `dashboard.sales.snapshot.{types,products,orders,coverage}.ts` | [x] barrel; backup |
