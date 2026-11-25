# TezYuk UI Katalog 1:1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TezYuk flavor UI ni Stitch v2 katalog bilan 1:1 qilish; auth/motion saqlash; Ulashish va qo‘shimchalar ishlaydigan holatda; emulyatorda smoke.

**Architecture:** `isTezyukProduct` orqali parallel UI: SalesDoc o‘zgarmaydi. Theme tokens + shared TezYuk widgets; har ekran Stitch HTML strukturasiga mos ConsumerWidget. Ma’lumot mavjud expeditor providers/API dan.

**Tech Stack:** Flutter, Riverpod, go_router, Material 3, google_fonts (ixtiyoriy).

**Spec:** `docs/superpowers/specs/2026-11-25-tezyuk-ui-katalog-1to1-design.md`

## Global Constraints

- Faqat TezYuk flavor vizual o‘zgaradi.
- Login, Face ID, BrandSync motion tegilmaydi (rang moslash OK).
- Null-safe: API maydoni yo‘q → bo‘sh/yashirin, soxta raqam yo‘q.
- Commit yo‘q (so‘ralmaguncha).
- Build/run: `C:\salesdoc_mobile` sync.

## Review Focus

- Bosh ochilganda ruscha «Главная» qolmasin.
- SalesDoc flavor regression yo‘q.
- Sync tugmasi BrandSync overlay ni ochadi.
- Bottom nav 4 ta katalog yorlig‘i.

---

### Task 1: Theme chrome + tipografiya

**Files:**
- Modify: `mobile/lib/core/theme/tezyuk_colors.dart`
- Modify: `mobile/lib/core/theme/tezyuk_theme.dart`
- Create: `mobile/lib/core/theme/tezyuk_typography.dart` (ixtiyoriy)
- Modify: `mobile/pubspec.yaml` — `google_fonts` agar yo‘q
- Test: `mobile/test/unit/tezyuk_theme_test.dart`

- [ ] Step 1: To‘liq color tokens (success/warning containers, outline-variant, surface-bright)
- [ ] Step 2: ThemeData — Card border `#E2E8F0`, radius 12, scaffold `#EDF3F7`, AppBar title style
- [ ] Step 3: `dart test test/unit/tezyuk_theme_test.dart`

### Task 2: Bosh sahifa `kuryer_bosh_ekrani`

**Files:**
- Create: `mobile/lib/features/expeditor/home/tezyuk_home_page.dart` (yoki widgets split ≤400 loc)
- Modify: `mobile/lib/features/expeditor/home/expeditor_home_page.dart` — TezYukda yangi UI
- Modify: `mobile/lib/features/expeditor/home/expeditor_home_model.dart` — next stop sum/items
- Test: `mobile/test/unit/expeditor_home_model_test.dart`

- [ ] Step 1: Expand model (collected money, order counts, report summary null-safe)
- [ ] Step 2: Build Stitch layout: app bar, otmetka strip, kunlik reja hero, tiles, next stop, payments, yuklar tabs
- [ ] Step 3: Wire sync + payments sheet + tabel navigation
- [ ] Step 4: Unit tests + hot reload smoke

### Task 3: Tashriflar + Yetkazish + To‘lovlar/Qarzdorlar + Yukxatlar

**Files:** tegishli `visits/`, `queue/`, `payments/`, `debtors/`, `invoices/` — TezYuk restyle gate

- [ ] Step 1–4: Har biri katalog filter chips, o‘zbek labels, card chrome

### Task 4: Vizit detail, profil, qaytarish, tabel, Ulashish polish

**Files:** `visits/expeditor_client_detail_page.dart`, `settings/`, `returns/`, `share/`

- [ ] Step 1–4: Katalog struktura + mavjud API

### Task 5: Sync + emulator verification

- [ ] Step 1: Sync `E:\sales_copiya\mobile` → `C:\salesdoc_mobile`
- [ ] Step 2: `flutter run --flavor tezyuk ...` hot restart
- [ ] Step 3: Screenshot / foydalanuvchiga ko‘rsatish
