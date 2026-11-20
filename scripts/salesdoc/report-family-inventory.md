# Report family inventar + parity checklist

**ADR-012** · GLOSSARY «Report family» · yangilangan 2026-11-20 (wave-5 + final check)

Qiymatlar: `ha` | `yoq` | `qisman` | `—` (Custom / Virtual / skip).

**Final check (FlatReport):** barcha 31 slugda f1–f4 to‘ldirilgan. `f2=yoq` (adapter yoq): `expeditor-returns`, `agent-orders`, `client-sales-2`, `client-sales-4` — why note ustunda. `f2=qisman` (adapted, chrome cheklangan): `sku-3`, `expeditor-shipments`, `excel-export`.

## Parity checklist (FlatReport)

| # | Band | Savol |
|---|------|--------|
| 1 | **Filtrlar** | SD/PortSpec maydonlari SALECda bormi? |
| 2 | **Chrome joylashuv** | FlatReportPage adaptermi? |
| 3 | **Oylik/dialog** | Configga sig‘adimi? |
| 4 | **Export + RBAC** | Export + permission + jadval/pager? |

## VirtualPivot

| slug | note | f1 | f2 | f3 | f4 |
|------|------|----|----|----|-----|
| `builder/pivot` | `@salec/pivot-engine` | — | — | — | — |
| `builder` | redirect → pivot | — | — | — | — |

## CustomReport

| slug | note | f1 | f2 | f3 | f4 |
|------|------|----|----|----|-----|
| `p1` | oylik matritsa — FlatReport emas | — | — | — | — |
| `product-sales` | CUSTOM_OUT ~900 LOC | — | — | — | — |
| `universal-sales` | CUSTOM_OUT ~900 LOC | — | — | — | — |
| `client-sales` | SDC workspace | — | — | — | — |
| `gps` | GPS metrics | — | — | — | — |
| `gps/map` | GpsMonitoringWorkspace | — | — | — | — |
| `(reports root)` | IncomeReportWorkspace | — | — | — | — |
| `cash-flow` | CashFlowWorkspace | — | — | — | — |
| `client-reconciliation` | akt workspace | — | — | — | — |
| `order-debts` | OrderDebtsWorkspace | — | — | — | — |
| `settings` | menyu prefs | — | — | — | — |
| `soon/feedback` | deferred stub | — | — | — | — |
| `soon/nr` | deferred stub | — | — | — | — |
| `soon/tare` | deferred stub | — | — | — | — |

## FlatReport

| slug | note | f1 filtr | f2 chrome | f3 oylik/dialog | f4 export/RBAC |
|------|------|----------|-----------|-----------------|----------------|
| `discount-detail` | FlatReportPage wave-1 | ha | ha | — | ha |
| `universal-discounts` | FlatReportPage wave-1 | ha | ha | — | ha |
| `bonuses` | FlatReportPage wave-1 | ha | ha | — | ha |
| `cumulative-bonus` | FlatReportPage wave-1 | ha | ha | — | ha |
| `visits` | FlatReportPage wave-1 | ha | ha | — | ha |
| `outlet-class` | FlatReportPage wave-1 | ha | ha | — | ha |
| `rfm` | FlatReportPage wave-2 | ha | ha | — | ha |
| `prices` | FlatReportPage wave-2 | ha | ha | — | ha |
| `balance-control` | FlatReportPage wave-2 | ha | ha | — | ha |
| `daily-visits` | FlatReportPage wave-2; year/month select | ha | ha | ha | ha |
| `sku-3` | wave-3; matrix→flat product cols; dual header/banner yo‘q | ha | qisman | — | qisman |
| `order-qty` | FlatReportPage wave-3 | ha | ha | — | ha |
| `inventory` | FlatReportPage wave-3 | ha | ha | — | ha |
| `photo` | FlatReportPage wave-3 | ha | ha | — | ha |
| `tasks` | FlatReportPage wave-3 | ha | ha | — | ha |
| `sales-compare` | wave-3; dual dateRange A/B | ha | ha | — | ha |
| `expeditor-share` | FlatReportPage wave-4 | ha | ha | — | ha |
| `expeditor-visits` | FlatReportPage wave-4 | ha | ha | — | ha |
| `expeditor-shipments` | wave-4; matrix→flat expeditor cols; invoice footer yo‘q | ha | qisman | — | ha |
| `universal-visits` | FlatReportPage wave-4 | ha | ha | — | ha |
| `universal-bonuses` | wave-4; group_by dynamic cols | ha | ha | — | ha |
| `universal-returns` | FlatReportPage wave-4 | ha | ha | — | ha |
| `shelf-returns` | FlatReportPage wave-5 | ha | ha | — | ha |
| `excel-export` | wave-5; subtitle «SalesDoc Version 1» chrome yo‘q | ha | qisman | — | ha |
| `visits-2` | wave-5; territory cascade/sort UI yo‘q (flat multiSelect) | qisman | ha | — | ha |
| `visit-totals` | wave-5; defaultRange=today; BAD_RANGE Card banner yo‘q | qisman | ha | — | ha |
| `client-sales-3` | wave-5; rowsKey=`clients` + staticOptions client_activity | ha | ha | — | ha |
| `expeditor-returns` | **adapter yoq** — why: 3 parallel APIs + 3× column dialog + unit_mode radios + order Link; CustomReport-level | qisman | yoq | — | ha |
| `agent-orders` | **adapter yoq** — why: status_cards + dual matrix + MetricSwitch; payload `rows[]` emas; export endpoint yoq | qisman | yoq | — | yoq |
| `client-sales-2` | **adapter yoq** — why: dual table (clients+agents) + column settings ×2 + territory cascade + 3 export | qisman | yoq | qisman | ha |
| `client-sales-4` | **adapter yoq** — why: MonthYearPicker (not dateRange) + column dialog + territory cascade | qisman | yoq | qisman | ha |

## Yangilash qoidasi

1. Yangi slug → avval oila (ADR-012), keyin qator.
2. FlatReport adapter merge → f1–f4 to‘ldirish.
3. Sig‘masa CustomReport ga ko‘chirish.
