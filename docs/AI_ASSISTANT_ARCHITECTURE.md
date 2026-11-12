# SALEC AI Assistant — to‘liq arxitektura va ishlash logikasi

> **Hujjat holati:** ✅ LOGIKA TAYYOR + KOD YOZILDI (`backend/src/modules/ai/`)
> **Oxirgi yangilanish:** 2026-11-12
> **Bog‘liq hujjatlar:** `docs/SALEC_LOCAL_AI_RUNBOOK.md` (reja), `backend/docs/rbac-route-pattern.md`

---

## 1. Maqsad

Bitta AI yordamchi (chat) orqali foydalanuvchi:

| Bosqich | Nima qiladi | Misol |
|---------|-------------|-------|
| **1-etap — ma’lumot** | Savolga javob: yig‘ilgan ma’lumot, jadval, hisobot, **Excel/CSV fayl** | «Shu oy savdo qancha?», «Qarzdorlar ro‘yxati Excelda» |
| **2-etap — vazifa** | Tizim sozlamalarini o‘zgartirish: xodim qo‘shish, narx o‘zgartirish, mijoz yaratish, topshiriq berish | «Yangi agent qo‘shilsin», «SKU-001 narxini 150 000 qil» |
| **3-etap — dostup** | Har bir foydalanuvchi **faqat o‘z dostupidagi** ma’lumotni oladi; dostupdan tashqari na ma’lumot, na amal | Agent boshqa agentning qarzini ko‘rmaydi; operator narxni o‘zgartira olmaydi |

**Muhim tamoyil:** yordamchi — «ikkinchi eshik» emas. U tizimning **mavjud API’larini foydalanuvchining o‘z tokeni bilan** chaqiradi. Shu sababli RBAC, tenant izolyatsiyasi va data-scope filtrlari **avtomatik** ishlaydi.

---

## 2. Asosiy tamoyillar

1. **Bypass yo‘q.** Yordamchi DB’ga to‘g‘ridan-to‘g‘ri so‘rov yubormaydi (audit va capability tekshiruvidan tashqari). Har bir tool — ichki `app.inject()` HTTP chaqiruvi, foydalanuvchi `Authorization` sarlavhasi bilan.
2. **Allow-list.** Faqat ro‘yxatga olingan endpointlar. Foydalanuvchi matnidan kelgan ixtiyoriy URL/parametr hech qachon bajarilmaydi.
3. **Ikki bosqichli yozish.** Har qanday o‘zgartirish avval **preview** (nima o‘zgaradi) → **tasdiqlash tokeni** → keyin bajariladi. Token `HMAC` bilan imzolangan, `sub`/`tenant`/`payload hash`/`exp` ga bog‘langan va **bir martalik**.
4. **Yopiq default.** Permission topilmasa yoki role mos kelmasa — tool **bajarilmaydi**, foydalanuvchiga aniq sabab qaytariladi.
5. **Hamma narsa auditda.** Har savol, har tool, har yozish — `tenant_audit_events`.
6. **O‘qish va yozish ajratilgan.** Read tool’lar `kind: "read"`, write tool’lar `kind: "write"` + alohida role siyosati.
7. **O‘chirish yo‘q.** `delete` tool’lari ataylab yo‘q — yordamchi hech narsani o‘chirmaydi (faqat holatni `is_active` orqali o‘zgartiradi).

---

## 3. Yuqori darajadagi sxema

```
┌──────────────┐   POST /api/:slug/ai/ask
│ Web / Mobile │──────────────────────────────┐
└──────────────┘                              ▼
                              ┌───────────────────────────────┐
                              │  ai.route.ts  (HTTP qatlam)    │
                              │  jwtAccessVerify + tenant      │
                              │  + rate limit + audit          │
                              └───────────────┬───────────────┘
                                              ▼
                    ┌────────────────────────────────────────────┐
                    │  ai.orchestrator.ts  (pipeline)            │
                    │                                            │
                    │  1. NLU      ai.intent.ts  (uz/ru)         │
                    │  2. PLAN     ai.plan.ts → tool + params    │
                    │  3. GUARD    ai.guard.ts (permission/role) │
                    │  4. EXEC     ai.exec.ts  app.inject(...)    │
                    │  5. FORMAT   ai.format.ts → jadval         │
                    │  6. EXPORT   ai.export.ts (xlsx/csv)       │
                    └───────────────┬────────────────────────────┘
                                    │  foydalanuvchi tokeni bilan
                                    ▼
                    ┌────────────────────────────────────────────┐
                    │  Mavjud SALEC API (o‘zgarmagan)             │
                    │  /reports/* /clients /products /agents ...  │
                    │  RBAC guard + data scope + tenant tekshiruv │
                    └────────────────────────────────────────────┘
```

