# FAZA 9.8 — Play Market va App Store (kelajak)

## Hozirgi model (Telegram APK)

- Admin: **Настройки → Mobil ilova** — `download_url` (APK havolasi)
- Mobil: majburiy/ixtiyoriy dialog → brauzer orqali APK yuklab olish

## Store modeli

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
