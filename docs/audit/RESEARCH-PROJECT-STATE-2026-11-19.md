# RESEARCH — SALEC / sales_copiya project state (reports-focused)

**Date:** 2026-11-19  
**Repo path:** `e:\sales_copiya`  
**Method:** primary sources only (source tree, `package.json` scripts, Prisma layout, nav/RBAC code). No inventing; claims cite paths below.

## Verdict

Monorepo is a working Fastify + Next.js + Flutter + packages stack with a large **Отчёт** surface: **~14 live report UIs with matching APIs** (plus cash reports under `/reports/*`), while **29 SalesDoc menu stubs** remain as clickable amber `/reports/soon/[slug]` pages. Dedicated per-report RBAC exists only for the implemented Отчёт pages; stubs share the generic `NAV_PERM.reports` OR-list. SalesDoc **pull/import/fix** tooling is present under `scripts/salesdoc/` and `backend/scripts/*salesdoc*`. **Follow-up 2026-11-19:** `scripts/salesdoc/probe-reports.ps1` + `report-stubs-map.json` restored (were missing at research time).

---

## 1. Scope / method

| In scope | Out of scope |
|---|---|
| `frontend/`, `backend/`, `mobile/`, `packages/*`, `scripts/`, `shared/`, `telegram-client-bot/`, `infrastructure/`, `docs/audit/` | Blog posts, unverified memory of Sales Doctor product |
| Nav, stubs, report routes, `permission-model`, `report-permissions`, route guard | Runtime DB contents / prod screenshots |
| Root + package scripts for quality gates | Changing application code (this doc only) |

Older audit style reference: `docs/audit/AUDIT-2026-11.md` (findings here re-verified against code, not copied as truth).

---

## 2. Architecture snapshot

### 2.1 Top-level layout (folder tree + root `package.json`)

| Package / dir | Role (from tree / scripts) |
|---|---|
| `backend/` | Fastify API, Prisma, Vitest; `npm run dev --prefix backend` |
| `frontend/` | Next.js panel; port 3000 via frontend scripts |
| `mobile/` | Flutter app (`pubspec.yaml` present) |
| `mobile_legacy/` | Legacy mobile tree (sibling) |
| `packages/*` | npm workspaces: `pivot-engine`, `pivot-ui`, `pivot-demo`, `hr-hub`, `plans-proposal`, `plans-proposal-demo`, `types` |
| `scripts/` | Dev/deploy/audit/SalesDoc pull helpers |
| `shared/` | Small shared helpers (`client-display-id.ts`, territory seed) |
| `telegram-client-bot/` | grammY bot package |
| `infrastructure/` | docker-compose, nginx, terraform, pm2 |
| `docs/` | Audits / plans (`docs/audit/`) |

Root package name is `"salesdoc"`; workspaces are only `"packages/*"` — backend/frontend are installed via `--prefix`, not as workspaces (`package.json` L1–7, L9).

Dev orchestration: root `"dev"` runs API + worker + web concurrently (`package.json` L29).

### 2.2 Backend modules (reports-relevant)

- Reports domain: `backend/src/modules/reports/` (route split: `reports.route.ts` → analytics / debts / financial / specialized / builder).
- Adjacent: `report-builder/`, `dashboard/`, `clients/` (reconciliation), `cash` permissions for income/DDS.
- Access: `backend/src/modules/access/permission-model.ts`, `route-permission-guard.ts`.

### 2.3 Prisma

- Entry: `backend/prisma/schema.prisma` — generator + datasource only.
- Models: multi-file under `backend/prisma/models/*.prisma` (**150** `model` declarations counted 2026-11-19).
- CLI config: `backend/prisma.config.ts` — `schema: path.join("prisma")`, migrations under `prisma/migrations`.

### 2.4 Frontend Отчёт wiring

- Nav: `frontend/components/dashboard/nav-config.ts` → `dashboardReportsNav`.
- Stubs list: `frontend/lib/report-menu-stubs.ts`.
- Amber styling for stubs: `app-shell.tsx` treats `href.startsWith("/reports/soon/")` as amber link (not `placeholder: true`).

---

## 3. Reports: implemented vs stubs

### 3.1 Stub catalog (`REPORT_MENU_STUBS`) — **29**