**Nega `app.inject`?** Ichki HTTP chaqiruv barcha global hook’lardan o‘tadi:
`tenantPlugin` → `jwtAccessVerify` → `requireRoles/requireAnyPermission` → `registerRoutePermissionGuard` → handler ichidagi `ensureTenantContext` → service darajasidagi scope (agent/supervisor/ombor).
Ya’ni yordamchi **yangi ruxsat yo‘li yaratmaydi**.

---

## 4. Qatlamlar batafsil

### 4.1 NLU (ai.intent.ts) — intent + slot

Qoidalar (rules) asosida, LLM **ixtiyoriy** (bo‘lmasa ham ishlaydi):

- **Intent katalogi** (35 ta): `sales.summary`, `sales.by_agent`, `sales.by_product`, `sales.by_client`, `sales.trend`, `finance.receivables`, `finance.expenses`, `finance.pnl`, `finance.cashflow`, `finance.cash_desks`, `orders.list`, `payments.list`, `clients.list`, `products.list`, `stock.balances`, `staff.list`, `payroll.list`, `tasks.list`, `dashboard.stats`, `dashboard.finance`, `returns.list`, `export.table`, `help.capabilities`, `write.create_employee`, `write.update_employee`, `write.create_client`, `write.update_client`, `write.create_product`, `write.set_price`, `write.update_settings`, `write.create_task`.
- **Slotlar:** davr (`from`,`to`), summa, ism/login/SKU/telefon, narx turi, holat, rol turi, `wantExport`.
- **Davr parseri** (`ai.dates.ts`): `bugun`, `kecha`, `shu hafta`, `o‘tgan hafta`, `shu oy`, `o‘tgan oy`, `shu chorak`, `shu yil`, `oxirgi N kun`, `YYYY-MM-DD`, `DD.MM.YYYY`, `1–10 noyabr`, ruscha ekvivalentlari. Vaqt mintaqasi — `Asia/Tashkent`.
- **Skorlash:** har intent uchun kalit so‘zlar to‘plami (vaznli). Eng yuqori skor → intent. Teng bo‘lsa — birinchi. Hech narsa topilmasa → `help.capabilities`.

**LLM (ixtiyoriy) rejimi:** agar `ASSISTANT_API_KEY` yoki lokal LM Studio sozlangan bo‘lsa, LLM faqat **JSON plan** taklif qiladi:
```json
{"intent":"sales.summary","params":{"from":"2026-11-01","to":"2026-11-12"}}
```
Bu plan **registrga qarshi validatsiya** qilinadi (noma’lum intent/tool — rad etiladi). LLM xato qilsa — rules natijasi ishlatiladi.

### 4.2 PLAN (ai.plan.ts)

`intent + slots → AiToolCall[]`:

| Intent | Tool(lar) |
|--------|-----------|
| `sales.summary` | `sales.summary` (+ `sales.trend` davr > 7 kun bo‘lsa) |
| `finance.receivables` | `finance.receivables` |
| `overview` | `dashboard.stats`, `sales.summary`, `finance.receivables`, `finance.cash_desks` |
| `write.set_price` | `write.set_price` → **preview** (bajarilmaydi) |

Plan **maksimum 4 tool** va **faqat allow-list**dan iborat.

### 4.3 GUARD (ai.guard.ts) — 3-etapning yadrosi

Uch qatlamli tekshiruv:

