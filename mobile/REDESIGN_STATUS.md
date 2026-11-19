# Mobil Sa redesign — holat

Oxirgi yangilanish: 2026-11-19  
Branch: `feature/mobile-ui-redesign` → **`main` ga qo‘shilgan** (uyda `git pull` bilan keladi)

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
| Auth entrance (template wave / brand) | done |

## Qayerdamiz

- Redesign UI: **tayyor** (yuqoridagi jadval).
- Git: manba `mobile/` **repo ichida**; uyda yangilash: ildizda `.\uyda-yangilash.cmd` ([docs/UYDA-GIT-SINXRON.md](../docs/UYDA-GIT-SINXRON.md)).
- Agent faza 9.1–9.3: ✅ — [AGENT_REJA_HOLATI.md](./AGENT_REJA_HOLATI.md).
- Keyingi: 9.4–9.6 (ekspeditor / supervayzer / store release) — alohida.

## Lokal ishga tushirish

```powershell
# Tavsiya: monorepo mobile/
cd mobile
flutter pub get
flutter run -d emulator-5554 --android-skip-build-dependency-validation

# Kirill yo‘l muammosi bo‘lsa (ixtiyoriy):
# robocopy E:\sales_copiya\mobile\lib C:\salesdoc_mobile\lib /E
```
