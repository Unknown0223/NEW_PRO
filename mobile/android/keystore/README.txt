Sales Arena OTA signing key (FIXED)

Fayl: salesdoc-ota.jks
Alias: androiddebugkey
SHA-1: 21:FC:31:48:B4:9A:89:28:A2:C2:F0:4F:6E:DB:A8:CF:36:A8:F8:82

Qoida:
- Bu kalit REPO ichida saqlanadi — PC o‘zgarsa ham NUSXA olinadi (git clone/pull).
- pubspec versiya, kod, UI — o‘zgaraversin.
- salesdoc-ota.jks NI QAYTA YARATISH / ALMASHTIRISH MUMKIN EMAS
  (aks holda telefonda «boshqa kalit» — o‘chirib qayta o‘rnatish kerak).
- Debug va release HAM shu jks dan imzolanadi (flutter run = OTA).

Tekshirish:
  scripts/verify-ota-signing.ps1
  yoki: keytool -list -v -keystore keystore/salesdoc-ota.jks -storepass android -alias androiddebugkey
