# AI Assistant — qila oladi / qila olmaydi va yangi tool qo'shish checklist

> **Maqsad:** chat orqali SalesArena ma'lumotlarini o'qish va o'zgartirish (preview→confirm), xavfsiz RBAC bilan.
>
> **Audited:** Barcha endpointlar real repo code'dan tekshirilgan (grep kontakts). Noto'g'ri path qolmagan.

---

## 📋 Tool audit jadvali (real endpoint + permission)

| # | Tool | Eski path | To'g'ri path | Permission (anyOf) | Status |
|---|------|-----------|--------------|-------------------|--------|
| 1 | dashboard.stats | GET /dashboard/stats | GET /dashboard/stats | dashboard.prodazhi.view | ✅ |
| 2 | dashboard.finance | GET /dashboard/finance/summary | GET /dashboard/finance/summary | dashboard.finansy.view, finance.obzor.view | ✅ |
| 3 | sales.summary | GET /reports/sales | GET /reports/sales | reports.view + guruh | ✅ |
| 4 | sales.trend | GET /reports/order-trends | GET /reports/order-trends | reports.view + guruh | ✅ |
| 5 | sales.by_agent | GET /reports/agent-orders | GET /reports/agent-orders | reports.zakazy_agentov.view | ✅ |
| 6 | sales.by_product | GET /reports/product-sales | GET /reports/product-sales | reports.prodazhi_tovarov.view | ✅ |
| 7 | sales.by_client | GET /reports/client-sales-2 | GET /reports/client-sales-2 | reports.prodazhi_klientov_2.view | ✅ |
| 8 | returns.list | GET /reports/expeditor-returns/orders | GET /reports/expeditor-returns/orders | reports.vozvrat_ekspeditora.view | ✅ |
| 9 | finance.receivables | GET /reports/receivables ❌ | GET /reports/client-receivables | cash.otchety.view + guruh | ✅ FIXED |
| 10 | finance.cashflow | GET /reports/cash-flow | GET /reports/cash-flow | cash.otchety.view | ✅ |
| 11 | finance.expenses | GET /expenses | GET /expenses | cash.rashody_klienta.view | ✅ |
| 12 | finance.expenses_summary | GET /expenses/summary | GET /expenses/summary | cash.rashody_klienta.view | ✅ |
| 13 | finance.pnl | GET /expenses/pnl | GET /expenses/pnl | cash.otchety.view | ✅ |
| 14 | finance.cash_desks | GET /cash-desks | GET /cash-desks | cash.kassa.view | ✅ |
| 15 | orders.list | GET /orders | GET /orders | orders.zakaz.view | ✅ |
| 16 | payments.list | GET /payments | GET /payments | cash.oplaty_klientov.view | ✅ |
| 17 | clients.list | GET /clients | GET /clients | clients.klient.view | ✅ |
| 18 | products.list | GET /products | GET /products | settings.tovar.view | ✅ |
| 19 | stock.balances | GET /stock/balances | GET /stock/balances | warehouse.ostatki.view | ✅ |
| 20 | staff.list | GET /agents etc. | GET /agents etc. | staff.<tur>.view | ✅ |
| 21 | tasks.list | GET /tasks | GET /tasks | staff.zadachi_spisok.view | ✅ |
| 22 | payroll.list | GET /payroll/records | GET /payroll/records | staff.zarplaty.view | ✅ |
| 23 | orders.detail | GET /orders/:id | GET /orders/:id(\d+) | orders.zakaz.view | ✅ |
| 24 | returns.detail | GET /reports/expeditor-returns/orders/:id | GET /reports/expeditor-returns/orders/:id | reports.vozvrat_ekspeditora.view | ✅ |
| 25 | consignment.list | GET /consignment/agents | GET /consignment/agents | staff.konsignatsiya.view | ✅ |
| 26 | reports.visits | — | GET /reports/visits-2 | reports.vizity.view | ✅ YANGI |
| 27 | tabel.marks | GET /tabel ❌ | GET /tabel/marks | tabel.otmetki.view, staff.tabel.view | ✅ FIXED |
| 28 | kpi.plan | GET /reports/kpi-plan ❌ | GET /reports/agent-kpi | reports.view + guruh | ✅ FIXED |
| 29 | price.matrix | GET /price-matrix ❌ | GET /price-matrix/lookup | settings.tovar.view, settings.tsena.view | ✅ FIXED |
| 30 | stock.transfer | — | GET /orders/consignment-transfers | warehouse.ostatki.view | ✅ YANGI |
| 31 | price.as-of | — | GET /orders/prices-as-of | settings.tovar.view, settings.tsena.view | ✅ YANGI |
| 32 | write.create_employee | POST /agents | POST /agents | staff.agent.create | ✅ |
| 33 | write.update_employee | PATCH /agents/:id | PATCH /agents/:id | staff.agent.update | ✅ |
| 34 | write.set_price | PUT /products/:id/prices | PUT /products/:id/prices | settings.tsena.update | ✅ |
| 35 | write.create_client | POST /clients | POST /clients | clients.klient.create | ✅ |
| 36 | write.update_client | PATCH /clients/:id | PATCH /clients/:id | clients.klient.update | ✅ |
| 37 | write.create_product | POST /products | POST /products | settings.tovar.create | ✅ |
| 38 | write.update_settings | PATCH /settings/profile | PATCH /settings/profile | settings.profil_kompanii.update | ✅ |
| 39 | write.create_task | POST /tasks | POST /tasks | staff.zadachi_spisok.create | ✅ |
| 40 | write.update_product | PATCH /products/:id | PATCH /products/:id | settings.tovar.update | ✅ YANGI |
| 41 | write.order_status | — | PATCH /orders/:id | orders.zakaz.update | ✅ YANGI |