**Qatlam A — marshrut RBAC (mavjud, o‘zgarmagan).**
Ichki chaqiruv o‘z tokeni bilan ketadi → 403 bo‘lsa, tool `denied` deb belgilanadi.

**Qatlam B — pre-flight (yordamchi darajasida).**
`resolveUserPermissionKeys(tenantId, userId, role)` orqali foydalanuvchining **effective** ruxsatlari olinadi va `tool.anyOf` bilan solishtiriladi:
- `admin` → hammasi ruxsat;
- birorta kalit mos kelsa → ruxsat;
- mos kelmasa → tool umuman chaqirilmaydi, javobda `denied` sababi.

**Qatlam C — data scope (majburiy).**
Self-service rollar uchun parametrlar **majburan** o‘z shaxsiga qayta yoziladi:

| Rol | Qoida |
|-----|-------|
| `agent`, `expeditor`, `collector`, `auditor` | `agent_id`, `expeditor_user_id`, `user_id` parametrlari **o‘z id**siga almashtiriladi |
| `supervisor` | faqat o‘z jamoasi (`supervisees`) — endpoint o‘zi cheklaydi, yordamchi qo‘shimcha `agent_id` qo‘shmaydi |
| boshqa rollar | endpoint scope’i (ombor, kassa, filial) o‘zgarmaydi |

**Qo‘shimcha himoya:**
- **Redaction:** `password`, `password_hash`, `token`, `pinfl`, `inn`, `passport` maydonlari javobdan olib tashlanadi/maskalanadi (`ai.format.ts`).
- **Row cap:** jadvalda 50 qator, eksportda 5000 qator (`AI_MAX_ROWS`, `AI_MAX_EXPORT_ROWS`).
- **Rate limit:** 30 savol/min, 10 tasdiqlash/min (foydalanuvchi bo‘yicha).
- **Timeout:** har tool 15 s (`AI_TOOL_TIMEOUT_MS`).

### 4.4 EXEC (ai.exec.ts)

```ts
app.inject({
  method, url: `/api/${tenantSlug}${path}`,
  headers: { authorization: actor.authorization, "x-tenant-slug": tenantSlug },
  payload
});
```
- `401/403` → `{ status: "denied" }` (foydalanuvchiga «ruxsat yo‘q»).
- `400/404` → `{ status: "error" }` (sabab bilan).
- `2xx` → payload.
- **Hech qachon** xato matni/fayl yo‘li/stack foydalanuvchiga qaytarilmaydi.

### 4.5 FORMAT (ai.format.ts)

Har tool o‘z formatteriga ega. Umumiy javob kontrakti:

```json
{
  "title": "Savdo — 1–12 noyabr",
  "intent": "sales.summary",
  "summary": ["Umumiy savdo: 1 250 000 000 so‘m", "Buyurtma: 143 ta"],
  "groups": [
    { "title": "Savdo", "summary": "143 ta buyurtma", "columns": ["Sana","Savdo","To‘lov","Vozvrat","Sof"], "rows": [["01.11–12.11","1 250 000 000","980 000 000","30 000 000","1 220 000 000"]], "source": "/reports/sales" }
  ],
  "actions": [ { "kind":"confirm", "tool":"write.set_price", "token":"...", "summary":"SKU-001 → 150 000" } ],
  "export": { "format":"xlsx", "url":"/api/test1/ai/exports/<token>", "rows": 143 },
  "denied": [ { "tool":"finance.pnl", "reason":"Ruxsat yo‘q: cash.otchety.view" } ],
  "meta": { "tools":["sales.summary"], "durationMs": 84, "period": {"from":"2026-11-01","to":"2026-11-12"} }
}
```

Eski javob (`title`, `lines`, `groups`) **saqlanadi** — mavjud frontend buzilmaydi.

### 4.6 EXPORT (ai.export.ts)

