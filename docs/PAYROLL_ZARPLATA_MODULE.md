# Зарплата (payroll) — modul hujjati

> Status: **ishlaydi** (backend API + frontend UI + testlar). Ma'lumotlar bazasi:
> `backend/prisma/models/group-10.prisma` + migratsiya `20261010120000_payroll_core`.

## 1. Maqsad

Xodimlar maoshini KPI natijalari asosida hisoblash:

- har bir **formula** va **сетка (tarif jadvali)** KPI guruhiga va/ya'ni rolga bog'lanadi;
- hisob **faqat** shu guruh/rol xodimlariga qo'llanadi;
- har bir rol uchun alohida hisob turi (oklad, foiz, stawka, jamoa foizi);
- oylik davr: hisoblash → tasdiqlash → to'lash → bloklash.

## 2. Ma'lumotlar bazasi

| Jadval | Vazifa |
|---|---|
| `payroll_formulas` | Hisob qoidalari: `roles[]`, `kpi_group_id`, `kind`, `base_amount`, `config` (JSON), `components[]`, `gates[]`, `valid_from/valid_to`, `priority`, `is_default` |
| `payroll_grids` + `payroll_grid_rows` | Tarif сеткаlari: `kpi_group_id`, `metric`, `mode` (`coefficient`/`amount`/`percent`), qatorlar (`month`, `from_value`, `to_value`, `coefficient`, `amount`) |
| `payroll_assignments` | Xodimga individual formula + oklad (avto rejimni bekor qiladi) |
| `payroll_periods` | Oylik davr: `month`, `status`, `total_amount`, `paid_amount` |
| `payroll_entries` | Xodim bo'yicha hisob natijasi: summa, davomat, `breakdown` (JSON), `manual_net`, `metrics` |
| `payroll_payments` | To'lovlar: `amount`, `method`, `cash_desk_id`, `voided_at` |

Formula ↔ сетка bog'lanishi `payroll_formulas.config.grid_id` (JSON) orqali — alohida FK ustun yo'q.

## 3. Formula tanlash mantiqi (`resolveFormula`)

1. Faqat **faol** va muddati mos formulalar (`valid_from`/`valid_to`).
2. **Rol mosligi**: `roles` bo'sh bo'lsa — barcha rollar.
3. Ustunlik tartibi:
   1. `kpi_group_id` xodimning `kpi_group_ids` ro'yxatida bo'lsa → **eng katta `priority`**, keyin eng kichik `id` (sabab: `kpi_group`);
   2. `kpi_group_id == null` va `is_default == true` (sabab: `role_default`);
   3. istalgan `kpi_group_id == null` (sabab: `role_any`).
4. Hech qaysisi topilmasa → `null`: summa 0 va ogohlantirish «Formula biriktirilmagan».

Xodim ro'yxati `listPayrollEmployees` dan: `kpi_group_ids` = `kpi_group_agents` orqali, `team_sales_sum` =
shu xodim boshqargan agentlar savdosi, `subordinate_sales_sum` = `team_sales_sum + sales_sum`.

## 4. Hisob zanjiri (`computePayrollEntry`)