Source: `frontend/lib/report-menu-stubs.ts` L1–32. Comment: SalesDoc «Отчёты» items not yet working in this project.

| # | slug | label |
|---|---|---|
| 1 | `client-sales-3` | Продажи по клиентам 3 |
| 2 | `order-qty` | Отчет по количеству заказов |
| 3 | `sku-3` | По Sku 3.0 |
| 4 | `expeditor-shipments` | Отгрузки по экспедиторам |
| 5 | `shelf-returns` | Отчет по возвратам (возврат с полки) |
| 6 | `excel-export` | Excel экспорт |
| 7 | `inventory` | По инвентарю |
| 8 | `photo` | Фотоотчёты |
| 9 | `tasks` | Отчёт по задачам |
| 10 | `feedback` | Отчёт обратной связи (бот акт сверки) |
| 11 | `nr` | НР отчёты |
| 12 | `bonuses` | По бонусам |
| 13 | `cumulative-bonus` | Накопительный бонус |
| 14 | `visits` | По визитам |
| 15 | `daily-visits` | По дневному посещению |
| 16 | `prices` | По ценам |
| 17 | `tare` | По тарам |
| 18 | `outlet-class` | Классификация торговых точек |
| 19 | `expeditor-visits` | Визиты экспедиторов |
| 20 | `universal-returns` | Универсальный отчет по возвратам |
| 21 | `universal-bonuses` | Универсальный отчет по бонусам |
| 22 | `universal-visits` | Универсальный отчет по посещениям |
| 23 | `universal-discounts` | Универсальный отчет по скидкам |
| 24 | `universal-sales` | Универсальный отчёт по продажам |
| 25 | `discount-detail` | Детальный отчет по скидкам |
| 26 | `rfm` | RFM |
| 27 | `balance-control` | Контроль балансов |
| 28 | `expeditor-share` | Доли по экспедиторам |
| 29 | `sales-compare` | Сравнительный анализ продаж |

Nav injection: `dashboardReportsNav` maps each to `/reports/soon/${slug}` with `showIfAnyPermission: [...NAV_PERM.reports]` (`nav-config.ts` L501–505).

Stub page: `frontend/app/(dashboard)/reports/soon/[slug]/page.tsx` → `ReportPlaceholder` (“Раздел пока в разработке…”).

### 3.2 Frontend `/reports/*` routes under `frontend/app/(dashboard)/reports/`

| Route folder | Kind |
|---|---|
| `agent-orders/` | Real page |
| `gps/`, `gps/map/` | Real pages |
| `client-sales/` | Real page (reuses client-sales-2 API) |
| `client-sales-2/` | Real page |
| `client-sales-4/` | Real page |
| `product-sales/` | Real page |
| `p1/` | Real page |
| `expeditor-returns/` | Real page |
| `visits-2/` | Real page |
| `visit-totals/` | Real page |
| `builder/` → redirect to `builder/pivot/` | Real (Virtual Pivot) |
| `settings/` | Real (UI prefs hide menu items) |
| `page.tsx` (`/reports`) | Real — income report workspace |
| `cash-flow/` | Real |
| `client-reconciliation/` | Real (clients reconciliation API) |
| `order-debts/` | Real |
| `soon/[slug]/` | **Placeholder only** |

### 3.3 Status table — Отчёт nav + cash `/reports/*`

Status legend: **live** = UI calls API; **UI→shared API** = distinct UI, existing report endpoint; **stub** = soon placeholder; **live prefs** = settings without report query.

