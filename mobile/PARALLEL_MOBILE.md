# Parallel mobil: Legacy + Redesign

| Papka | Maqsad | applicationId |
|-------|--------|---------------|
| `mobile_legacy/` | Kundalik ish (eski) | `uz.salesdoc.salesdoc_mobile.legacy` |
| `mobile/` | Shablon redesign | `uz.salesdoc.salesdoc_mobile` |

Branch: `feature/mobile-ui-redesign` (merge → `main` faqat E2E yashil bo‘lgach).

```powershell
# Eski
cd E:\sales_copiya\mobile_legacy
flutter run -d emulator-5554 --android-skip-build-dependency-validation

# Yangi (Windows: C: nusxa tavsiya)
robocopy E:\sales_copiya\mobile\lib C:\salesdoc_mobile\lib /E
cd C:\salesdoc_mobile
flutter run -d emulator-5554 --android-skip-build-dependency-validation
```

Shablon SSOT: `mobile/design_templates/` (zip dan).
