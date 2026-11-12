# Mobil Sa redesign — holat

Oxirgi yangilanish: 2026-11-12 (zip shablon 0 dan)

## Shablon manbasi

Zip: `mobile-app-redesign-templates (2).zip`  
Nusxa: `mobile/design_templates/` (React prototip)  
Flutter kit: `mobile/lib/design_system/` + `assets/design/catalog.json`

## Qilingan (shu tur)

- Design system shablon FlutterKit dan qayta qo‘yildi (`SaEnter`/`SaPressable` saqlandi)
- Rol aksentlari prototip `design.ts` ga mos:
  - Agent Iris `#5548F0`
  - Ekspeditor Lime `#4ADE80`
  - Supervayzer Sky `#0369A1`
  - Kassir Fuchsia `#C026D3`
- Agent pastki nav olib tashlandi (PhoneFrame: GlobalChrome + drawer/tezkor)
- `AgentHomeDashboard` — shablon HomeDashboard layout
- **Motion:** `SaMotionLevel.full` default; emulator `disableAnimations` yengiladi; Auth launch-zoom + BrandWave + BrandMark draw; page slide; au-in curve `.16,1,.3,1`

## Keyingi (davom)

- Login/PIN → AuthScreen + BrandWave
- GlobalChrome top bar (SalesArena wordmark)
- Visits / Clients / Order flow ekranlari
- Expeditor / Supervisor / Kassir shell

## Ishga tushirish

```powershell
robocopy e:\sales_copiya\mobile\lib C:\salesdoc_mobile\lib /E
robocopy e:\sales_copiya\mobile\assets C:\salesdoc_mobile\assets /E
cd C:\salesdoc_mobile
adb reverse tcp:18080 tcp:18080
flutter run -d emulator-5554 --android-skip-build-dependency-validation
```

Login: `test1` / `agent` / `111111`, PIN `1234`