| Nav / path | Status | Backend evidence |
|---|---|---|
| `/reports/agent-orders` | live UI+API | `reports.route.financial.ts` agent-orders; page `api.get .../reports/agent-orders` |
| `/reports/gps` | live UI+API | `reports.route.gps.ts` `gps-delivery-routes` |
| `/reports/client-sales` | UI→shared API | Workspace hits `/reports/client-sales-2` (no dedicated `client-sales` route) |
| `/reports/client-sales-2` | live UI+API | `reports.route.specialized.ts` |
| `/reports/client-sales-4` | live UI+API | same |
| `/reports/product-sales` | live UI+API | same |
| `/reports/p1` | live UI+API | `reports.route.p1.ts` |
| `/reports/expeditor-returns` | live UI+API | specialized routes |
| `/reports/visits-2` | live UI+API | specialized |
| `/reports/visit-totals` | live UI+API | specialized |
| `/plans/daily`, `/plans/daily/groups` | live (plans module; listed under Отчёт) | guard `reports.dnevnye_kpi_plany.view` |
| `/reports/builder` → `/reports/builder/pivot` | live UI+API | `reports.route.builder.ts` + Virtual Pivot |
| `/reports/settings` | live prefs | `/me/ui-preferences` |
| `/reports` (Отчёт по приходам / kassa) | live UI+API | income-report routes |
| `/reports/cash-flow` | live UI+API | cash-flow route |
| `/reports/client-reconciliation` | live UI+API | `clients/.../reconciliation*` (not `modules/reports`) |
| `/reports/order-debts` | live UI+API | `reports.route.debts.ts` |
| **29 ×** `/reports/soon/*` | **stub only** | `ReportPlaceholder` |

**Counts (actionable):**

| Metric | N |
|---|---|
| `REPORT_MENU_STUBS` | **29** |
| Distinct live `/reports/*` page folders (excl. `soon`, incl. builder/settings/cash) | **16** route trees |
| Dedicated Отчёт pages with own API path in `REPORT_PAGE_PERMISSIONS` | **9** (+ konstruktor / daily KPI separately) |
| Nav `placeholder: true` (non-report) | **8** |

### 3.4 Backend report API surface (extra vs Отчёт menu)

Registered under `modules/reports` but **not** 1:1 with yellow stubs:

- Analytics: `/reports/sales`, `order-trends`, `products`, `clients`, `agent-kpi`, `status-distribution`, `channels`, `abc-analysis`, `xyz-analysis`, `client-churn` (`reports.route.analytics.ts`).
- Receivables aliases + order-debts (`reports.route.debts.ts`).
- Income + cash-flow + agent-orders (`reports.route.financial.ts`).
- Specialized sales/returns/visits + GPS + P1.
- Report builder CRUD/preview/export.

Route entry: `reports.route.ts` L9–15.

### 3.5 Permission keys for live Отчёт pages

`report-permissions.ts` L5–14 + `permission-model.ts` L210–220:

| path key | section |
|---|---|
| agent-orders | `reports.zakazy_agentov` |
| gps-delivery-routes | `reports.gps` |
| client-sales-2 | `reports.prodazhi_klientov_2` |
| client-sales-4 | `reports.prodazhi_klientov_4` |
| product-sales | `reports.prodazhi_tovarov` |
| p1 | `reports.p1` |
| expeditor-returns | `reports.vozvrat_ekspeditora` |
| visits-2 | `reports.vizity` |
| visit-totals | `reports.itogi_vizitov` |
| (plans) | `reports.dnevnye_kpi_plany` |
| (builder) | `reports.konstruktor` |

Cash report APIs: `cash.otchety.view` / `.export` (+ legacy `cashbox.income_report.*`) in guard + `reports.route.shared.ts`.

---

## 4. Other nav placeholders (`placeholder: true`)

These are **non-clickable amber labels** (`href: "#"`, `placeholder: true`) — different from report stubs (which are clickable amber soon links).

| Section | Label | File lines |
|---|---|---|
| Склад | Списание | `nav-config.ts` L80 |
| Накладные | Списания накладные | L145 |
| Касса → ПРОЧИЕ | Приходы | L216–220 |
| Касса → ПРОЧИЕ | Долги экспедитора | L228–232 |
| Пользователи | Партнёры | L301 |
| Клиенты | Отчёт по таре | L412 |
| Поставщики | План | L438 |
| Поставщики | Баланс за период | L439 |

**Total: 8.**  
Note: `dashboardSidebarLayout` types allow `kind: "placeholder"` section headers, but current layout array (L577–628) has **no** such entries — only item-level placeholders above.

---

## 5. SalesDoc probe / import tooling already present

### 5.1 Probe tooling (restored 2026-11-19 follow-up)

| File | Status |
|---|---|
| `scripts/salesdoc/probe-reports.ps1` | **Present** — login + Отчёт menyu crawl + stub match + page probe (`-Slug`, `-FetchSample`, `-SaveHtml`) |
| `scripts/salesdoc/report-stubs-map.json` | **Present** — 29 stub slug/label/search keys for matching |