- Foydalanuvchi «Excel/fayl/csv» desa yoki jadval > 50 qator bo‘lsa — eksport taklif qilinadi.
- Fayl **saqlanmaydi**: token ichida `{tool, params, sub, tid, exp}` imzolangan holda keladi.
- `GET /api/:slug/ai/exports/:token` → token tekshiriladi → **qayta** ruxsat tekshiriladi → tool qayta bajariladi → `xlsx`/`csv` stream.
- Afzalligi: xotira o‘smaydi, PM2 cluster’da ham ishlaydi, token o‘g‘irlansa boshqa foydalanuvchi ocholmaydi (`sub` mos kelishi shart), TTL 10 daqiqa.

### 4.7 WRITE oqimi (2-etap)

```
1) POST /ai/ask  «SKU-001 narxini 150000 qil»
   → intent = write.set_price, params validatsiya
   → guard: role ∈ AI_WRITE_ROLES, permission `settings.tsena.update`
   → preview: mahsulot nomi + eski narx + yangi narx
   → javob: actions[{ kind:"confirm", token, summary }]   (bajarilmadi!)

2) POST /ai/confirm { token }
   → HMAC tekshiruv, exp, sub === joriy user, tenant mos
   → Redis SET NX (bir martalik) — takroriy bajarilish yo‘q
   → exec: PUT /products/:id/prices
   → audit: entity_type=product_price, action=ai.update
   → javob: natija + audit id
```

**Nega 2 bosqich?** LLM/NLU xatosi yoki foydalanuvchi adashib yozishi tizimni buzmasligi uchun. Preview’da nima o‘zgarishi **aniq matn va jadval** ko‘rinishida ko‘rsatiladi.

### 4.8 AUDIT (ai.audit.ts)

`appendTenantAuditEvent` orqali:

| entity_type | action | payload |
|-------------|--------|---------|
| `ai_assistant` | `ask` | `{intent, tools, denied, role}` |
| `ai_assistant` | `preview` | `{tool, params_hash}` |
| `ai_assistant` | `confirm` | `{tool, status, entity_id}` |
| `ai_assistant` | `export` | `{tools, rows, format}` |

`params` auditga **redacted** holda yoziladi (parol/PINFL yo‘q).

---

## 5. Tool registry (joriy holat)

### 5.1 Read tool’lar

| id | Endpoint | Permission (anyOf) |
|----|----------|--------------------|
| `dashboard.stats` | `GET /dashboard/stats` | `dashboard.prodazhi.view` |
| `dashboard.finance` | `GET /dashboard/finance/summary` | `dashboard.finansy.view`, `finance.obzor.view` |
| `sales.summary` | `GET /reports/sales?from&to` | `reports.prodazhi.view` + report guruhi |
| `sales.trend` | `GET /reports/order-trends?from&to` | report guruhi |
| `sales.by_agent` | `GET /reports/agent-orders?from&to` | `reports.zakazy_agentov.view` |
| `sales.by_product` | `GET /reports/product-sales?from&to` | `reports.prodazhi_tovarov.view` |
| `sales.by_client` | `GET /reports/client-sales-2?from&to` | `reports.prodazhi_klientov_2.view` |
| `returns.list` | `GET /reports/expeditor-returns/orders?from&to` | `reports.vozvrat_ekspeditora.view` |
| `finance.receivables` | `GET /reports/client-receivables` | `cash.otchety.view` + report guruhi |
| `finance.cashflow` | `GET /reports/cash-flow?from&to` | `cash.otchety.view` |
| `finance.expenses` | `GET /expenses?from&to` | `cash.rashody_klienta.view` |
| `finance.expenses_summary` | `GET /expenses/summary` | `cash.rashody_klienta.view` |
| `finance.pnl` | `GET /expenses/pnl` | `cash.otchety.view` |
| `finance.cash_desks` | `GET /cash-desks` | `cash.kassa.view` |
| `orders.list` | `GET /orders?page&limit&search` | `orders.zakaz.view` |
| `payments.list` | `GET /payments?page&limit&from&to` | `cash.oplaty_klientov.view` |
| `clients.list` | `GET /clients?search&page&limit` | `clients.klient.view` |
| `products.list` | `GET /products?search&page&limit` | `settings.tovar.view` |
| `stock.balances` | `GET /stock/balances?page&limit` | `warehouse.ostatki.view` |
| `staff.list` | `GET /agents` \| `/operators` \| `/supervisors` \| `/expeditors` \| `/collectors` \| `/auditors` \| `/skladchik` | `staff.<tur>.view` |
| `tasks.list` | `GET /tasks` | task view kaliti |
| `payroll.list` | `GET /payroll/records` | payroll view kaliti |
| `orders.detail` | `GET /orders/:id` | `orders.zakaz.view` |
| `returns.detail` | `GET /reports/expeditor-returns/orders/:id` | report guruhi |
| `consignment.list` | `GET /consignment/agents` | `staff.konsignatsiya.view` |
| `reports.visits` | `GET /reports/visits-2?from&to` | `reports.vizity.view` |
| `stock.transfer` | `GET /orders/consignment-transfers?from&to` | `warehouse.ostatki.view` |
| `price.as-of` | `GET /orders/prices-as-of?search&as_of&limit` | `settings.tovar.view`, `settings.tsena.view` |
| `tabel.marks` | `GET /tabel/marks?year&month` | `tabel.otmetki.view`, `staff.tabel.view` |
| `kpi.plan` | `GET /reports/agent-kpi?from&to` | reports.view + guruh |
| `price.matrix` | `GET /price-matrix/lookup?search&limit` | `settings.tovar.view`, `settings.tsena.view` |

