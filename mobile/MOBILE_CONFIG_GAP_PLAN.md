# Mobil konfiguratsiya — to‘liq ulanish rejasi

> Manba: veb «Конфигурации» (`agent-configurations-dialog.tsx`)  
> Holat: 2026-06-26 — **Faza 1–4 yakunlandi**

## Umumiy oq

```
Veb panel → agent_entitlements.mobile_config → GET /mobile/agent-config → Session.mobileConfig → siyosat + UI
```

Konfig yangilanishi: login, bootstrap, drawer ochilganda, **app resume**.

---

## Faza 1 — Asosiy qoidalar ✅

| # | Maydon | Holat |
|---|--------|-------|
| 1.1 | `sync.mandatory_sync_count` | ✅ |
| 1.2 | `route.daily_visit_limit` | ✅ |
| 1.3 | `route.readd_cooldown_days` | ✅ |
| 1.4 | `gps.min_battery_pct` | ✅ |
| 1.5 | Config refresh (app resume) | ✅ |
| 1.6 | `van_selling.allow_order_while_moving` | ✅ |

---

## Faza 2 — Misc va buyurtma kengaytmalari ✅

| # | Maydon | Fayllar | Holat |
|---|--------|---------|-------|
| 2.1 | `misc.qr_attach_visit_page` | `client_qr_sheet.dart`, `agent_visits_page.dart` | ✅ |
| 2.2 | `misc.qr_change_visit_page` | QR unbind | ✅ |
| 2.3 | `misc.qr_attach_client_page` | `client_detail_screen.dart` | ✅ |
| 2.4 | `misc.qr_change_client_page` | QR unbind | ✅ |
| 2.5 | `misc.allow_exchange_request` | `agent_misc_orders_page.dart`, menyu | ✅ |
| 2.6 | `misc.require_stock_snapshot_for_order` | `agent_warehouse_stock_page.dart`, backend | ✅ |
| 2.7 | `misc.require_shipment_date` | `order_create_sheets.dart`, backend | ✅ |
| 2.8 | `orders.allow_return_from_shelf` | `agent_misc_orders_page.dart`, menyu | ✅ |

---

## Faza 3 — VanSelling va audit ✅

| # | Maydon | Holat |
|---|--------|-------|
| 3.1 | `van_selling.allow_order_while_moving` | ✅ |
| 3.2 | `van_selling.allow_change_movement_status` | ✅ `VanMovementStatusBar` |
| 3.3 | `supervision.check_*` | ✅ `VisitSupervisionSheet` |
| 3.4 | `outlet.plan_version` | ✅ bosh sahifa reja satri |

---

## Faza 4 — Backend sinxron ✅

| Maydon | Holat |
|--------|-------|
| Stock snapshot validation | ✅ |
| Shipment date validation | ✅ |
| Mandatory sync on order POST | ✅ |

---

## Test

```powershell
cd mobile
flutter test test/unit/mobile_order_guards_test.dart
flutter test test/unit/route_config_policy_test.dart
flutter test test/unit/mobile_config_policy_test.dart

cd ../backend
npm run bitta-ilova:verify
```
