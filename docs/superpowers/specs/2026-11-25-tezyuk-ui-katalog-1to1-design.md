# TezYuk UI — Stitch katalog 1:1

**Date:** 2026-11-25  
**Status:** approved by user intent («shablon katalogdagidek 1:1», «qoshimchalarni ham qoshib», dive-in /using-superpowers)  
**Manba:** `C:\Users\UNKNOWN\Downloads\stitch_modern_delivery_app_redesign_v2\` + Wave2 Ulashish

## Intent / why

Emulyatorda ochilgan TezYuk hali SalesDoc ruscha chrome. Foydalanuvchi bergan Stitch shablon bilan **vizual va struktura 1:1**; autentifikatsiya va mavjud motion (BrandSync, Face ID oqimi, notif wave) **saqlanadi**. Ulashish va boshqa qo‘shimchalar katalogga mos holda to‘liq ishlashi kerak.

## Goals

- TezYuk flavorda barcha asosiy ekspeditor ekranlar Stitch layout/copy/rangga mos.
- Design system: primary `#0A6B3D`, fon `#EDF3F7`, kartalar oq + `#E2E8F0` border, radius 12/16.
- Bottom nav: Bosh / Tashriflar / Qarzdorlar / Yukxatlar (katalog).
- Qo‘shimchalar (Ulashish, navbat, qaytarish, to‘lov edit) katalog ekranlari bilan bir xil chrome.
- Smoke: login → Bosh → asosiy tablar; hot restart emulyatorda ko‘rsatish.

## Non-goals

- SalesDoc flavor UI ni o‘zgartirish.
- Login / Face ID / BrandSync animatsiyasini qayta yozish (faqat TezYuk ranglariga moslash mumkin).
- Stitch HTML ni WebView orqali yuklash.
- Commit/deploy — so‘ralmaguncha.

## Anti-goals

- Faqat theme tokenlari bilan «tayyor» deb yopish.
- API yo‘q maydonlarni soxta ma’lumot bilan to‘ldirish (null-safe bo‘sh holat).

## Constraints

- Gate: `isTezyukProduct` / `AppProduct.tezyuk`.
- Sync build: `C:\salesdoc_mobile` (E: JVM OOM).
- Fontlar: google_fonts yoki yaqin system fallback (Space Grotesk / Geist yo‘q bo‘lsa).
- Picker labels qoidasi.

## Approaches

| # | Yondashuv | Trade-off |
|---|-----------|-----------|
| 1 | Avval chrome + Bosh 1:1, keyin ekran-ma-ekran | Tez ko‘rinadigan farq; tavsiya |
| 2 | Faqat ekran-ma-ekran | Birinchi ochilishda hali eski |
| 3 | HTML WebView | Spec anti-goal |

**Tanlov:** 1 (oldingi suhbat + ushbu buyruq).

## Builder calls

- Font: `google_fonts` Space Grotesk + Inter/Geist-yaqin; yuklanmasa system.
- Yetkazish tab: katalog ba’zi ekranlarda 5-tab — asosiy 4-tab saqlanadi; Yetkazish drawer/profile shortcut orqali.
- Hisobot tablar: API maydonlari bo‘lsa map; yo‘q bo‘lsa bo‘sh panel.
