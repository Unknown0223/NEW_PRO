# SALEC — domain glossary

Domain terms for seams and modules. Architecture nouns (`module`, `interface`, `seam`, `adapter`, `depth`) live in the codebase-design vocabulary — not here.

## Client Balance (mijoz balansi)

| Term | Meaning |
|------|---------|
| **Client Balance** | Tenant + client bo‘yicha bitta ledger qoldiq (`client_balances.balance`). Polarity: to‘lov odatda balansni oshiradi; `client_expense` kamaytiradi. UI da «manfiy = qarz» ko‘rsatish qoidalari **o‘qish** tomonda (ClientBalanceDisplay), yozuvda emas. |
| **Client Balance Movement** | `client_balance_movements` qatori — har bir `applyDelta` bilan birga yoziladigan audit delta (`delta`, `note`, `user_id`). |
| **ClientBalanceMutator** | Mijoz balansi **yozuv** moduli (ikki qavat). Fayl: `backend/src/modules/client-balances/client-balance-mutator.ts`. O‘qish (card_net, merged ledger) bu modul emas. |
| **applyDelta** | Past yadro **interface**: `applyDelta(tx, { tenantId, clientId, delta, note?, userId? })`. Mavjud `tx` ichida qatorni qulflash (FOR UPDATE) → balansni `delta` ga yangilash → movement yozish. **movementKind yo‘q** — tur `note` matnida (joriy amaliyot); `ClientBalanceMovement` schema o‘zgarmaydi. Sign, pending, expense qoidalari **tashqarida**. |
| **Payment balance adapters** | Yuqori qavat (faqat payments): fayl `payment-balance.adapters.ts`. `postConfirmedPaymentAmount`, `reversePayment`, `postExpense` — delta ni hisoblab `applyDelta` chaqiradi. `pending_confirmation` / `rejected` uchun reverse **skip** (`null`). Summa tahriri: `deltaForPaymentAmountEdit` + to‘g‘ridan `applyDelta`. |
| **Pending skip** | `workflow_status` ∈ {`pending_confirmation`, `rejected`} — balans hech qachon post bo‘lmagan; void/reject da `applyDelta` chaqirilmasligi payments adapter zimmasida. |

### ClientBalanceMutator — kelishuv (2026-11-19)

- **Qavatlar:** past `applyDelta`; yuqori faqat payments (`postConfirmedPaymentAmount` / `reversePayment` / `postExpense`).
- **Chaqiruv:** returns, opening-balances, manual adjust → to‘g‘ridan `applyDelta`.
- **Migratsiya (M1):** ✅ yopildi — applyDelta → `addClientBalanceMovement` → payments adapters → returns → opening-balances (legacy void/restore).
- **Test (T2):** applyDelta integration + adapter pure (sign/pending) + bitta payment oqim integration; call site upsert assert yo‘q.
- **Hujjat:** `docs/adr/ADR-005-client-balance-mutator.md`.

## ClientBalanceDisplay (o‘qish)

| Term | Meaning |
|------|---------|
| **ClientBalanceDisplay / ClientBalanceView** | Mijoz balansi **o‘qish** moduli. Yozuv (`ClientBalanceMutator`) bilan aralashtirilmasin. FE `ClientBalanceViewMode` (clients/agents/… hisobot tab) — **boshqa** tushuncha. |
| **card_net** | Ledger card net (to‘lov/zakaz asosidagi net). |
| **ledger_merged** | Ledger + to‘lanmagan yetkazilgan (`mergeLedgerWithUnpaidDelivered`). Ko‘pincha API `account_balance`. |
| **loadClientBalanceView** | Deep o‘qish **interface**: `loadClientBalanceView(tenantId, clientIds, mode, opts?)`. `mode: "card_net" \| "ledger_merged"`; `asOfEnd` null = cheksiz/joriy. Delegate: card_net → `loadLedgerCardNetByClient`; merged → ledger + `mergeLedgerWithUnpaidDelivered`. |

### ClientBalanceDisplay — kelishuv (grill, 2026-11-19)

- **Kind:** faqat `card_net` | `ledger_merged` (Minimal / A).
- **asOfEnd:** opts; alohida kind emas.
- **raw_row:** public interface’da yo‘q.
- **Migratsiya (M1 — Debt gate birinchi):**
  1. `loadClientBalanceView` stub → deep ✅
  2. orders (create / debt gate / detail-finance) + mobile finance ✅ (`ledger_merged`)
  3. clients detail/list + ledger get ✅ (`ledger_merged`)
  4. payments list enrich ✅ (`card_net`)
  5. reports / consignment / returns filter ✅ (reports/consignment `card_net`, returns filter `ledger_merged`)
- **M1 checklist yopildi** — kelishilgan call site’lar `loadClientBalanceView` orqali; tg/mobile deliver kabi qoldiqlar keyinroq.
- **Frontend (F1):** Backend-only deepen. FE o‘zgarmaydi; `account_balance` / `ledger_net_balance` API dan. FE ClientLedger seamni to‘g‘ridan chaqirmaydi (faqat HTTP). Polarity/merge faqat backendda.
- **Fayl (P1):** `backend/src/modules/client-balances/client-balance-view.ts` stub chuqurlashadi (o‘chirilmaydi). Ichki SQL → mavjud `ledger` / `delivery` delegate.
- **Hujjat:** `docs/adr/ADR-006-client-balance-display.md`.

