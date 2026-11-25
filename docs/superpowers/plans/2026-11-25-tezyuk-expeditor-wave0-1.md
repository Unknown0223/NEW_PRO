# TezYuk Ekspeditor Wave 0–1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a TezYuk **expeditor-only** Android flavor of `mobile/` with catalog-aligned shell and core screens, reusing existing expeditor APIs (no Ulashish yet).

**Architecture:** Product flavor `tezyuk` (`applicationId` suffix `.tezyuk`, app label TezYuk) beside default `salesdoc`. Compile-time / runtime `AppProduct.tezyuk` gates routing to TezYuk expeditor shell and theme. Wave 1 screens remap existing `features/expeditor/*` UI to Stitch v2 UX without new share backend. Wave 2 (ulashish + web partners) and Wave 3 (agent↔SVR cover) are **separate plans**.

**Tech Stack:** Flutter 3.2+, Riverpod, go_router, existing `expeditor_api` / mobile attendance; Android Gradle flavors; Dart `test`.

**Spec:** `docs/superpowers/specs/2026-11-25-tezyuk-expeditor-app-design.md`

**Status 2026-11-25:** Kod branchda (flavor, theme, home/visits/queue). Review/QA davom etadi. Holat: `2026-11-25-otchot-tezyuk-status-va-etirozlar.md`.

## Global Constraints

- Spec approval: Wave **A** — ship Wave 0–1 first; Ulashish not in this plan.
- Fayl ≤400 LOC; `npm run audit:max-loc`; BE o‘zgarmasa ham `tsc` regression yo‘q.
- Mobil: `cd mobile && dart analyze` / mavjud `flutter test` (yoki `dart test`) taskda ko‘rsatilgan fayl.
- Picker labels: faqat nom.
- Stitch reference: `c:\Users\UNKNOWN\Downloads\stitch_modern_delivery_app_redesign_v2\` (+ Desktop `tezyuk-stitch-katalog-v2.txt`).
- Commit faqat user so‘raganda (steplarda commit ixtiyoriy / skip).
- Asosiy `expeditor_user_id` / ulashish API — bu planda yo‘q.

## Review Focus

- Non-expeditor login on TezYuk flavor → blocked with clear message (not agent shell).
- Default flavor still runs agent/SVR/expeditor as today (no TezYuk-only gate).
- Yetkazish **navbat** screen ≠ mashina qoldig‘i (`/deliveries` stock); routes must not collide.
- Home «Otmetka» chip / sync / next-stop do not crash when attendance or GPS null.
- Role-guard paths for new TezYuk routes remain in `role_guard.expeditor`.

---

### Task 1: TezYuk flavor + product gate

**Files:**
- Modify: `mobile/android/app/build.gradle.kts` — `productFlavors { salesdoc; tezyuk }`
- Create: `mobile/lib/core/config/app_product.dart`
- Modify: `mobile/lib/main.dart` (read `--dart-define=APP_PRODUCT=tezyuk` or flavor)
- Modify: `mobile/lib/routing/role_guard.dart` / login redirect path used after auth
- Test: `mobile/test/unit/app_product_gate_test.dart`

**Interfaces:**
- Produces:
  - `enum AppProduct { salesdoc, tezyuk }`
  - `AppProduct parseAppProduct(String? raw)` — default `salesdoc`; `tezyuk` when define/flavor says so
  - `bool tezyukAllowsRole(String role)` — only `expeditor` when product is tezyuk
  - Android: `applicationId = "uz.salesdoc.salesdoc_mobile.tezyuk"` for tezyuk flavor; `resValue` app_name `TezYuk`

- [ ] **Step 1: Write the failing test**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:salesdoc_mobile/core/config/app_product.dart';

void main() {
  test('parseAppProduct defaults to salesdoc', () {
    expect(parseAppProduct(null), AppProduct.salesdoc);
  });
  test('tezyukAllowsRole only expeditor', () {
    expect(tezyukAllowsRole('expeditor'), isTrue);
    expect(tezyukAllowsRole('agent'), isFalse);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && dart test test/unit/app_product_gate_test.dart`  
Expected: FAIL (library missing)

- [ ] **Step 3: Implement `app_product.dart` + gradle flavors + gate after login**

