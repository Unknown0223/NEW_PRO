# N+1 Query Audit (S2-03)

> **Sana:** 2026-07-05  
> **Tekshirilgan:** `order.query.ts`, `order.list-enrichment.ts`, `clients.list.ts`

## Xulosa

| Modul | Holat | Izoh |
|-------|-------|------|
| `orders/domain/order.query.ts` | ✅ Yaxshi | Ro‘yxat: bitta `findMany` + `include` (client, warehouse, agent, items) |
| `orders/domain/order.list-enrichment.ts` | ✅ Yaxshi | Batch: `orderStatusLog`, `order.findMany`, `user.findMany` — `IN (...)` |
| `clients/clients.list.ts` | ✅ Yaxshi | `findMany` + `loadDeliveryDebtByClient(tenantId, pageIds)` batch |

## order.query.ts — `listOrdersForTenantPaged`

- Asosiy so‘rov: `prisma.order.findMany` barcha relationlar bilan bir `include` da.
- Exchange meta: alohida `findMany` faqat `exchange` tipidagi ID lar uchun (`id IN (...)`).
- `loadOrdersListMetaEnrichment` va `loadOrdersFinanceEnrichment` — batch helperlar, tsikl ichida DB yo‘q.

**Tavsiya:** hozircha o‘zgartirish shart emas. Kursor pagination (`useCursor`) count ni o‘tkazib yuboradi — bu ataylab (perf).

## clients.list.ts — `listClientsForTenantPaged`

- `Promise.all([count, findMany])` — 2 parallel so‘rov.
- `loadDeliveryDebtByClient` — sahifa `client_id` lar batch.
- `bulkPatchClients` — har bir ID uchun `updateClientFields` (bulk PATCH); katta ro‘yxatda sekin bo‘lishi mumkin.

**Tavsiya (past prioritet):** `bulkPatchClients` ni `$transaction` + batch audit bilan optimallashtirish (100+ ID da).

## Tekshirish buyrug‘i

```bash
cd backend
PRISMA_QUERY_LOG=1 npx vitest run tests/orders.integration.create.test.ts 2>&1 | findstr /i "prisma:query"
```

Kutilgan: order yaratishda mahsulot/narx/stock so‘rovlari cheklangan batch; ro‘yxat testida order soniga linear emas, bitta yoki kam `findMany`.

## Keyingi audit nuqtalari (reja)

- `clients.detail.ts` — `getClientDetail` kesh + include chuqurligi
- `order.query.ts` — `getOrderDetail` (agar alohida N+1 topilsa)
- Dashboard snapshot partials (Faza 4)
