# SALEC — Filtrlar (multi-select) rejasi

**Maqsad:** Ro‘yxat/filtr panellarida enum va katalog maydonlari **bir nechtasini** tanlash mumkin bo‘lsin. Bo‘sh = hammasi. UI: `|` ; API: 1 → singular, 2+ → plural (vergul).

---

## Qoida

| Tanlov | Query |
|--------|--------|
| 0 | param yo‘q |
| 1 | `status` / `category` / `warehouse_id` / … |
| 2+ | `statuses` / `categories` / `warehouse_ids` / … |

**Multi emas (mutually exclusive):** Да/Нет/Все tristate, faol/arxiv toggle, deal_type radio.

---

## Holat (2026-09-16)

### Tayyor (multi + API)

| Modul | Nima |
|-------|------|
| To‘lovlar / client-expenses | status, to‘lov turi, savdo yo‘nalishi, kassa, agent, expeditor |
| Chiqimlar (expenses) | status → `statuses` |
| EPR | status, to‘lov turi, savdo yo‘nalishi, agent/expeditor/territory |
| Edit-grants | status, expeditor, bekor sababi |
| Klientlar ro‘yxati | tip, kategoriya, format, kanal, jihoz, zona/oblast/shahar, agent/expeditor/supervisor/kun |
| Goods receipts (приход) | ombor, yetkazib beruvchi, status |
| Supplier payments | yetkazib beruvchi, to‘lov usuli, kassa |
| Orders / refusals / dashboard / balances | avvaldan multi (OrdersListSingleMultiFilter / SupervisorDashboardMultiFilter) |

### Backend qo‘llab-quvvatlash

- `clients.route.schemas.parsers` + `clients.list.where` — `categories`, `regions`, `cities`, `client_type_codes`, …
- `goods-receipt.list` / route — `warehouse_ids`, `supplier_ids`, `statuses`
- `supplier-accounting` — `supplier_ids`, `cash_desk_ids`, `payment_methods`
- payments / expenses / edit-grants — avvalgi + yangi plurals

### Qolgan (pastroq ustuvor / form filter emas)

- Stock balances / products catalog — ba’zi native `<select>` hali single (ombor/kategoriya); kerak bo‘lsa shu pattern bilan
- Equipment / retail-stock / visit-planner native selectlar
- Diagnostic error-logs

### Infra

[SERVER_MIGRATION_PLAN.md](./SERVER_MIGRATION_PLAN.md)

---

## Smoke

1. Ikkita status tanlash → faqat shular
2. Bo‘sh → hammasi
3. Bitta qiymat → eski singular param
4. Klientlar: ikki kategoriya + zona
5. Приход: ikki status + ombor