**Jami: 31 o'qish + 10 yozish = 41 tool**

---

## ✅ Qila oladi (o'qish)

| Bo'lim | Savol misoli | Tool |
|--------|-------------|------|
| Umumiy | "Umumiy holat: savdo, qarz, kassa" | dashboard.stats + sales.summary + finance.receivables + finance.cash_desks |
| Savdo | "Shu oy savdo qancha bo'ldi?" | sales.summary |
| Savdo agent | "Top agentlar kimlar?" | sales.by_agent |
| Savdo mahsulot | "Eng ko'p sotilgan mahsulotlar" | sales.by_product |
| Savdo mijoz | "Eng katta mijozlar kimlar?" | sales.by_client |
| Qarzlar | "Qarzdorlar ro'yxati Excelda" | finance.receivables → export |
| Kassa | "Kassalarda qancha pul bor?" | finance.cash_desks |
| Buyurtma | "Buyurtma #123 tafsilotlari" | orders.detail |
| Buyurtmalar | "Oxirgi buyurtmalar" | orders.list |
| To'lovlar | "Oxirgi 7 kun to'lovlar" | payments.list |
| Mijozlar | "Mijozlar ro'yxati" | clients.list |
| Mahsulotlar | "Mahsulotlar katalogi" | products.list |
| Ombor | "Ombordagi qoldiq" | stock.balances |
| Xodimlar | "Agentlar ro'yxati" | staff.list |
| Vazifa | "Vazifalar ro'yxati" | tasks.list |
| Ish haqi | "Ish haqi shu oy" | payroll.list |
| Qaytarish | "Vozvratlar ro'yxati" | returns.list |
| Konsignatsiya | "Konsignatsiya qarzlari" | consignment.list |
| Ziyorat | "Bozori ziyoratlar" | reports.visits |
| Tabel | "Tabel marks shu oy" | tabel.marks |
| KPI | "KPI plan-rasto" | kpi.plan |
| Narx matritsa | "Narx matritsasi" | price.matrix |
| Narx sana | "Narx bo'yicha sana 2026-11-01" | price.as-of |
| Ombor transfer | "Ombor transfer shu oy" | stock.transfer |
| Yordam | "Nima qila olasan?" | help.capabilities |

## ✅ Qila oladi (yozish — faqat preview → confirm)