1. `oklad` = `assignment.base_amount` ?? `formula.base_amount`.
2. Davomat koeffitsienti = `worked_days / planned_days` (0..1; `planned_days == 0` bo'lsa 1).
   `config.attendance_prorate`: `base` (faqat oklad), `all` (oklad + o'zgaruvchan qism), `none`.
3. `achievement_percent` = `sales_sum / plan_sum × 100` (reja bo'lmasa `null`).
4. O'zgaruvchan qism = `computeVariablePart` (5-qism).
5. Shartlar (`gates`) koeffitsienti: `zero_variable` → ×0; `reduce_percent` → `min(mult, 1 − p/100)`.
6. Ustama/ushlanma (`components`): `percent` yoki `amount`, baza = oklad yoki oklad+bonus.
7. Tuzatishlar (`adjustments`), chegaralar (`config.min_net`/`max_net`), yaxlitlash (`round_to`).
8. `manual_net` — eng oxirida (qo'lda summa).

`gross_amount` = oklad + o'zgaruvchan + ustama; `net_amount` = gross − ushlanma + tuzatish.

## 5. Rollar bo'yicha hisob turlari

| Rol | Standart hisob | Asosiy ko'rsatkich |
|---|---|---|
| `agent` (Агент) | oklad + KPI сетка | `sales_sum` vs `plan_sum` (shaxsiy) |
| `supervisor` (Супервайзер) | oklad + jamoa foizi | `team_sales_sum` / `team_plan_sum` |
| `ekspeditor` | oklad + yetkazish + inkassatsiya | `deliveries`, `collection_sum` |
| `inkassator` | to'plangan summaga foiz | `collection_sum` |
| `operator` | oklad (foiz ixtiyoriy) | `sales_sum` |
| `gruzchik` (Складчик) | bajarilgan operatsiya | `warehouse_ops` |
| `kassir` | to'lovlar soni/summasi | `collection_count`, `collection_sum` |
| `diler`, `merch`, `menejer`, `driver`, `bosh` | oklad yoki foiz (moslashtiriladi) | — |

Turlar (`kind`): `fixed`, `percent_sales`, `kpi_bonus`, `team_percent`, `per_delivery`, `per_collection`,
`per_visit`, `piece`.

## 6. Сетка (`payroll_grids`)

- Faqat `kpi_bonus` va `team_percent` turlarida qo'llanadi; boshqa turlarda ogohlantirish beriladi.
- Qator tanlash: avval `month` (oy), keyin `month IS NULL` (baza).
- Qiymat: `mode = coefficient` → `coefficient`; `amount` → summa; `percent` → `amount` (foiz).
- Сетка bo'lmasa → `config.percent`.
- Bonus bazasi: `config.bonus_base_is_oklad` → oklad; aks holda `config.bonus_base_metric`
  (`team_percent` uchun standart `team_sales_sum`, `kpi_bonus` uchun oklad).

## 7. Davomat (табель)

`plannedWorkdays({ month, role, workdays, holidayDates, forcedWorkDates, overrides })`:

- shaxsiy `overrides` (xodim bo'yicha) roldan ustun;
- `exceptions` (rol yoki `ALL`), `holiday` (faqat ish kuni bo'lsa ayiriladi), `forced` (qo'shiladi);
- rol jadvali `tenant.settings.workdays` dan (`{ "Агент": [...kunlar] }`).

`attendance_prorate` bu koeffitsientni qanday qo'llashni belgilaydi.

## 8. API (`/api/:slug/payroll/…`)

| Metod | Manzil | Izoh |
|---|---|---|
| GET | `/options` | Rollar, KPI guruhlar, formulalar, сеткалар, kassa, oylar |
| GET/POST | `/formulas` | Ro'yxat / yaratish |
| PATCH | `/formulas/:id` | Tahrirlash |
| GET/POST | `/grids` | Сеткалар |
| PATCH | `/grids/:id` | Tahrirlash |
| GET/PUT | `/assignments` | Individual bog'lash (ro'yxat / to'liq saqlash) |
| GET | `/periods` | Davrlar ro'yxati |
| GET | `/calc?month=&role=&kpi_group_id=` | Hisob (ko'rib chiqish, `persist:false`) |
| POST | `/calc` | Hisoblash va saqlash |
| GET | `/entries?month=` | Saqlangan hisob satrlari |
| PATCH | `/entries/:id` | `manual_net`, `comment`, `adjustments` |
| POST | `/periods/:id/status` | `approved` / `locked` / `draft` |
| GET/POST | `/payments` | To'lovlar |
| POST | `/payments/:id/void` | Bekor qilish |

Ruxsat: `staff.zarplaty.view` (o'qish) / `staff.zarplaty.create` (yozish) + rol darajasi
(`ADMIN_AND_OPERATOR_LIKE_ROLES`). Har bir marshrutda `ensureTenantContext` — `node
scripts/audit-route-tenant-context.mjs src/modules/payroll/payroll.route.ts` → `OK … 18 marshrut`.

**Muhim:** `GET /calc` va `POST /calc` natijasi bir xil; GET hech narsani saqlamaydi.

## 9. Davr holatlari

`draft` → `calculated` → `approved` → `paid`, qo'shimcha `locked`.

- `locked` holatda hisob/tuzatish yopiq; oy `tenant.settings.timesheet.locked_months` ga yoziladi
  (табель ham tahrirlanmaydi).
- Qayta hisoblashda `manual_net`, `adjustment_*` qatorlari va `comment` **saqlanadi**.
- `paid_amount` har bir to'lov yaratish/bekor qilishda qayta hisoblanadi (`paid`/`approved` almashadi).

## 10. Frontend

Sahifalar: `/settings/payroll` (hab), `/formulas`, `/grids`, `/calc`, `/assignments`, `/payments`,
`/adjustments`. Komponentlar: `frontend/components/payroll/*`.

## 11. Testlar

- `backend/tests/payroll-engine.pure.test.ts` — 27 test (engine, сетка, gates, formulalar).
- `backend/tests/payroll-mappers.pure.test.ts` — 13 test (mappers, davomat, rollar, pul).
- `frontend/tests/payroll-utils.test.ts` — 11 test (formatlash, sarlavhalar, saralash).

```bash
cd backend && npx vitest run tests/payroll-engine.pure.test.ts tests/payroll-mappers.pure.test.ts
cd frontend && npx tsc --noEmit && npx vitest run tests/payroll-utils.test.ts
```
