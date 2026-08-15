# Bank Transfer Inbox (Перечисления / банк) — indeks

Oddiy yo‘riqnoma: bank o‘tkazmalarini mijozga bog‘lash va to‘lovni tasdiqlash.

| | |
|--|--|
| **Web** | `/bank-transfers` |
| **Mobile** | Kassir → **Перечисления (банк)** (import — faqat web; qo‘lda kiritish — web) |
| **RBAC** | `cash.perechisleniya.view` / `.import`|`.create` / `.update` (+ confirm: `cash.oplaty_klientov.update`) |

---

## Ikki kanal (muhim)

| Kanal | UI | `source` | Qanday ishlaydi |
|-------|-----|----------|-----------------|
| **Вручную** (`channel=manual`) | «Вручную» | `manual` | Kassir summa + mijoz + sana + izoh → pending to‘lov |
| **Банк / 1С** (`channel=bank_verified`) | «Банк / 1С» | `excel` / `csv` / `bank_api` / `one_c` | Import yoki adapter → match/assign → pending → tasdiq |

API filtr: `?channel=manual` yoki `?channel=bank_verified` (list + counts).  
To‘lovlar: `GET /payments?transfer_channel=manual|bank_verified` (inbox orqali yaratilganlar).  
Payment note: `[bank_transfer_inbox #id channel=… source=…]`.

---

## Hujjatlar

| Fayl | Mazmun |
|------|--------|
| [kassir-sop.md](./bank-transfer-inbox-kassir-sop.md) | Kundalik ish (kassir) |
| [go-live-checklist.md](./bank-transfer-inbox-go-live-checklist.md) | Chiqish oldidan checklist |
| [uat-results.md](./bank-transfer-inbox-uat-results.md) | UAT natija shabloni (to‘ldiriladigan) |
| [prod-readiness.md](./bank-transfer-inbox-prod-readiness.md) | 1 sahifa prod tayyorlik |
| [adapter-contract.md](./bank-transfer-inbox-adapter-contract.md) | Fake / Stub / 1C / Bank skeleton + poll |

---

## Faza holati (kod)

| Faza | Holat | Izoh |
|------|--------|------|
| 0 Audit INN/hisob | **100% kod** | `npm run audit:client-bank-ids` — CSV; **mass-edit yo‘q** |
| 1–5 Inbox MVP | **100% kod** | ingest/import/assign/reassign/ignore/create-payment + RBAC + web |
| 5b Ikki kanal | **100% kod** | `channel` + manual create + UI toggle + mobile badge/filter |
| 6 Mobile | **100% kod** | list/detail/assign/reassign/create-payment/ignore/comment/confirm; **import N/A (faqat web)** |
| 7 1C/Bank adapter | **100% tayyorgarlik** | Skeleton + env; **tashqi blok**: haqiqiy credentials + HTTP wire |
| 8 Docs / go-live | **100% shablon** | SOP + checklist + UAT + prod readiness — odamlar to‘ldiradi |

**Tashqi blok (siz / IT):**

1. 1C yoki bank API kalitlari (`ONEC_*` / `BANK_API_*`) + HTTP implementatsiya
2. `rbac:ensure` + **qayta login**
3. Audit CSV bo‘yicha mijoz ma’lumotlarini **qo‘lda** tuzatish
4. Real UAT (5 ssenariy) va prod readiness belgilash

---

## Rasmiy buyruqlar (`backend/`)

```bash
# Faza 0 — INN / hisob auditi (CSV → scripts/out/). Mass-edit YO‘Q.
npm run audit:client-bank-ids -- <tenant-slug>
# alias: npm run audit:bti-bank-ids -- <tenant-slug>

# Testlar
npx vitest run tests/bank-transfer-inbox.matcher.pure.test.ts
npx vitest run tests/bank-transfer-inbox.adapters.pure.test.ts
npx vitest run tests/bank-transfer-inbox.channel.pure.test.ts
npx vitest run tests/bank-transfer-inbox.integration.test.ts   # DB marker kerak

# Smoke
npm run smoke:bti
npm run smoke:bank-transfer-assign
npm run smoke:bank-transfer-import   # yoki smoke:bti:import

# Lokal fake demo (1C kerak emas)
npm run demo:bti

# Poll (default OFF)
BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
# BANK_TRANSFER_POLL_ADAPTER=fake|stub|one_c|bank_api
```

RBAC:

```bash
npm run rbac:ensure -- <tenant-slug>
```

---

## Credentials keyinroq (Faza 7)

1. `backend/.env.example` dagi `ONEC_*` yoki `BANK_API_*` ni `.env` ga ko‘chiring.
2. `OneCBankTransferAdapter` / `BankApiBankTransferAdapter` ichida HTTP map yozing (hozir — aniq «not configured» / «implementation pending»).
3. Poll: `BANK_TRANSFER_POLL_ENABLED=1` + `BANK_TRANSFER_POLL_ADAPTER=one_c|bank_api`.
4. **Fake** faqat lokal demo — prodda live deb o‘ylamang.

Batafsil: [adapter-contract.md](./bank-transfer-inbox-adapter-contract.md)

---

## Mobile DoD

- [x] Ro‘yxat, detail, assign, reassign, confirm
- [x] Matched → **Создать оплату**
- [x] Ignore + comment
- [x] Empty / error / permission UI
- [x] Kanal badge + filtr (**Вручную** / **Банк / 1С**)
- [ ] CSV/Excel import — **N/A (faqat web)** — qabul qilingan DoD
- [ ] Qo‘lda yaratish forma — **web**; mobile — filtr/badge

---

*Indeks: Bank Transfer Inbox finish-pass + ikki kanal.*
