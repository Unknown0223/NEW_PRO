# ADR-008: OrderCreate — uchta deep module + thin composer

**Status:** Accepted (grill-with-docs, 2026-11-19)  
**Date:** 2026-11-19  
**Related:** GLOSSARY «OrderCreate»; chuqurlashtirish #4 (architecture review)

## Context

`frontend/components/orders/order-create/hooks/use-order-create.ts` (~3521 satr) god-hook: ordinary/exchange draft, Polki shelf-return, bonus preview/confirm va debt summalari bitta joyda. View allaqachon `OrderCreateVm` oladi, lekin mantiq hook ichida. `context/order-create-context.tsx` orphan (0 import). Status yorliqlari `order-create/constants.ts` va `lib/order-status.ts` da divergensiya (`delivering`, `returned`).

## Decision

1. **Uchta deep module (FE)**  
   - **OrderCreateDraft** — ordinary / exchange / edit: header, qatorlar, stock/qty, submit base  
   - **PolkiReturnPolicy** — shelf-return: mode, order pick, composition/rebalance, peresort, polki grid  
   - **OrderCreateBonusDebt** — bonus preview/confirm + debt summalari (submit maydonlari). Backend `ClientBalanceMutator` **emas**  

2. **Interface** — har module `useX()` + ichki pure; public API = hook return shape.

3. **Thin view (F1)** — `useOrderCreate` **thin composer**: uchala module ni yig‘ib tekis `OrderCreateVm` qaytaradi. `OrderCreateView({ vm })` deyarli o‘zgarmaydi.

4. **Fayl joylashuvi** — `order-create/draft/`, `order-create/polki-policy/`, `order-create/bonus-debt/` (`use-*.ts` + `*.logic.ts`); composer `hooks/use-order-create.ts`.

5. **Status SSOT** — `frontend/lib/order-status.ts` `ORDER_STATUS_LABELS`; create `ORDER_STATUS_LABEL_RU` o‘chadi; `orderStatusLabelRu` delegat. Kanonik matn = list (`Отгружен` / `Возврат`).

6. **Orphan** — `context/order-create-context.tsx` o‘chiriladi.

7. **Migratsiya (M1)**  
   1. Status SSOT + orphan context o‘chirish ✅ (2026-11-19)  
   2. `OrderCreateBonusDebt` ajratish ✅ (2026-11-19; `bonus-debt/use-order-create-bonus-debt.ts` + `bonus-debt.logic.ts`)  
   3. `PolkiReturnPolicy` ajratish ✅ (2026-11-19; `polki-policy/use-polki-return-policy.ts` + data/composition + `polki-return-policy.logic.ts`)  
   4. `OrderCreateDraft` + thin composer ✅ (2026-11-19; `draft/use-order-create-draft.ts` + data/catalog + `draft.logic.ts`; composer `hooks/use-order-create.ts`)  

**M1 checklist yopildi** (2026-11-19).

8. **Test (T2)** — pure unit (debt/split/rebalance/submit flags) + source-contract: SSOT; composer uchala `useX`; orphan yo‘q; call site’da qayta status/bonus/polki/draft god-pattern yo‘q. RTL form smoke M1 ga shart emas.  
   - M1.1: `frontend/tests/order-create-status-ssot.contract.test.ts`  
   - M1.2: `frontend/tests/order-create-bonus-debt.logic.test.ts` + `order-create-bonus-debt.contract.test.ts`  
   - M1.3: `frontend/tests/order-create-polki-return-policy.logic.test.ts` + `order-create-polki-return-policy.contract.test.ts`  
   - M1.4: `frontend/tests/order-create-draft.logic.test.ts` + `order-create-draft.contract.test.ts`

## Consequences

- Yangi create mantiq tegishli deep module da; view Vm orqali.
- God-hook hajmi composer + wiring ga tushadi.
- Status matnlari list/history bilan bir xil bo‘ladi (create maxsus copy yo‘qoladi).

## Alternatives considered

- **Bitta OrderCreateDraft (hamma ichida)** — rad: Polki alohida mahsulot yuzi; yana shallow god-module.
- **View uchta prop/hook** — rad: view churn; tekis Vm saqlanadi.
- **React Context Provider** — rad: hozirgi workspace allaqachon hook→view; orphan context o‘chiriladi, yangisi kerak emas.
- **Faqat pure, state composerda** — rad: depth hook return shape orqali; pure ichkarida.
- **Draft shell birinchi / Polki birinchi** — rad: past xavf (SSOT+orphan) → BonusDebt → Polki → Draft.
- **Faqat GLOSSARY, ADR yo‘q** — rad: topologiya + composer + M1 qaytarish qimmat; kelajakdagi architecture review uchun yoziladi.