Research snapshot earlier the same day found these absent; they were re-added after the audit.

### 5.2 `scripts/salesdoc/` (present)

| Script | Purpose (from file headers / body) |
|---|---|
| `probe-reports.ps1` | Catalog / deep-probe SalesDoc report pages for porting stubs |
| `report-stubs-map.json` | Stub ↔ SalesDoc menu search map |
| `pull-andijon.ps1` | Pull dealer JSON groups from `aksitgroupcs.salesdoc.io` into a local folder; password via `$env:SALESDOC_PASSWORD` only; photos not pulled |
| `pull-marked.ps1` | Loop 9 dealers → call `pull-andijon.ps1` into `D:\salesdoc-pull\<dir>` |
| `pull-balances.ps1` | Per-dealer client saldo from SalesDoc finance report HTML/API |

### 5.3 `backend/scripts/*salesdoc*` (present; not always in `package.json` scripts)

| Script | Purpose |
|---|---|
| `import-salesdoc-andijon.ts` | Idempotent import Andijon folder → tenant id 1 (`aksit`/`test1`) |
| `import-salesdoc-branch.ts` | Namangan/Qoqon-style branch import with prefix |
| `import-salesdoc-branch-gaps.ts` | Gap fill for a branch folder |
| `import-salesdoc-marked.ts` | Marked dealer folder import |
| `align-salesdoc-balances.ts` | FIFO allocate payments to delivered orders (no new payments) |
| `fix-salesdoc-order-*.ts` / `fix-salesdoc-payment-place.ts` | Post-import fixes (headers, agents, bonuses, meta, payment place) |
| `lib/salesdoc-andijon-*.ts` + `salesdoc-client-debt.ts` + `salesdoc-price-catalog.ts` + `salesdoc-marked-extra.ts` | Shared loaders/writers |

These are **data migration / parity tools**, not report UI generators.

---

## 6. RBAC gaps for stubs

### 6.1 How report permissions are keyed

- Structured keys: `module.section.action` (e.g. `reports.prodazhi_klientov_2.view`).
- Catalog: `PERMISSION_SECTIONS` in `permission-model.ts` (reports block L209–220).
- Page↔API mapping: `REPORT_PAGE_PERMISSIONS` → expanded into `route-permission-guard.ts` L445–448.
- Route-level preHandler often allows **any** of `REPORT_VIEW_ANY_PERMISSIONS` (`report-permissions.ts` L27); **finer** section check comes from the guard regex rules.
- Frontend nav: dedicated `NAV_PERM.report*` keys for live items; stubs use broad `NAV_PERM.reports` OR-list (`nav-permission-keys.ts` L70–92, `nav-config.ts` L501–505).

### 6.2 Stub RBAC gap

| Gap | Evidence |
|---|---|
| **No** `reports.<stub_section>.view` rows for any of the 29 stubs | `permission-model.ts` reports sections stop at live set (L210–220) |
| Stubs visible if user has **any** live report view permission | `NAV_PERM.reports` OR-list |
| Implementing a stub page without adding a section + guard rule would leave only coarse access | Pattern for live pages: model section + `REPORT_PAGE_PERMISSIONS` + `NAV_PERM.*` |

Cash placeholders `Приходы` / `Долги экспедитора` already have permission keys (`cash.prihody.view`, `cash.dolgi_ekspeditora.view`) but still `placeholder: true` — opposite problem (RBAC without page).

---

## 7. Quality gates

From `.cursor/rules/sifat-tekshiruvi.mdc` and root `package.json`:

| Gate | Command |
|---|---|
| Frontend ESLint errors only | `npm run lint:errors` → `eslint . --quiet` (`frontend/package.json` L16) |
| Frontend types | `npm run typecheck --prefix frontend` → `tsc --noEmit` |
| Backend types | `cd backend && npx tsc -p tsconfig.json --noEmit` |
| Max file LOC (≤400 + legacy allowlist) | `npm run audit:max-loc` → `scripts/audit-max-file-lines.mjs` |
| Format (changed) | `npm run format:check` / `format:write` |
| Pre-commit (backend husky) | typecheck + `audit:max-loc` (per rule doc) |

Root also exposes `lint:errors`, `frontend:typecheck`, `audit:max-loc` (`package.json` L54–67).

---

## 8. Docs convention

