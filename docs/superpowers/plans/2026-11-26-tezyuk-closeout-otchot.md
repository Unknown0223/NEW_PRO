# TezYuk close-out (2026-11-26)

## Parallel mahsulot qoidasi

- **Ishlab turgan SalesDoc mobil** (`uz.salesdoc.salesdoc_mobile`, `APP_PRODUCT=salesdoc`) — tegilmaydi / almashtirilmaydi.
- **TezYuk** (`…tezyuk`, `APP_PRODUCT=tezyuk`) — parallel test APK; ulashish/partnyor shu flavorda.

## Yopilgan (repo + prod)

| Band | Holat | Asosiy yo‘llar |
|------|--------|----------------|
| Share return/reload gates | Done | `share-guard.ts`, return/reload paths |
| Share return-flow API+UI | Done | return-request/accept + mobil |
| Handoff camera + **storage upload** | Done | `handoff-photo` + `share-handoff-photo.service.ts`; `capture:` rad |
| SHARE_* notify | Done | `share-notify.ts` |
| Web partnyorlar + **nav** | Done | `/settings/expeditor-partners` — menyu: **Пользователи → КОМАНДА → Ulashish partnyorlari** (`nav-config.ts`) |
| Unique index SQL | Done **prod** | `20261126103000_…` (finished 2026-11-26 08:42 UTC) |
| Return copy / contract tests | Done | |
| Wave 3 cover MVP A | Done | pure state/eligibility, `agent_svr_covers`, mobile routes+banner, payroll hook |
| Cover UI **nomlar** (picker-labels) | Done | `agent_name`/`svr_name` API + Flutter label helpers |
| Cover agent **mutation block** | Done | `assertAgentNotUnderActiveCover` → orders/clients → `COVER_AGENT_BLOCKED` |
| Cover Face ID (dual, soft-bypass yo‘q) | Done | `cover_accept` soft-pass yo‘q; `markFace(true)` faqat recent approved `face_verification_logs` |
| Cover SVR «agent sifatida» (scope remap) | Done | `resolveCoverRouteScope` — faol coverda SVR → agent scope (config/orders/clients); JWT impersonation yo‘q |
| Ulashish recipients + list names | Done | `GET …/share/recipients`, list names |
| Ulashish lokal API smoke | Done | `scripts/local/ulashish-api-smoke.ps1` (37 backend + 3 FE) |
| Stitch Task 4 | Done (best-effort) | TezYuk chrome + name labels |
| Prod backend deploy | Done 2026-11-26 | `deploy.ps1 -SkipBot -SkipFrontend` → BUILD_UP_OK, API health ok |
| Prod migrate cover | Done 2026-11-26 | `20261126120000_agent_svr_cover` applied; table `agent_svr_covers` |
| Prod frontend deploy | Done 2026-11-26 | `deploy.ps1 -SkipBot -SkipBackend` → DEPLOY YAKUNLANDI |
| Deploy unblock (VisitsDetailFilters) | Done | `reports.route.visits.ts` → `visits-report.types` |

## Bloklangan / qisman

- **Qurilmada Ulashish E2E** — 2× TezYuk qurilma yo‘q; API smoke yashil. Checklist:
  1) Web `/settings/expeditor-partners`
  2) A: Ulashish → Yangi → zakaz + qabulchi nomi
  3) B: qabul → handoff kamera+GPS
  4) return-request / return-accept
- FE `lint:errors` ba’zan boshqa yo‘qolgan test fayliga uriladi (ushbu diff emas)

## Tekshirish

```bash
cd backend && npx tsc -p tsconfig.json --noEmit
cd backend && npx vitest run tests/cover-acting.pure.test.ts tests/cover-face-required.pure.test.ts tests/cover-routes.contract.test.ts tests/cover-state.pure.test.ts tests/cover-eligibility.pure.test.ts tests/cover-display.pure.test.ts tests/cover-guard.pure.test.ts tests/payroll-cover.pure.test.ts tests/payroll-cover-hook.contract.test.ts tests/share-recipients.pure.test.ts tests/share-recipients.route.contract.test.ts
npm run audit:max-loc
cd mobile && flutter test test/unit/cover_models_test.dart test/unit/share_models_test.dart
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local/ulashish-api-smoke.ps1
```