| Amal | Savol misoli | Tool | Ruxsat |
|------|-------------|------|--------|
| Narx o'zgartirish | "SKU-001 narxini 150000 qil" | write.set_price | settings.tsena.update |
| Mahsulot yangilash | "Mahsulot #10 nomini 'Olma yangilangan' qil" | write.update_product | settings.tovar.update |
| Xodim qo'shish | "Yangi agent qo'sh: Aziz, login aziz, parol 12345678" | write.create_employee | staff.agent.create |
| Xodimni o'zgartirish | "Xodimni nofaol qil" | write.update_employee | staff.agent.update |
| Buyurtma holati | "Buyurtma #100 holatini tasdiqlandi qil" | write.order_status | orders.zakaz.update |
| Mijoz qo'shish | "Yangi mijoz qo'sh: MMC, telefon +99890..." | write.create_client | clients.klient.create |
| Mijozni o'zgartirish | "Mijoz kredit limitini 5 mln qil" | write.update_client | clients.klient.update |
| Mahsulot qo'shish | "Yangi mahsulot qo'sh: SKU-002, Olma, kategoriya 5" | write.create_product | settings.tovar.create |
| Kompaniya sozlamasi | "Kompaniya nomini 'Yangi MMC' qil" | write.update_settings | settings.profil_kompanii.update |
| Vazifa berish | "Vazifa ber: skladga tekshir, Kimga: agent1" | write.create_task | staff.zadachi_spisok.create |

## ❌ Qila olmaydi

| Chegara | Nega | Nima qaytariladi |
|---------|------|-----------------|
| O'chirish (`DELETE`) | Delete tool'i yo'q | "O'chirish yordamchi orqali mumkin emas" |
| Boshqa foydalanuvchi ma'lumoti (agent rol) | `user_id` o'ziga majburiy yangilanadi | Faqat o'z ma'lumoti |
| Ruxsat yo'q tool | `anyOf` mos kelmasa | `denied` sabab bilan |
| Ixtiyoriy URL | Faqat registry tool'lari | Tool topilmadi |
| LLM noto'g'ri plan | Qoidalar (rules) fallback'ga o'tadi | Rules natijasi ishlatiladi |
| Token takroriy ishlatish | `SET NX` bir martalik | "Token allaqachon ishlatilgan" |
| Muddati o'tgan token | TTL 300s (confirm), 600s (export) | "Token muddati tugagan" |

---

## 🆕 Yangi tool qo'shish checklist

Har bir yangi tool uchun quyidagi barcha qadamlarni bajaring:

1. [ ] **Intent qo'shish** — `ai.intent.ts` da `READ_INTENTS` yoki `WRITE_INTENTS` ga kalit so'zlar (uz + ru) bilan
2. [ ] **Slot ajratish** — `ai.intent.ts` da `extractSlots` ga yangi maydon (agar kerak bo'lsa)
3. [ ] **Tool spec** — `ai.tools.read.*.ts` yoki `ai.tools.write.ts` ga `AiToolSpec` qo'shish (`anyOf`, `schema`, `path`, `body`, `format`, `preview`)
4. [ ] **Plan mapping** — `ai.plan.ts` da `buildReadCalls` / `buildWriteDraft` switch'iga case qo'shish
5. [ ] **Registry** — `ai.registry.ts` da yangi fayldan import qilish va `ALL` massiviga qo'shish
6. [ ] **Permission kaliti** — `tool.anyOf` da real permission kalitini ko'rsatish (`rbac.resolve.ts` dan tekchir)
7. [ ] **Test** — `tests/ai-*.pure.test.ts` da 3–5 haqiqiy savol testi
8. [ ] **Misol savol** — `ai.registry.ts` da `AI_EXAMPLES` ga qo'shish
9. [ ] **Hujjat** — `docs/AI_ASSISTANT_CAPABILITIES.md` jadvaliga qo'shish
10. [ ] **LOC chekrashi** — har bir fayl ≤400 qator bo'lishi kerak (`scripts/audit-max-file-lines.mjs`)

---

## 📊 Joriy holat

| Tur | Soni |
|-----|------|
| O'qish (read) | 31 ta |
| Yozish (write) | 10 ta |
| Jami | 41 ta |