Findings of this class belong under **`docs/audit/`**, matching `AUDIT-2026-11.md`, `FIX-PLAN-2026-11.md`, `QUEUE.md`. This file: `docs/audit/RESEARCH-PROJECT-STATE-2026-11-19.md`.

---

## 9. Recommended next-page order (1–5)

Ordered by **reuse of existing report pipelines** (code evidence), not product preference:

| # | Stub slug | Rationale |
|---|---|---|
| 1 | `client-sales-3` | Adjacent to live `client-sales-2` / `client-sales-4` services + UI patterns; nav already has «Продажи по клиентам» variants |
| 2 | `shelf-returns` | Returns domain already has `expeditor-returns` report + orders return types in nav; closest returns report gap |
| 3 | `visits` | `visits-2` + `visit-totals` already ship; SalesDoc still lists classic «По визитам» as stub — likely thinner variant of same data |
| 4 | `expeditor-shipments` | GPS delivery-routes report + expeditor returns exist; shipments is the natural logistics sibling |
| 5 | `order-qty` | Agent-orders report already aggregates order metrics; quantity-focused slice reuses financial/agent report filters |

**Defer until data model confirmed:** `rfm`, `nr`, `feedback`, `excel-export` (may be tooling not a grid), `universal-*` (wide scopes — better after 1–2 dedicated pages + builder).

**When implementing any stub, do in lockstep:** remove from `REPORT_MENU_STUBS` → real `app/(dashboard)/reports/<slug>/page.tsx` → backend route/service → `permission-model` section → `REPORT_PAGE_PERMISSIONS` + `NAV_PERM` → nav href; then quality gates in §7.

---

## 10. Sources appendix

| Claim | Source |
|---|---|
| Root monorepo name/workspaces/scripts | `package.json` L1–79 |
| packages list | `packages/` directory listing |
| Prisma split schema + 150 models | `backend/prisma/schema.prisma`; `backend/prisma/models/`; `backend/prisma.config.ts`; model count |
| Backend modules include `reports` | `backend/src/modules/` listing |
| `dashboardReportsNav` + stub spread | `frontend/components/dashboard/nav-config.ts` L447–510 |
| 29 stubs | `frontend/lib/report-menu-stubs.ts` L1–32 |
| Stub page placeholder | `frontend/app/(dashboard)/reports/soon/[slug]/page.tsx` L1–12; `report-placeholder.tsx` L1–9 |
| Amber soon links | `frontend/components/dashboard/app-shell.tsx` L1189–1191 |
| 8 `placeholder: true` items | `nav-config.ts` L80, L145, L216–220, L228–232, L301, L412, L438–439 |
| Report route folders | `frontend/app/(dashboard)/reports/**` glob |
| Report route registration | `backend/src/modules/reports/reports.route.ts` L9–15; specialized/financial/gps/p1/debts/builder/analytics |
| `REPORT_PAGE_PERMISSIONS` | `backend/src/modules/reports/report-permissions.ts` L5–29 |
| Permission catalog reports | `backend/src/modules/access/permission-model.ts` L108, L180–187, L209–220 |
| Guard wiring | `backend/src/modules/access/route-permission-guard.ts` L434–453 |
| Frontend NAV_PERM report keys | `frontend/components/dashboard/nav-permission-keys.ts` L70–99 |
| client-sales reuses API 2 | `client-sales-sdc-workspace.tsx` L133–151 |
| Income/cash-flow/order-debts/reconciliation APIs | respective `*-workspace.tsx` + route files |
| SalesDoc pull scripts only 3 files | `scripts/salesdoc/`; `git ls-files scripts/salesdoc/*` |
| Import/fix scripts | `backend/scripts/import-salesdoc-*.ts`, `fix-salesdoc-*.ts`, `align-salesdoc-balances.ts`, `lib/salesdoc-*` |
| probe-reports / stubs-map | research: absent → follow-up restored `scripts/salesdoc/probe-reports.ps1` + `report-stubs-map.json` |
| Quality gates | `.cursor/rules/sifat-tekshiruvi.mdc` L10–21, L49–62; root `package.json` L54–67; `frontend/package.json` L15–18 |
| Docs location convention | `docs/audit/AUDIT-2026-11.md` (existing); this file path |

---

*End of research note. No application code changed; no secrets included.*