## StockReservation (ombor bron)

| Term | Meaning |
|------|---------|
| **Stock row** | Ombor × tovar qatori (`stock`): jismoniy `qty` va `reserved_qty`. |
| **Available** | Bron qilinmagan qoldiq: `max(0, qty − max(0, reserved_qty))`. |
| **StockReservation** | Stock moduli ichidagi **yozuv/assert** seami. Orders va transfers faqat thin adapter. |
| **reserve** | Available yetarli bo‘lsa `reserved_qty` oshirish (ichida FOR UPDATE). |
| **release** | Bronni kamaytirish (`reserved_qty` pastga, clamp ≥ 0; ichida FOR UPDATE). |
| **consume** | Tasdiqlash: `qty` va `reserved_qty` ni birga kamaytirish (ichida FOR UPDATE). |
| **assertAvailable** | Yozuvsiz tekshiruv: needMap uchun available yetarlimi. |
| **loadAvailableByProduct** | Yozuvsiz o‘qish: productId → Available (bonus soft-cap va boshqa o‘qishlar). |
| **lock** | `SELECT … FOR UPDATE` — faqat modul **ichida**; public interface emas. |

### StockReservation — kelishuv (grill, 2026-11-19)

- **Interface:** `reserve` / `release` / `consume` + `assertAvailable` (A); `loadAvailableByProduct` o‘qish yordamchisi.
- **lock** public emas; har bir `reserve` / `release` / `consume` ichida majburiy FOR UPDATE.
- **Fayl (P1):** `backend/src/modules/stock/stock-reservation.ts`; `stock.service` re-export qilishi mumkin.
- **create-tx.stock:** stock hop yo‘qoladi — orders thin adapter (line→needMap) + `reserve`.
- **Migratsiya (M1 — yozuv birinchi):**
  1. `stock-reservation.ts` deep + test (T2) ✅ (2026-11-19)
  2. orders: create → lines edit → lifecycle (`cancelled → new` ham `reserve()`) ✅ (2026-11-19)
  3. transfers `assertAvailable` ✅ (2026-11-19)
  4. bonus-cap / adjustment assert ✅ (2026-11-19)
- **M1 checklist yopildi** (2026-11-19).
- **Frontend (F1):** Backend-only; FE `qty`/`reserved`/`available` formulasi o‘zgarmaydi.
- **Test (T2):** reserve/release/consume/assertAvailable + race ✅; orders create + cancelled→new ✅; transfers + bonus-cap/adjustment ✅. Call site’da qayta SQL/available assert yo‘q.
- **Hujjat:** `docs/adr/ADR-007-stock-reservation.md`.
- **Grill yopildi** (2026-11-19).

## OrderCreate (FE zakaz yaratish)

Zakaz yaratish/tahrirlash workspace: `frontend/components/orders/order-create/`. God-hook → uchta deep module + thin composer.

| Term | Meaning |
|------|---------|
| **OrderCreate workspace** | FE ekran: ordinary create/edit + Polki (полки) shelf-return. |
| **OrderCreateVm** | View ga beriladigan tekis VM; thin `useOrderCreate` composer yig‘adi. |
| **OrderCreateDraft** | Deep module: ordinary/exchange/edit — header, qatorlar, stock/qty, submit base (Polki emas). |
| **PolkiReturnPolicy** | Deep module: shelf-return — mode, order pick, composition/rebalance, peresort, polki grid. |
| **OrderCreateBonusDebt** | Deep module: bonus preview/confirm + debt summalari. Backend `ClientBalanceMutator` emas. |
| **Polki (shelf return)** | «Возврат с полки» oqimi: by_order / free. |
| **Orphan OrderCreateContext** | `context/order-create-context.tsx` — ishlatilmaydi; **o‘chiriladi** (M1.1). |
| **Order status label (SSOT)** | `frontend/lib/order-status.ts` `ORDER_STATUS_LABELS`. Create map o‘chadi; `orderStatusLabelRu` delegat. |

### OrderCreate — kelishuv (grill, 2026-11-19)

- **Topologiya:** `OrderCreateDraft` + `PolkiReturnPolicy` + `OrderCreateBonusDebt`.
- **Interface:** har module `useX()` + ichki pure; public API = hook return shape.
- **Thin view:** `useOrderCreate` composer → tekis `OrderCreateVm`; view deyarli o‘zgarmaydi.
- **Fayl:** `order-create/draft/`, `polki-policy/`, `bonus-debt/`; composer `hooks/use-order-create.ts`.
- **Orphan context:** o‘chirish.
- **Status SSOT:** `lib/order-status.ts`; kanonik = list (`Отгружен` / `Возврат`).
- **Migratsiya (M1):**
  1. Status SSOT + orphan context ✅ (2026-11-19)
  2. `OrderCreateBonusDebt` ✅ (2026-11-19; `bonus-debt/`)
  3. `PolkiReturnPolicy` ✅ (2026-11-19; `polki-policy/`)
  4. `OrderCreateDraft` + thin composer ✅ (2026-11-19; `draft/` + thin `hooks/use-order-create.ts`)
