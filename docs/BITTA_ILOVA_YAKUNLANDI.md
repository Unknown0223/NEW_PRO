# ✅ Mobile (bitta ilova) — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi)

**Bitta Flutter ilova** — agent, expeditor, supervisor: login → rol → server `mobile_config` → bootstrap sync → rol shell. FAZA 9.7 (server versiya siyosati), 9.4–9.5 (expeditor/supervisor), 9.6 (FCM jadvali) implementatsiya qilingan.

Manba: `.cursor/plans/bitta_ilova_rejasi_audit_b1899fba.plan.md` · To‘liq arxitektura: [`mobile/MOBILE_APP_TOLOQ_REJA_UZ.md`](../mobile/MOBILE_APP_TOLOQ_REJA_UZ.md)

---

## Tekshiruv buyruqlari

```powershell
# Backend mobil API (44 test)
cd backend
npm run bitta-ilova:verify

# Monorepo root — bitta buyruq (backend + Flutter)
npm run bitta-ilova:verify
```

| Qatlam | Natija |
|--------|--------|
| Backend `bitta-ilova:verify` | ✅ **44/44** |
| Flutter `flutter test` | ✅ **85/85** |
| Flutter `flutter analyze --no-fatal-infos` | ✅ **0 error, 0 warning** (24 info — style/deprecation) |
| **Jami** | **129/129** test + analyze ✅ |

---

## Backend test to‘plamlari

| To‘plam | Testlar | Nima tekshiradi |
|---------|---------|-----------------|
| `agent-mobile-config.test.ts` | 12 | `mobile_config` merge, entitlements |
| `mobile-expeditor.service.unit.test.ts` | 7 | Ekspeditor biznes qoidalari |
| `mobile-expeditor-peresort.test.ts` | 5 | Peresort hisob |
| `agent-mobile-config.client-mobile.unit.test.ts` | 6 | Mobil mijoz PATCH mapping |
| `agent-mobile-config.sync-policy.unit.test.ts` | 4 | Sync siyosati |
| `mobile-expeditor-schemas.unit.test.ts` | 4 | Zod sxemalar |
| `app-release.unit.test.ts` | 3 | Semver, majburiy/ixtiyoriy yangilanish |
| `mobile-bonus-preview.integration.test.ts` | 1 | Bonus preview API |
| `mobile-schemas.unit.test.ts` | 1 | Enqueue body |
| `mobile-sync-agent-scope.test.ts` | 1 | Agent scope filter |

---

## Flutter test to‘plamlari (asosiy)

| Guruh | Testlar | Nima tekshiradi |
|-------|---------|-----------------|
| `role_guard_test.dart` | 6 | Rol izolyatsiyasi (agent ↔ expeditor) |
| `mobile_config_policy_test.dart` | 6 | Sync oynasi, block_sync |
| `expeditor_config_policy_test.dart` | 7 | Ekspeditor config enforcement |
| `client_field_policy_test.dart` | 7 | Mijoz maydonlari, validatsiya |
| `bonus_stock_utils_test.dart` | 8 | Bonus/qoldiq redistribusiya |
| `full_sync_view_model_test.dart` | 4 | Bootstrap progress (agent/expeditor) |
| `login_screen_test.dart` | 2 | Login widget smoke |
| + boshqa unit | ~45 | route, sync, OKB, supervisor parse, … |

---

## Amalga oshirilgan funksiyalar

| Band | Holat |
|------|--------|
| Bitta APK, 3 rol (agent/expeditor/supervisor) | ✅ |
| Login → bootstrap (me, permissions, config, sync) | ✅ |
| Veb panel → `mobile_config` → mobil policy | ✅ |
| FAZA 9.7: app release policy + login gate | ✅ |
| FAZA 9.4–9.5: expeditor/supervisor shell + config | ✅ |
| FAZA 9.6: `device_tokens` + FCM register | ✅ |
| Barcha rollar: lifecycle config refresh | ✅ |
| Veb admin: mobil versiya sozlamalari | ✅ |

---

## Asosiy fayllar

| Qatlam | Yo‘l |
|--------|------|
| Flutter ilova | `mobile/lib/` |
| Auth/bootstrap | `mobile/lib/features/auth/` |
| Rol shell | `mobile/lib/routing/role_guard.dart`, `app_router.dart` |
| Backend API | `backend/src/modules/mobile/` |
| App release | `backend/src/modules/mobile/app-release.service.ts` |
| Agent config | `backend/src/modules/staff/agent-mobile-config*.ts` |
| Veb admin | `frontend/app/(dashboard)/settings/mobile-app/` |
| Verify skript | `mobile/tool/verify.ps1` |

---

## Qo‘lda smoke (ixtiyoriy)

1. `.\start-dev.cmd` + `.\run-mobile.cmd`
2. Login: `test1` / `agent` / seed parol
3. Bootstrap sync tugashi → Agent shell
4. Veb: **Настройки → Мобильное приложение** — versiya siyosati
5. Ekspeditor/supervisor login — tegishli bottom nav

---

*Reja: `.cursor/plans/bitta_ilova_rejasi_audit_b1899fba.plan.md`*
