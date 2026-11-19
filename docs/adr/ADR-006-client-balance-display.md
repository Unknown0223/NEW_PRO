# ADR-006: ClientBalanceDisplay — bitta o‘qish seami

**Status:** Accepted (grill-with-docs, 2026-11-19)  
**Date:** 2026-11-19  
**Related:** ADR-005 (ClientBalanceMutator — yozuv; bu ADR faqat **o‘qish**)

## Context

Mijoz balansi o‘qishida ikki parallel ma’no bor:

- **card_net** — `loadLedgerCardNetByClient` (reports, payments list, consignment, …)
- **ledger_merged** — `mergeLedgerWithUnpaidDelivered` (clients detail/list, orders debt gates, mobile finance, …)

`client-balance-view.ts` skeleton faqat `card_net` delegate qiladi va production chaqirmaydi. Call site’lar to‘g‘ridan helperlarni import qiladi — locality yo‘q, dual truth xavfi.

Frontend `ClientBalanceViewMode` (hisobot tab: clients/agents/…) — boshqa tushuncha; chalkashtirilmasin.

## Decision

1. **Deep o‘qish interface** — `loadClientBalanceView(tenantId, clientIds, mode, opts?)`  
   - `mode: "card_net" | "ledger_merged"`  
   - `opts.asOfEnd?: Date` — alohida kind emas  
   - **raw_row** public interface’da yo‘q  

2. **Fayl (P1)** — mavjud `backend/src/modules/client-balances/client-balance-view.ts` stub **chuqurlashadi** (o‘chirilmaydi). Ichki SQL/merge mavjud `client-balances.ledger` / `delivery` ga delegate.

3. **Frontend (F1)** — Backend-only. FE o‘zgarmaydi; `account_balance` / `ledger_net_balance` API orqali. FE ClientLedger seamni to‘g‘ridan chaqirmaydi. Polarity/merge faqat backendda.

4. **Migratsiya (M1 — Debt gate birinchi)**  
   1. `loadClientBalanceView` deep ✅ (2026-11-19: `card_net` | `ledger_merged`, `asOfEnd` opts)  
   2. orders (create / lifecycle / debt) + mobile finance ✅ (2026-11-19: `ledger_merged`)  
   3. clients detail/list + ledger get ✅ (2026-11-19: `ledger_merged`)  
   4. payments list enrich ✅ (2026-11-19: `card_net`)  
   5. reports / consignment / returns filter ✅ (2026-11-19: reports/consignment `card_net`, returns filter `ledger_merged`)  

**M1 checklist yopildi** (2026-11-19). Qolgan tashqi merge (masalan tg-app, mobile expeditor deliver) — M1 dan tashqari; bosqichma-bosqich.

5. **Yozuv** — faqat ADR-005 / `applyDelta`; bu modul o‘qishdan tashqariga chiqmaydi.

## Consequences

- Yangi o‘qish call site’lari faqat `loadClientBalanceView` orqali.
- Ichki `loadLedgerCardNetByClient` / `mergeLedgerWithUnpaidDelivered` private/delegate qolishi mumkin; tashqi importlar bosqichma-bosqich yo‘qoladi.
- Testlar view **interface**iga uriladi (kind + asOfEnd); call site’larda qayta merge assert yo‘q.

## Alternatives considered

- **B/C kind to‘plami** (`as_of` / `raw_row` alohida) — rad: Minimal A yetarli; asOfEnd opts.
- **FE ham hisoblaydi (F3)** — dual truth; rad.
- **Yangi fayl (P2)** — stub allaqachon to‘g‘ri joyda; P1.
