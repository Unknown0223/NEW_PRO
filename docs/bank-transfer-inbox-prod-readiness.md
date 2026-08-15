# Bank Transfer Inbox — prod readiness

Bir sahifa — production oldidan. Har bir punkt: `[ ]` → `[x]`.

**Indeks:** [bank-transfer-inbox-README.md](./bank-transfer-inbox-README.md)  
**UAT:** [uat-results.md](./bank-transfer-inbox-uat-results.md)  
**Go-live:** [go-live-checklist.md](./bank-transfer-inbox-go-live-checklist.md)  
**SOP:** [kassir-sop.md](./bank-transfer-inbox-kassir-sop.md)  
**Adapter:** [adapter-contract.md](./bank-transfer-inbox-adapter-contract.md)

| Maydon | Qiymat |
|--------|--------|
| Tenant | _______________ |
| Muhit | [ ] staging [ ] prod |
| Sana | _______________ |
| Owner | _______________ |

---

## Completion status

| # | Punkt | Status | Izoh |
|---|--------|--------|------|
| 1 | `rbac:ensure` + qayta login (`cash.perechisleniya.*`, confirm: `cash.oplaty_klientov.update`) | [ ] | |
| 2 | `audit:client-bank-ids` CSV ko‘rib chiqilgan; INN/счёт **qo‘lda** tuzatilgan | [ ] | |
| 3 | Birinchi real CSV/XLSX import OK | [ ] | |
| 4 | UAT 1–5 PASS — [uat-results](./bank-transfer-inbox-uat-results.md) | [ ] | |
| 5 | Kassir SOP / trening | [ ] | |
| 6 | Mobile: list / assign / create-payment / confirm (import N/A) | [ ] | |
| 7 | 1C/bank: [ ] CSV-only [ ] poll stub/fake [ ] real adapter (**tashqi** credentials) | [ ] | |
| 8 | Smoke: `smoke:bti` + assign + import | [ ] | |
| 9 | Monitoring / rollback reja (qisqa) ma’lum | [ ] | |
| 10 | `.env` da maxfiy kalitlar commit qilinmagan | [ ] | |

---

## Rollback (qisqa)

1. Menyudan foydalanishni to‘xtatish / RBAC dan `cash.perechisleniya.*` ni vaqtincha olib tashlash.
2. Yangi importni to‘xtatish; mavjud pending to‘lovlarni odatiy kassa oqimi bilan yopish.
3. DB: migratsiyani orqaga qaytarish **faqat** DBA bilan (inbox jadvallar).

---

## Yakun

- **Go-live ruxsat:** [ ] HA  [ ] YO‘Q (blok: _______________)
- **UAT fayl to‘ldirilgan:** [ ] ha  [ ] yo‘q
- Imzo: _______________

*Shablon: finish-pass prod readiness.*