### 5.2 Write tool’lar (faqat preview → confirm)

| id | Endpoint | Permission | Rol |
|----|----------|-----------|-----|
| `write.create_employee` | `POST /agents` (yoki rol turiga qarab) | `staff.agent.create` | admin/operator-like |
| `write.update_employee` | `PATCH /agents/:id` | `staff.agent.update` | admin/operator-like |
| `write.create_client` | `POST /clients` | `clients.klient.create` | admin/operator-like |
| `write.update_client` | `PATCH /clients/:id` | `clients.klient.update` | admin/operator-like |
| `write.create_product` | `POST /products` | `settings.tovar.create` | admin/operator-like |
| `write.set_price` | `PUT /products/:id/prices` | `settings.tsena.update` | admin/operator-like |
| `write.update_settings` | `PATCH /settings/profile` | `settings.profil_kompanii.update` | admin/operator-like |
| `write.create_task` | `POST /tasks` | task create kaliti | admin/operator-like |
| `write.update_product` | `PATCH /products/:id` | `settings.tovar.update` | admin/operator-like |
| `write.order_status` | `PATCH /orders/:id` | `orders.zakaz.update` | admin/operator-like |

> Har bir write tool uchun **majburiy maydonlar** preview bosqichida tekshiriladi; yetishmasa foydalanuvchidan aniqlashtirish so‘raladi (masalan: «qaysi SKU? qaysi narx turi?»).

---

## 6. Intent → javob misollari

**1)** «Shu oy savdo qancha bo‘ldi?»
→ `sales.summary` (01.11–12.11) → jadval: Savdo / To‘lov / Vozvrat / Sof + top agentlar.

**2)** «Qarzdorlar ro‘yxatini Excel qilib ber»
→ `finance.receivables` (limit 100) → jadval + `export.url` (`xlsx`).

**3)** «Yangi agent qo‘sh: Ism Aziz, login aziz1, parol 12345678»
→ `write.create_employee` → preview kartasi + confirm token. Tasdiqlangach `POST /agents`.

**4)** «SKU-001 narxini optom 150000 qil»
→ `write.set_price` → preview: eski narx → yangi narx → confirm.

**5)** «Bugun agentlar nima qildi?» (agent roli bilan)
→ `sales.by_agent`, lekin `agent_id` **o‘z id**siga majburan almashtirilgan → faqat o‘z ma’lumoti.

**6)** «Boshqa agentning qarzini ko‘rsat» (agent roli)
→ guard `denied`: «Sizda faqat o‘z mijozlaringizni ko‘rish ruxsati bor». Ma’lumot **hech qachon** qaytmaydi.

---

## 7. API kontrakti

