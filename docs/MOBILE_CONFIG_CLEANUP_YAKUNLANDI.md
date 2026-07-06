# ✅ Mobile config Faza 1–4 — yakunlandi

**Sana:** 2026-06-26

## Tekshiruv

```powershell
# Backend
cd backend
npm run bitta-ilova:verify

# Flutter
cd mobile
flutter test test/unit/mobile_order_guards_test.dart
flutter analyze lib/core/config lib/features/agent/orders lib/features/agent/visits lib/features/agent/clients lib/features/agent/warehouse lib/features/agent/shell
```

| Qatlam | Natija |
|--------|--------|
| Backend mobile + order policy tests | ✅ |
| Flutter unit + analyze | ✅ |

## Faza 1 — Asosiy qoidalar ✅

Mandatory sync, route limit, GPS, resume, van harakatda buyurtma blok — [MOBILE_CONFIG_GAP_PLAN.md](../mobile/MOBILE_CONFIG_GAP_PLAN.md).

## Faza 2 — Misc va buyurtma ✅

| # | Maydon | Ulanish |
|---|--------|---------|
| 2.1–2.4 | QR vizit/mijoz | `client_qr_sheet.dart`, `client-qr/bind\|unbind` API, actions sheet |
| 2.5 | `allow_exchange_request` | Menyu → `/orders/special?mode=exchange` |
| 2.6 | `require_stock_snapshot_for_order` | `agent_warehouse_stock_page.dart` + `mobile_order_guards.dart` |
| 2.7 | `require_shipment_date` | `order_create_sheets.dart`, `create_order_screen.dart`, backend validation |
| 2.8 | `allow_return_from_shelf` | Menyu → `/orders/special?mode=shelf-return` |

## Faza 3 — VanSelling va audit ✅

| # | Maydon | Ulanish |
|---|--------|---------|
| 3.1 | `allow_order_while_moving` | `create_order_screen.dart` (GPS speed) |
| 3.2 | `allow_change_movement_status` | `VanMovementStatusBar` in `agent_shell.dart` |
| 3.3 | `supervision.check_*` | `visit_supervision_sheet.dart`, vizit actions |
| 3.4 | `outlet.plan_version` | Bosh sahifa reja satrida `v{plan_version}` |

## Faza 4 — Backend sinxron ✅

| Maydon | Ulanish |
|--------|---------|
| Stock snapshot | `POST /mobile/stock-snapshot`, `assertStockSnapshotToday` on order create/enqueue |
| Shipment date | `validateShipmentDateRequired` on order create |
| Mandatory sync | Mavjud `assertMobileOrderMandatoryPolicy` |

## Cleanup

| Ish | Holat |
|-----|--------|
| Ishlatilmagan `polki-return-bonus-cell.tsx` o‘chirildi | ✅ |
| `polki-return-bonus-summary.tsx` saqlanadi | ✅ |
