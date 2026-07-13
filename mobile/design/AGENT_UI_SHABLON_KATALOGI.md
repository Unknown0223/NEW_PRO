# SALEC Agent — UI shablon katalogi

> Manba: `salec-agent-mobile-ui-design.zip` (React prototip + Flutter mock)  
> Ishchi papka: `mobile/design/screens/` — siz yuborgan rasmlar shu yerga saqlanadi  
> Yangilangan: 2026-07-08

## Qanday ishlaymiz

1. Siz katalogdan **bitta ekran rasmini** yuborasiz (masalan: «01 — LOGIN»).
2. Men shablon bilan solishtiraman:
   - **Mavjud** bo‘lsa — `mobile/lib/features/agent/...` dagi ekranni moslashtiraman.
   - **Yo‘q** bo‘lsa — menyu/joyiga **«Скоро»** yozib qo‘yaman.
3. Rasm: `mobile/design/screens/NN-slug.png` nomi bilan saqlanadi.

## Holat belgilari

| Belgisi | Ma'nosi |
|---------|---------|
| ✅ | To‘liq implementatsiya (API + UI) |
| ⚠️ | Qisman — asosiy UI bor, shablon detallari yo‘q |
| 🔜 | Hali yo‘q — «Скоро» |

---

## Katalog (38 ekran)