| Method | Path | Tavsif |
|--------|------|--------|
| `POST` | `/api/:slug/ai/ask` | savol → javob (+ preview/eksport havolasi) |
| `POST` | `/api/:slug/ai/confirm` | `{ token }` → yozish amalini bajarish |
| `GET` | `/api/:slug/ai/exports/:token` | xlsx/csv yuklab olish (token ichida plan) |
| `GET` | `/api/:slug/ai/capabilities` | foydalanuvchi uchun ruxsat etilgan tool’lar |
| `GET` | `/api/:slug/ai/examples` | UI uchun tayyor savol namunalari |

So‘rov:
```json
POST /api/test1/ai/ask
{ "question": "shu oy savdo", "history": [], "export": "xlsx" }
```

Xatoliklar: `400 BadRequest`, `401 Unauthorized`, `403 ForbiddenPermission`, `409 ConfirmAlreadyUsed`, `410 ConfirmExpired`, `429 TooManyRequests`.

---

## 8. 3-etap: dostup tekshiruvi (test rejasi)

| # | Ssenariy | Kutilgan natija |
|---|----------|-----------------|
| 1 | `agent` o‘z savdosi | 2xx, faqat o‘z ma’lumoti |
| 2 | `agent` boshqa agent `agent_id` bilan | parametr o‘z id ga almashtiriladi → boshqa ma’lumot yo‘q |
| 3 | `agent` `finance.pnl` so‘rasa | `denied`, endpoint chaqirilmaydi |
| 4 | `operator` narx o‘zgartirish | ruxsat bo‘lsa preview, tasdiqlashsiz bajarilmaydi |
| 5 | `operator` (`settings.tsena.update` yo‘q) | `denied`, preview ham ko‘rsatilmaydi |
| 6 | Token bilan boshqa foydalanuvchi | `403` (sub mos emas) |
| 7 | Muddati o‘tgan token | `410` |
| 8 | Token ikki marta | `409` |
| 9 | Boshqa tenant slug | `403 CrossTenantDenied` (tenant plugin) |
| 10 | Eksport tokeni boshqa tenantda | `403` |
| 11 | `DELETE` ni so‘rash | «O‘chirish yordamchi orqali mumkin emas» |
| 12 | 5000+ qator eksport | 5000 qator + `truncated: true` |

Unit testlar: `backend/tests/ai-*.pure.test.ts` (intent, dates, plan, guard, token, format, export).

---

## 9. Env / sozlamalar

| Kalit | Default | Ma’nosi |
|-------|---------|---------|
| `AI_ASSISTANT_ENABLED` | `1` | umumiy kill-switch |
| `AI_MAX_ROWS` | `50` | jadvaldagi maksimal qator |
| `AI_MAX_EXPORT_ROWS` | `5000` | fayldagi maksimal qator |
| `AI_TOOL_TIMEOUT_MS` | `15000` | tool timeout |
| `AI_ASK_RATE_MAX` | `30` | savol/min |
| `AI_WRITE_ENABLED` | `1` | yozish tool’lari yoqilgan |
| `AI_EXPORT_TTL_SEC` | `600` | eksport tokeni TTL |
| `AI_CONFIRM_TTL_SEC` | `300` | tasdiqlash tokeni TTL |
| `ASSISTANT_API_KEY` / `LMSTUDIO_URL` | — | ixtiyoriy LLM plan |

---

## 10. Yo‘l xaritasi

- [x] Logika va arxitektura (ushbu hujjat)
- [x] Intent/slot parseri (uz/ru), davr parseri
- [x] Tool registry (read 31, write 10)
- [x] Guard (pre-flight + scope rewrite + redaction)
- [x] Executor (`app.inject`, timeout, denied/error normalizatsiya)
- [x] Formatter (jadval + summary + metrics)
- [x] Eksport (xlsx/csv, imzolangan token)
- [x] Write preview + confirm (HMAC, bir martalik, TTL)
- [x] Audit
- [x] HTTP qatlam + capabilities/examples
- [x] Unit testlar
- [ ] Mobil ilova (`mobile/`) uchun chat ekrani (keyingi bosqich)
- [ ] Ovoz (ASR/TTS) — `salec_local_ai_reja.plan.md` FAZA 4
- [ ] pgvector RAG (FAQ) — FAZA 8
