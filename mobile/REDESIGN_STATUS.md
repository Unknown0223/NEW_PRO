# Mobil Sa redesign — holat (uyda davom)

Oxirgi yangilanish: 2026-11-11

## Qilingan

- Sa design system: `lib/design_system/` (tokens, theme, SaEnter/Stagger/Press/PopIn/CountUp/…)
- Shablon katalog: `assets/design/catalog.json`
- Tezkor panel (bottom nav saqlanadi): sheet + sozlamalar customize
- Login / PIN / home / sheet / button motion ulangan
- ANR yumshatish: home og‘ir provayder kechiktirish, FCM/GPS kechiktirish, LivePulse o‘rniga static nuqta, Impeller off
- Katalog list/grid (`catalogViewMode`), mahsulot rasmlari thumb
- Role guard: `/settings/quick`, `/bonuses`
- Emulyator smoke: home, vizitlar, buyurtmalar, tezkor panel, sozlamalar customize, katalog grid, «Буш полка» foto, Мои бонусы

## Ishga tushirish (uy)

```text
# Manba: e:\sales_copiya\mobile  (yoki clone)
# Ishchi nusxa (Windows tez disk): C:\salesdoc_mobile  — ixtiyoriy robocopy
```

```powershell
cd mobile   # yoki C:\salesdoc_mobile
adb reverse tcp:18080 tcp:18080
flutter run -d emulator-5554 --android-skip-build-dependency-validation
```

Login: slug `test1`, login `agent`, parol `111111`, PIN `1234`  
API lokal: `10.0.2.2:18080` (`.env.local`)

## Keyingi navbat

| # | Vazifa | Izoh |
|---|---|---|
| 1 | Seed agent mijozlari | Sync hozir `clients=0`, `products=5` — katalog to‘liq test uchun DB/seed |
| 2 | Sahifa-sahifa visual parity | Shablon vs agent: KPI, marshrut, xarita, drawer |
| 3 | Rasm / bonus / shelf-return UX | Foto oqimi ishladi; bonus ladder UI chuqurroq |
| 4 | ANR stress | Emulyatorda uiautomator dump + og‘ir sync hali nozik |
| 5 | C: drive sync | O‘zgarishdan keyin `robocopy mobile\lib C:\salesdoc_mobile\lib /E` |

## Asosiy fayllar

- `lib/design_system/**`
- `lib/core/ui/quick_panel_sheet.dart`
- `lib/features/agent/misc/quick_panel_settings_page.dart`
- `lib/features/agent/home/agent_home_page.dart`
- `lib/features/auth/auth_provider.dart`, `login_screen.dart`, `pin_unlock_screen.dart`
- `lib/routing/role_guard.dart`, `app_router.dart`
- `lib/core/theme/app_theme.dart`, `app_colors.dart`