| # | Faza | Shablon nomi | Production fayl | Route | Holat | Rasm |
|---|------|--------------|-----------------|-------|-------|------|
| 01 | Onboarding | LOGIN | `features/auth/login_screen.dart` | `/login` | ✅ | — |
| 02 | Onboarding | PIN SETUP | `features/auth/pin_setup_screen.dart` | `/pin-setup` | ✅ | — |
| 03 | Onboarding | BOOTSTRAP / FULL SYNC | `features/auth/bootstrap_screen.dart` | `/bootstrap` | ✅ | — |
| 04 | Onboarding | PIN UNLOCK | `features/auth/pin_unlock_screen.dart` | `/unlock` | ✅ | — |
| 05 | Home | HOME — Главная | `features/agent/home/agent_home_page.dart` | `/home` | ✅ | — |
| 06 | Home | SIDE MENU / DRAWER | `features/agent/shell/agent_drawer.dart` | drawer | ✅ | — |
| 07 | Visits | VISITS — Визиты | `features/agent/visits/agent_visits_page.dart` | `/visits` | ✅ | — |
| 08 | Visits | START VISIT | `features/agent/visits/start_visit_screen.dart` | `/visits/start` | ✅ | — |
| 09 | Visits | VISIT IN PROGRESS | `features/agent/visits/visit_in_progress_screen.dart` | `/visits/active/:id` | ✅ | `screens/09-12-visit-clients-detail.png` |
| 10 | Visits | REFUSAL REASON | `agent_visit_ui.dart` → `showRefusalReasonSheet` | sheet | ✅ | `screens/09-12-visit-clients-detail.png` |
| 11 | Clients & Orders | CLIENTS / OUTLETS | `features/agent/clients/agent_clients_page.dart` | `/clients` | ✅ | `screens/09-12-visit-clients-detail.png` |
| 12 | Clients & Orders | CLIENT DETAIL | `features/agent/clients/client_detail_screen.dart` | `/clients/:id` | ✅ | `screens/09-12-visit-clients-detail.png` |
| 13 | Clients & Orders | CREATE ORDER — Client | `features/agent/orders/create_order_screen.dart` | `/orders/create` | ✅ | — |
| 14 | Clients & Orders | CREATE ORDER — Setup | `create_order_screen.dart` (step 2) | `/orders/create` | ✅ | — |
| 15 | Clients & Orders | CREATE ORDER — Categories | `create_order_screen.dart` (step 3) | `/orders/create` | ✅ | — |
| 16 | Clients & Orders | CREATE ORDER — Products | `create_order_screen.dart` (step 4) | `/orders/create` | ✅ | — |
| 17 | Clients & Orders | CREATE ORDER — Submit | `create_order_screen.dart` (step 5) | `/orders/create` | ✅ | — |
| 18 | Clients & Orders | MY ORDERS · Мои заказы | `features/agent/orders/agent_orders_page.dart` | `/orders` | ✅ | — |
| 19 | Reports & Map | REPORTS | `features/agent/report/agent_report_page.dart` | `/reports` | ✅ | — |
| 20 | Reports & Map | MAP | `features/agent/misc/agent_map_page.dart` | `/map` | ✅ | — |
| 21 | Secondary | WAREHOUSE STOCK | `features/agent/warehouse/agent_warehouse_stock_page.dart` | `/warehouse-stock` | ✅ | — |
| 22 | Secondary | DEBTORS | `features/agent/clients/agent_debtors_page.dart` | `/debtors` | ✅ | — |
| 23 | Secondary | DRAFT ORDERS | `features/agent/misc/agent_draft_page.dart` | `/draft` | ✅ | — |
| 24 | Secondary | NEW CLIENT FORM | `features/agent/clients/new_client_page.dart` | `/clients/new` | ✅ | — |
| 25 | Secondary | SETTINGS | `features/agent/misc/agent_settings_page.dart` | `/settings` | ✅ | — |
| 26 | Secondary | SYNC BOTTOM SHEET | `features/agent/sync/sync_bottom_sheet.dart` | sheet | ✅ | — |
| 27 | Secondary | SYNC SUCCESS | `features/agent/sync/sync_success_screen.dart` | `/sync-success` | ✅ | — |
| 28 | Notifications & Offers | NOTIFICATIONS | — | — | 🔜 | — |
| 29 | Notifications & Offers | BONUS & DISCOUNT LADDER | `order_create_sheets.dart` (bonus/skidka) | sheet | ✅ | — |
| 30 | Order Lifecycle | ORDER STATUS · read-only | `agent_orders_page.dart` (expand) | `/orders` | ⚠️ | — |
| 31 | Order Lifecycle | ҚАРЗЛАР · Agent debts | `features/agent/clients/agent_debtors_by_orders_page.dart` | `/debtors-by-orders` | ⚠️ | — |
| 32 | Order Lifecycle | МОИ БОНУСЫ · Agent bonuses | — | — | 🔜 | — |
| 33 | Order Lifecycle | ORDER DETAIL · read-only | `agent_orders_page.dart` (expand) | `/orders` | ⚠️ | — |
| 34 | KPI Dashboard | KPI · Bugungi KPI | — | — | 🔜 | — |
| 35 | KPI Dashboard | KPI · Oylik hisobot | — | — | 🔜 | — |
| 36 | KPI Dashboard | KPI · Маршрут KPI | `features/agent/route/agent_route_page.dart` | `/route` | ⚠️ | — |
| 37 | KPI Dashboard | ТАБЕЛЬ · Detail | — | — | 🔜 | — |
| 38 | Order Lifecycle | EDIT WINDOW · 5min timer | — | — | 🔜 | — |

---

## Qisqa xulosa

| Holat | Soni |
|-------|------|
| ✅ To‘liq | 27 |
| ⚠️ Qisman | 5 |
| 🔜 Skoro | 6 |

## Menyuda «Скоро» (hozir)

`agent_menu_config.dart` da allaqachon belgilangan:

- KPI → `soon: true`
- Зарплата → `soon: true`
- Диагностика → `soon: true`
- Задачи → `soon: true`
- Табель · jadval → `soon: true`

Qolgan 🔜 ekranlar (28, 32, 34–35, 37–38) keyingi bosqichda qo‘shiladi.

## Shablon zip joylashuvi

Loyihada ochilgan nusxa: `_salec-agent-mobile-ui-design-import/`

- React prototip: `src/App.tsx` (38 ekran, journey/grid)
- Flutter mock: `mobile/lib/features/agent/screens/...`

## Keyingi qadam

Birinchi rasmni yuboring — masalan: **«01 LOGIN»** yoki **«05 HOME»**.  
Men shu ekranni shablonga moslashtiraman yoki «Скоро» deb belgilayman.