- **Test (T2):** pure unit + source-contract. M1.1 SSOT ✅; M1.2 BonusDebt ✅; M1.3 PolkiReturnPolicy ✅; M1.4 Draft ✅.
- **M1 checklist yopildi** (2026-11-19).
- **Hujjat:** `docs/adr/ADR-008-order-create-deep-modules.md`.
- **Grill yopildi** (2026-11-19).

## Attendance / Tabel (davomat) — reja (grill ochiq)

HR Hub (`d:\hr-hub`) reference; SALEC `backend/src/modules/tabel` + `timesheet` + mobile `features/attendance`. Office Link / device-gw / NATS **ko‘chirilmaydi**.

| Term | Meaning |
|------|---------|
| **AttendancePunch** | Bitta belgi (IN / OUT / estimated_out manbai). Terminal, mobil foto/video, (kelajakda) kiosk. |
| **AttendanceDayRecord** | Xodim × kun yig‘indisi: status, daqiqalar, kechikish — timesheet katakning asosiy manbai. |
| **WorkdayPunchClock** | (reja) Kun ochilishi = birinchi valid IN; yopilishi = OUT yoki shift-close. Barcha punch manbalari shu clock orqali day recordga yoziladi. |
| **DeviceVisibility** | (reja) Faqat **ulanган** (`is_linked` / confirmed) va **yoqilgan** (`enabled`) qurilmalar UI, ingest va face-syncda; qolganlari ko‘rinmaydi / ishlamaydi. |
| **AttendanceNotify** | (reja) Telegram kanal/guruh + nazoratchi DM adapterlari; sozlamalar: bot, default/filial chatId, foto/video/fraud. Punch submit faqat shu interface’ni chaqiradi. |
| **Face ID (punch)** | Mobil liveness + ixtiyoriy match; terminal Hikvision yuz. Sales `face_verification_flow` — boshqa kontekst (hard-gate), punch bilan aralashtirilmasin. |
| **Timesheet matrix** | Oylik kataklar: asosan `AttendanceDayRecord` + workdays + ledger override + agent norma. |

| **Auth Face Check** | Ilova kirishi: `mobile_config.misc.face_verification_*` — PIN/telefon Face ID dan **keyin** server selfie (`daily_login`). Tabel punch emas. |
| **Tabel Photo Punch** | Davomat: `punchModes.photo` + antifraud dual camera (front→back). |
| **Tabel Video Punch** | Davomat: `punchModes.video` + `punchVideo.captureMode` (sequential|simultaneous) + kunlik **unikal** 3 xonali kod (`pickDayCode` / `punchDayCode`). |

### Attendance — kelishuv holati

- Grill ochiq (2026-11-22): DeviceVisibility → WorkdayPunchClock → AttendanceNotify → Mobile hub.
- Auth Face / Tabel Photo / Tabel Video — uchta alohida sozlama konturi (2026-11-22).
- HR Hubdan faqat pure/diff + Flutter UX; `employeeNoString` raqamga kesilmasin.
- ADR hali yo‘q — qarorlar grill yopilgach yoziladi.

## Finance Dashboard (web `/dashboard/finance`)

NEW_PRO shablon asosidagi moliyaviy overview: AppShell chrome saqlanadi; sahifa kontenti `finance/pro/` presentation moduli.

| Term | Meaning |
|------|---------|
| **Finance Dashboard** | `/dashboard/finance` — filtrlar + NEW_PRO P&L/kassa/operatsiyalar UI. |
| **FinanceProOps** | Backend bloki (`dashboard.finance.pro-ops.ts`): income/expense/profit, cashflow, categories, recent transactions, cash desks, draft expenses calendar. Sales/debt snapshot localitydan alohida. |
| **FinanceProUiModel** | FE deep **interface**: widgetlar faqat shu modelni o‘qiydi. |
| **buildFinanceProUiModel** | Adapter: `summary.pro` → UiModel; `pro` yo‘q bo‘lsa legacy summary fallback. |

### Finance Dashboard — kelishuv (2026-11-22)

- Sidebar/topbar port qilinmaydi (AppShell).
- `pro` snapshotga qo‘shiladi; debts/ledger jadvallar shu ekrandan olib tashlandi (UI 1:1 shablon).
- Scheduled payments = kelajakdagi `expenses` draft; bo‘sh bo‘lishi mumkin.

## Related (not yet deepened)

| Term | Note |
|------|------|
| **Payment posting** | To‘lov yaratish/tasdiqlash/void orchestration (allocatsiya, cash desk, audit). Balans delta faqat Payment balance adapters orqali; to‘liq posting hali alohida chuqurlashtirish. |
