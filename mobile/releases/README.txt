Mobil APK — veb panelga qo'lda yuklash uchun
============================================

Oxirgi build (3.1.2):
  SalesDoc-latest-release.apk
  SalesDoc-3.1.2-release.apk

Papkalar:
  Kod:     D:\SALEC — копия\mobile
  Build:   C:\salesdoc_mobile
  APK:     D:\SALEC — копия\mobile\releases\

Veb panel: Sozlamalar → Mobil ilova
  https://sales-arena.up.railway.app/settings/mobile-app

Yuklash tartibi:
  1. SalesDoc-latest-release.apk ni tanlang
  2. «APK yuklash» tugmasi
  3. latest_version: 3.1.2
  4. min_version: 3.1.0 (yoki 3.0.0)
  5. force_update: kerak bo'lsa yoqing
  6. release_notes: qisqa tavsif

3.1.2 o'zgarishlar:
  - Buyurtma: dolg / konsignatsiya cheklovlari (mijoz sozlamalari)
  - Aniq ruscha xabarlar agent UI da

Qayta yig'ish:
  deploy-mobile-prod.cmd          — yig'ish + avtomatik serverga yuklash
  mobile\build-apk-railway.cmd  — faqat APK yig'ish (qo'lda yuklash uchun)
