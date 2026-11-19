# ADR-007: StockReservation — stock moduli ichidagi bron seami

**Status:** Accepted (grill-with-docs, 2026-11-19)  
**Date:** 2026-11-19  
**Related:** GLOSSARY «StockReservation»; chuqurlashtirish #3 (architecture review)

## Context

`reserved_qty` yozuvi va available assert hozir `orders/domain` ichida tarqoq: `order.stock-lock.ts`, `order.create-tx.stock.ts` (thin hop), `order.lifecycle.ts`, `order.lines-stock.ts`. Warehouse transfers o‘z `assertSourceStockForLines` ni qiladi, lekin `reserved_qty` yozmaydi. FE `qty` / `reserved` / available ni ko‘rsatadi.

Muammo: stock qoidalari (FOR UPDATE, available, clamp) orders/transfers ga sochilgan — locality yo‘q; `release`/`consume` da FOR UPDATE yo‘q; `cancelled → new` re-reserve lock/assert qilmasdan `reserved_qty` oshiradi.

## Decision

1. **Deep interface (StockReservation)** — `backend/src/modules/stock/stock-reservation.ts`  
   - `reserve(tx, …)` / `release(tx, …)` / `consume(tx, …)` / `assertAvailable(…)`  
   - Har bir `reserve` / `release` / `consume` ichida **majburiy FOR UPDATE**  
   - `lock` public emas (faqat modul ichida)  
   - `assertAvailable` — yozuvsiz; transfers / bonus-cap / adjustment shu orqali  

2. **Adapters** — orders va transfers **thin**:  
   - Orders: line→needMap (inbound shelf return, bonus, exchange minus) + `reserve` / `release` / `consume` chaqiriq  
   - `order.create-tx.stock` stock hop sifatida **yo‘qoladi** (adapter + `reserve`)  
   - Transfers: faqat `assertAvailable` (reserved yozuvi yo‘q — joriy amaliyot)  

3. **Frontend (F1)** — Backend-only deepen. FE formulasi / maydonlari o‘zgarmaydi.

4. **Migratsiya (M1 — yozuv birinchi)**  
   1. `stock-reservation.ts` deep + test (T2) ✅ (2026-11-19)  
   2. orders: create → lines edit → lifecycle (shu jumladan **`cancelled → new` → `reserve()`**) ✅ (2026-11-19; `order.stock-lock` o‘chirildi)  
   3. transfers `assertAvailable` ✅ (2026-11-19; thin adapter `assertSourceStockForLines`)  
   4. bonus-cap / adjustment assert ✅ (2026-11-19; `assertAvailable` + `loadAvailableByProduct`)  

**M1 checklist yopildi** (2026-11-19).

5. **Test (T2)**  
   - Integration: reserve (ok / insufficient), release (clamp ≥ 0), consume (qty + reserved), assertAvailable  
   - Parallel race (ikkita concurrent `reserve`) — **majburiy**  
   - Bitta orders create oqimi adapter orqali `reserve` ishlatilganini tekshirish  
   - Call site’da qayta `reserved_qty` SQL / qo‘lda available assert yo‘q  

## Consequences

- Yangi bron/assert call site’lari faqat StockReservation orqali.
- `order.stock-lock.ts` logikasi stock-reservation ga ko‘chadi; orders faqat adapter.
- `cancelled → new` M1 da `reserve()` orqali — available yetarli bo‘lmasa xato (oldingi «jim» oshirish o‘zgaradi).

## Alternatives considered

- **B — lock public** — rad: chaqiruvchi qulflashni unutishi mumkin; har op ichida majburiy.
- **C — bitta `applyReservedDelta`** — rad: reserve/release/consume nomlari chuqurroq; ClientBalance `applyDelta` dan farq — stockda qty+reserved juftligi.
- **needMap stock modulida** — rad: order qator qoidalari orders domenida.
- **FE available majburiy API (F3)** — rad: F1; dual truth xavfi bu deepen doirasida emas.
- **Transfers birinchi / big bang** — rad: yozuv (orders) birinchi.
- **`cancelled → new` M1 dan tashqari** — rad: lifecycle migratsiyasining bir qismi.
