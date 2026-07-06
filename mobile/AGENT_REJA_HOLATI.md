# Agent mobil ilova — reja holati (2026-06-01)

> Manba reja: [MOBILE_APP_TOLOQ_REJA_UZ.md](./MOBILE_APP_TOLOQ_REJA_UZ.md) §5.1, FAZA 9.1–9.3  
> E2E tekshiruv: [E2E_CHECKLIST.md](./E2E_CHECKLIST.md)

## Umumiy xulosa

| Faza | Reja | Holat |
|------|------|--------|
| **9.1** Asos (login, JWT, bootstrap, theme) | 2–3 hafta | ✅ Tayyor |
| **9.2** Agent MVP (mijoz, buyurtma, sync, oflayn) | 3–4 hafta | ✅ Tayyor |
| **9.3** GPS + foto + config qoidalari | 2 hafta | ✅ Tayyor |
| **9.4–9.6** Ekspeditor, supervayzer, release | — | ⏳ Alohida (agent emas) |

**Agent reja (9.1–9.3) to‘liq yakunlandi** — veb konfiguratsiya maydonlari mobil va backendda qo‘llanadi.

---

## ✅ Agent (9.1–9.3) — implementatsiya

| Band | Implementatsiya |
|------|-----------------|
| Login, JWT, bootstrap, `app_access` | `auth/` + login/refresh tekshiruvi |
| Bosh sahifa, mijozlar, buyurtma, sync, oflayn | `features/agent/*` |
| Vizit, marshrut, hisobot, drawer | `agent_visits_page.dart`, `agent_route_page.dart`, `agent_shell.dart` |
| Sinxron vaqt oynasi | Mobil `evaluateSyncPolicy` + backend `evaluateMobileSyncPolicy` (`sync/full`, `sync/delta`) |
| `client.fields_visible` / `fields_required` | `client_dynamic_form.dart`, `create_client_sheet.dart`, `client_detail_screen.dart` |
| `require_new_client_approval` | Yaratishdan keyin xabar (mobil) |
| `can_change_client_location` | GPS faqat ruxsatda; backend `CLIENT_LOCATION_FORBIDDEN` |
| GPS: `always_on`, `min_distance_m`, `max_accuracy_m`, `internet_always_on` | `gps_tracker.dart`, `gps_config_policy.dart`, `create_order_screen.dart` |
| `outlet.show_plan_in_reports` | Bosh sahifada reja/buyurtma qatori |
| `misc.disallowed_payment_method_codes` | `van_selling_payment_sheet.dart` |
| `orders.bonus_fill_mode` | `order_create_sheets.dart` + `order_config_policy.dart` |
| Van selling, radius, foto, tenant refs | Avvalgi implementatsiya saqlangan |

---

## Mobil konfiguratsiya arxitekturasi

1. Veb → `agent_entitlements.mobile_config`
2. Backend → `mergeMobileConfigWithDefaults()` → `GET mobile/agent-config`
3. Mobil → `SessionManager` → `mobileConfigProvider`
4. Siyosat: `mobile_config_policy.dart`, `client_field_policy.dart`, `gps_config_policy.dart`, `order_config_policy.dart`

### Veb tab → mobil

| Veb tab | Mobil model | UI |
|---------|-------------|-----|
| Klient | `ClientConfig` (+ fields) | Dinamik forma, can_create/edit |
| GPS | `GpsConfig` | Tracker, buyurtma |
| Outlet | `OutletConfig` | Bosh sahifa reja |
| Mahsulot ro‘yxati | `ProductListConfig` | Buyurtma katalog |
| Foto | `PhotoConfig` | `photo_service` |
| Boshqa | `MiscConfig` | Vizit, to‘lov, radius |
| Sinxron | `SyncConfig` | Mobil + server |
| Buyurtma | `OrdersConfig` | Bonus rejimi |
| VanSelling | `VanSellingConfig` | To‘lov sheet |

### Keyingi sprint (agent emas)

- `misc` QR sahifalari (vizit/mijoz) — UI stub
- `orders.consignment_payment_due_rule` — muddat hisoblash UI
- `require_shipment_date`, `allow_exchange_request` — buyurtma oqimida alohida ekranlar
- Backend `plan_sum` haqiqiy reja manbasidan

---

## Tekshirish

```powershell
cd backend && npm run test -- tests/agent-mobile-config.sync-policy.unit.test.ts
cd mobile && flutter test test/unit/
subst S: "E:\SALEC — копия"
cd S:\mobile && flutter analyze lib/core/config lib/features/agent
```

Parol: `npx tsx scripts/set-agent-password.ts agent test1 111111`
