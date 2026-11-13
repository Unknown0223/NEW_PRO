# Mobil Sa redesign — holat

Oxirgi yangilanish: 2026-11-13  
Branch: `feature/mobile-ui-redesign`

## Holat

| Ekran | Holat |
|-------|-------|
| Auth / PIN / RoleWelcome / Sync | done |
| GlobalChrome (barcha AgentAppBar) | done |
| Home / Drawer | partial→done |
| Mening buyurtmalarim | done (chip + kartalar) |
| **Kunlik reja** | done (progress + timeline + CTA) |
| Xarita / KPI | done (overflow + o‘zbek) |
| Vizit / Mijoz / Hisobot / Qarz / Ombor / Sozlama / Tabel | o‘zbek matnlar |
| `S` (app_strings) | o‘zbekcha SSOT |

## Merge

`main` ga — E2E exp/sv yashil bo‘lguncha **yo‘q**.

```powershell
robocopy E:\sales_copiya\mobile\lib C:\salesdoc_mobile\lib /E
cd C:\salesdoc_mobile
flutter run -d emulator-5554 --android-skip-build-dependency-validation
```