Wire define `APP_PRODUCT` from gradle `tezyuk` flavor. After session load, if `AppProduct.tezyuk && role != expeditor` → logout/error route (reuse existing toast/error pattern).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && dart test test/unit/app_product_gate_test.dart`  
Expected: PASS

- [ ] **Step 5: Commit** — skip unless user asks

---

### Task 2: TezYuk theme tokens + shell nav

**Files:**
- Create: `mobile/lib/core/theme/tezyuk_colors.dart`
- Create: `mobile/lib/core/theme/tezyuk_theme.dart`
- Modify: `mobile/lib/core/theme/app_theme.dart` (select theme by `AppProduct`)
- Modify: `mobile/lib/routing/app_router.dart` — Tezyuk bottom nav labels/paths per catalog: Bosh / Tashriflar / Qarzdorlar / Yukxatlar (and Yetkazish entry from home/profile as in Stitch, without breaking stock route)
- Test: `mobile/test/unit/tezyuk_theme_test.dart`

**Interfaces:**
- Produces:
  - `TezyukColors.primary == Color(0xFF0A6B3D)`
  - `TezyukColors.background == Color(0xFFEDF3F7)`
  - `ThemeData buildTezyukTheme()`
  - When `AppProduct.tezyuk`, MaterialApp uses `buildTezyukTheme()`

- [ ] **Step 1: Failing test** — assert primary/background constants

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement colors + theme + wire MaterialApp; TezYuk nav item labels in o‘zbek (katalog)**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 3: Bosh sahifa (katalog)

**Files:**
- Modify: `mobile/lib/features/expeditor/home/expeditor_home_page.dart` (split sheets if >400 LOC)
- Modify: `mobile/lib/features/expeditor/home/expeditor_home_sheets.dart` / `expeditor_sync_sheet.dart` as needed
- Test: `mobile/test/unit/expeditor_home_model_test.dart` (pure mapping for KPI chips / next-stop null-safe)

**Interfaces:**
- Consumes: existing `expeditorDashboardProvider` / home stats providers
- Produces: UI blocks matching katalog: otmetka chip, kunlik reja %, keyingi manzil, to‘lovlar pending, yuklar hisoboti tabs — **null-safe** when fields missing

- [ ] **Step 1: Failing test** — `mapHomeOtmetkaChip(null)` → hidden/empty; non-null → label contains Keldi/time pattern used in UI helper

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Extract pure helpers + restyle home for TezYuk (gate UI polish behind `AppProduct.tezyuk` if salesdoc must stay RU chrome)**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 4: Tashriflar + Yetkazish navbati

**Files:**
- Modify: `mobile/lib/features/expeditor/visits/expeditor_visits_page.dart`
- Create: `mobile/lib/features/expeditor/queue/expeditor_delivery_queue_page.dart`
- Modify: `mobile/lib/routing/app_router.dart` + `role_guard.dart` — e.g. path `/exp-queue` for navbat; keep `/deliveries` as stock
- Test: `mobile/test/unit/expeditor_delivery_queue_filter_test.dart`

**Interfaces:**
- Produces:
  - `List<Map> filterQueueRows(List<Map> rows, String tab)` — tabs: `all` | `pending` | `delivered` | `return`
  - Route `/exp-queue` → `ExpeditorDeliveryQueuePage`
  - Visits: katalog filter chips Hammasi / Kutilmoqda / Bajarildi / Qarzli / Qaytarish when TezYuk

- [ ] **Step 1: Failing test** for `filterQueueRows`

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement filter + queue page wired to existing deliveries/orders list API; visits filter chips**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 5: Qarzdorlar / to‘lovlar / yukxatlar / qoldiq

**Files:**
- Modify: `mobile/lib/features/expeditor/debtors/*`, `payments/*`, `invoices/*`, `deliveries/expeditor_deliveries_page.dart`
- Test: `mobile/test/unit/expeditor_stock_summary_test.dart` — Yuklangan/Yetkazildi/Qoldi triad from row fields; m³ optional null → omit

**Interfaces:**
- Produces: `StockTriad summarizeStock(Iterable<Map> rows) → ({loaded, delivered, remaining})`
- TezYuk copy/layout only; APIs unchanged

- [ ] **Step 1–4:** TDD `summarizeStock`; restyle list pages for TezYuk; invoices tabs keep shipping/return

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 6: Mijoz vizit 3 bosqich + chornovik + tabel/Face

**Files:**
- Modify: `mobile/lib/features/expeditor/visits/expeditor_client_detail_page.dart` (split if needed)
- Modify: `mobile/lib/features/expeditor/visits/expeditor_unfinished_page.dart`
- Modify / reuse: attendance screens under `mobile/lib/features/attendance/*` entry from TezYuk profil/tabel
- Test: `mobile/test/unit/expeditor_visit_step_gate_test.dart`

**Interfaces:**
- Produces: `enum VisitUiStep { visit, photo, statusPayment }` + `VisitUiStep nextStep({required bool visitStarted, required bool photoOk})` — foto locked until visit started (katalog)

- [ ] **Step 1–4:** TDD step gate; wire client detail stepper for TezYuk; unfinished + attendance entry points from profil

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 7: Profil, qaytarishlar (3 tur), to‘lovni o‘zgartirish

**Files:**
- Modify: `mobile/lib/features/expeditor/settings/expeditor_settings_page.dart` / drawer → profil shortcuts (Ulashish bandi: **«Tez orada»** disabled until Wave 2)
- Modify: `mobile/lib/features/expeditor/returns/*` — align tabs Po zakaz / To‘liq / Qisman to katalog where API allows; missing bonus/peresort UI → stub + TODO only if API lacks fields (YAGNI: hide controls without API)
- Modify: `mobile/lib/features/expeditor/payments/*` — cashier-returned payment edit timer screen if API exists; else read-only list + test skip documented in task notes
- Test: `mobile/test/unit/expeditor_profile_shortcuts_test.dart` — Ulashish shortcut `enabled: false` on Wave 1

**Interfaces:**
- Produces: `ProfileShortcut ulashishShortcutWave1()` → `enabled: false`, badge `Tez orada` / faol count hidden

- [ ] **Step 1–4:** TDD shortcut; wire profil; returns/payment-edit best-effort against existing APIs

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 8: Wave 0–1 quality gate

**Files:** none new required

- [ ] **Step 1: Run** `cd mobile && dart test test/unit/app_product_gate_test.dart test/unit/tezyuk_theme_test.dart test/unit/expeditor_home_model_test.dart test/unit/expeditor_delivery_queue_filter_test.dart test/unit/expeditor_stock_summary_test.dart test/unit/expeditor_visit_step_gate_test.dart test/unit/expeditor_profile_shortcuts_test.dart`  
  Expected: all PASS

- [ ] **Step 2: Run** `cd mobile && dart analyze lib/core/config/app_product.dart lib/core/theme/tezyuk_colors.dart lib/core/theme/tezyuk_theme.dart`  
  Expected: no errors

- [ ] **Step 3: Run** `npm run audit:max-loc` from repo root  
  Expected: PASS (split any >400 files touched)

- [ ] **Step 4: Manual smoke note** — document in PR/description: `flutter run --flavor tezyuk --dart-define=APP_PRODUCT=tezyuk` login as expeditor → home; agent login rejected

- [ ] **Step 5: Commit** — skip unless asked

---

## Out of this plan (next specs/plans)

- **Wave 2:** Ulashish BE + 7 mobil ekran + web partnyorlar + Vitest state machine  
- **Wave 3:** Agent↔SVR cover + payroll exclude  
- Faza B: extract `mobile_expeditor/` standalone app

## Spec coverage (self-check)

| Spec item | Task |
|-----------|------|
| Flavor + alohida app id | T1 |
| TezYuk theme | T2 |
| Expeditor-only gate | T1 |
| Katalog bosh | T3 |
| Tashriflar/xarita filters | T4 |
| Yetkazish navbati ≠ stock | T4 |
| To‘lov/qarzdor/yukxat/qoldiq | T5 |
| Vizit 3 bosqich, chornovik, tabel | T6 |
| Profil, qaytarish, to‘lov edit | T7 |
| Tests + quality | T1–T8 |
| Ulashish / cover / web partners | Out → Wave 2/3 |
