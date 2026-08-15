# Bank Transfer Inbox — go-live checklist

**Bajariladigan** ro‘yxat — har bir punktni `[x]` qiling.  
**Indeks:** [bank-transfer-inbox-README.md](./bank-transfer-inbox-README.md)  
**Kassir SOP:** [kassir-sop.md](./bank-transfer-inbox-kassir-sop.md)  
**Adapter:** [adapter-contract.md](./bank-transfer-inbox-adapter-contract.md)  
**UAT:** [uat-results.md](./bank-transfer-inbox-uat-results.md)  
**Prod:** [prod-readiness.md](./bank-transfer-inbox-prod-readiness.md)

| Maydon | Qiymat |
|--------|--------|
| Tenant | _______________ |
| Muhit | [ ] local [ ] staging [ ] prod |
| Sana | _______________ |
| Owner | _______________ |

---

## A. RBAC va ruxsatlar

- [ ] `cd backend && npm run rbac:ensure -- <tenant-slug>`
- [ ] Kalitlar: `cash.perechisleniya.view`, `.import`/`.create`, `.update`; confirm: `cash.oplaty_klientov.update`
- [ ] Admin va kassir **qayta login** (eski JWT yangi permission bermasligi mumkin)
- [ ] Menyuda **Перечисления (банк)** (`/bank-transfers`) ko‘rinadi
- [ ] Ruxsatsiz user: 403 / menyuda yo‘q

---

## B. Mijoz identifikatorlari (audit CSV)

- [ ] `npm run audit:client-bank-ids -- <tenant-slug>`
- [ ] CSV lar: `backend/scripts/out/bank-id-audit-<slug>-*.csv` ko‘rib chiqilgan
- [ ] Missing INN / bank_account / dublikatlar **qo‘lda** tuzatilgan  
  _(skript ommaviy tahrirlamaydi — bu ataylab)_
- [ ] Matcher: `bank_account` → `inn`/`pinfl` → `client_code` (nom bo‘yicha yo‘q)

---

## C. Birinchi CSV / Excel import

- [ ] Bankdan 5–20 qatorli `.csv` / `.xlsx` olingan
- [ ] `/bank-transfers` → **Импорт** → yuklangan
- [ ] Hisobot: yaratildi / dublikat / xato qatorlar OK
- [ ] Majburiy ustun: `сумма` / `amount`

---

## D. UAT ssenariylari (majburiy)

Natijalarni [uat-results.md](./bank-transfer-inbox-uat-results.md) ga yozing.

| # | Ssenariy | Kutilgan | Done |
|---|----------|----------|------|
| 1 | Exact match | `matched` / «Новые»; kerak bo‘lsa **Создать оплату** | [ ] |
| 2 | Ambiguous | `ambiguous`; assign + izoh ≥3 | [ ] |
| 3 | Unmatched | `unmatched`; qidiruv + assign | [ ] |
| 4 | Reassign | Pending + boshqa mijoz; izoh majburiy | [ ] |
| 5 | Confirm block | Confirm dan keyin reassign → **409** | [ ] |

Qo‘shimcha:

- [ ] Izoh < 3 belgi → 400
- [ ] **Игнорировать** faqat keraksiz yozuvlar

---

## E. Smoke (dev / staging)

```bash
cd backend
npm run smoke:bti
npm run smoke:bank-transfer-assign
npm run smoke:bank-transfer-import
npm run demo:bti
```

- [ ] `smoke:bti` PASS
- [ ] `smoke:bank-transfer-assign` PASS (`ASSIGN_SMOKE_DONE`)
- [ ] `smoke:bank-transfer-import` PASS (`IMPORT_SMOKE_DONE`)
- [ ] (ixtiyoriy) `demo:bti` OK

Poll (default OFF — live 1C emas):

```bash
BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
```

---

## F. Go-live kuni

- [ ] A–E bajarilgan
- [ ] UAT 1–5 PASS → [uat-results](./bank-transfer-inbox-uat-results.md)
- [ ] Kassir SOP o‘qilgan / qisqa trening
- [ ] 1C/bank: [ ] CSV-only (hozir) [ ] credentials keyin (**tashqi**)
- [ ] [Prod readiness](./bank-transfer-inbox-prod-readiness.md) to‘ldirilgan
- [ ] **Go-live ruxsat:** [ ] HA  [ ] YO‘Q — sabab: _______________

---

*Oxirgi yangilanish: finish-pass executable checklist.*
