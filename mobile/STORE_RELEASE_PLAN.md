# FAZA 9.8 — Play Market va App Store (kelajak)

## Hozirgi model (server OTA)

- Admin: **Настройки → Mobil ilova** — APK ni serverga yuklash, `latest_version` / `min_version` / `force_update`
- APK URL: `/api/mobile/apk-download?slug=...` (Telegram o‘rniga)
- Mobil: majburiy/ixtiyoriy dialog → **ilova ichida** yuklab o‘rnatish (PIN, kesh, offline ma’lumot saqlanadi)
- Deploy: `deploy-mobile-prod.cmd` yoki `scripts/railway/upload-mobile-apk-prod.ps1`

## Store modeli (kelajak)

| Platform | Havola maydoni | Mobil xatti-harakat |
|----------|----------------|---------------------|
| Android | `store_url_android` | Play Store deep link; kelajakda `in_app_update` paketi |
| iOS | `store_url_ios` | App Store deep link (OTA APK mumkin emas) |

## In-App Update (Android, kelajak)

```yaml
# mobile/pubspec.yaml — keyin qo‘shiladi
dependencies:
  in_app_update: ^4.2.0
```

Mantiq: `app_update.optional == true` va Play Store o‘rnatilgan bo‘lsa — flexible update; `required` — immediate update.

## CI/CD

- Android: `flutter build appbundle` → Play Console
- iOS: `flutter build ipa` → TestFlight / App Store Connect

Server versiya siyosati o‘zgarmaydi — faqat `url` manbai Play/App Store ga o‘tadi.
