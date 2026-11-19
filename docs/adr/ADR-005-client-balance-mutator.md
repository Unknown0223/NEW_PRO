# ADR-005: ClientBalanceMutator — ikki qavatli yozuv seami

**Status:** Accepted (grill-with-docs, 2026-11-19)  
**Date:** 2026-11-19

## Context

Mijoz balansi yozuvi `payment.create`, `payment.balance.pending`, `payment.balance.void`, `payment.create.expense`, `payment.query.update`, returns (`refund` / `bonus-debt` / `discount-debt`), `opening-balances.write`, `clients.detail` (`adjustClientBalance`) va boshqalarda Prisma `upsert`/`update` + `clientBalanceMovement` nusxasi sifatida takrorlanadi.

`backend/src/lib/balance-upsert.ts` upsert/increment/decrement/movement beradi, lekin **hech kim import qilmaydi** va FOR UPDATE yo‘q. Oxirgi oylarda payment list vs client card vs expeditor attribution regressiyalari shu tarqoq yozuv pathiga uriladi.

O‘qish tomoni (card_net vs merged ledger) alohida muammo — bu ADR faqat **yozuv** seami.

## Decision

**ClientBalanceMutator** — ikki qavat:

1. **Past yadro — `applyDelta(tx, { tenantId, clientId, delta, note?, userId? })`**
   - Majburiy: mavjud tranzaksiya `tx`, tenant + client, signed `delta`.
   - Ichida: qatorni **FOR UPDATE** (yo‘q bo‘lsa create + lock semantikasi), balans yangilash, **har doim** movement.
   - **movementKind yo‘q** — `ClientBalanceMovement` da kind ustuni yo‘q; tur `note` ichida qoladi. Schema o‘zgarmaydi.
   - **Ichida emas:** payment sign, `entry_kind`, `workflow_status` / pending skip, allocatsiya, audit log, dashboard invalidate.

2. **Yuqori — faqat payments**
   - `postConfirmedPaymentAmount` / `reversePayment` / `postExpense` (nomlar aniqlashda) delta hisoblab `applyDelta` chaqiradi.
   - Pending skip — shu adapterlar zimmasida.

3. **Returns, opening-balances, manual adjust** to‘g‘ridan `applyDelta` chaqiradi (payment tiliga o‘tkazilmaydi).

4. **`balance-upsert.ts`** — `applyDelta` uni almashtiradi; absorb qilinadi yoki o‘chiriladi (alohida migrate qadamida). Yangi chaqiruvlar faqat mutator orqali.

5. **Movement typing** — `movementKind` interface parametr sifatida **rad etildi** (grill 2026-11-19). Kind ma’lumoti faqat `note` matnida.

6. **Modul joyi (P1)** — `backend/src/modules/client-balances/client-balance-mutator.ts` (domain yonida). `backend/src/lib/balance-upsert.ts` o‘rniga shu fayl; lib ga qayta qo‘yilmaydi.

## Migration order (M1 — Tracer bullet)

1. `applyDelta` yozish; `balance-upsert.ts` o‘chirish yoki absorb qilish (0 import — xavfsiz).
2. `addClientBalanceMovement` (`clients.detail`) → `applyDelta`.
3. Payments yuqori adapterlar + `create` / `pending` / `void` / `expense` / `update`. ✅ (2026-11-19: `payment-balance.adapters.ts`)
4. Returns (`refund-ledger`, `bonus-debt`, `discount-debt`). ✅ (2026-11-19: to‘g‘ridan `applyDelta`)
5. Opening-balances write/void/restore. ✅ (2026-11-19: create/void/restore linked → payment adapters; legacy void/restore → `applyDelta`)

**M1 yopildi (2026-11-19):** ClientBalanceMutator yozuv seami to‘liq — barcha hot write pathlar `applyDelta` yoki payment balance adapterlari orqali.

## Test contract (T2)

- **`applyDelta` integration:** FOR UPDATE; create-if-missing; movement har doim; `delta === 0` rad; tenant scoped.
- **Payment adapters:** faqat sign / pending-skip **pure** unit (Prisma’siz).
- **Bitta** to‘liq payment oqim integration: `confirmPending` **yoki** `void` → adapter → `applyDelta`.
- Call site’larda qayta `clientBalance.upsert` assert **yo‘q**.

## Consequences

- Testlar asosan `applyDelta` **interface**iga uriladi; payment sign/pending pure + bitta oqim integration (T2).
- Call site migratsiyasi M1 tartibida; yangi yozuvlar faqat mutator orqali.
- ClientBalanceDisplay (#2) bu ADRni o‘zgartirmaydi; o‘qish stub alohida.

## Alternatives considered

- **A) Faqat ledger primitive** — payment helperlari yo‘q; sign nusxasi payments ichida qoladi (qisman OK, lekin payment create/void juftligi yana tarqaladi).
- **B) Payment-aware bitta interface** — returns/opening payment tiliga bog‘lanadi; noto‘g‘ri seam.
- **Mavjud `balance-upsert.ts` ni “adopt” qilish o‘zgartirmasdan** — FOR UPDATE va bitta chaqiruv shartnomasi yo‘q; 0 import — shallow.
