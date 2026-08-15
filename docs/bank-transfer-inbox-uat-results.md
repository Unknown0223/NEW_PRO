# Bank Transfer Inbox — UAT natija shabloni

**Indeks:** [bank-transfer-inbox-README.md](./bank-transfer-inbox-README.md)

| Maydon | Qiymat |
|--------|--------|
| Tenant | _______________ |
| Sana | _______________ |
| Tekshiruvchi | _______________ |
| Muhit | [ ] local  [ ] staging  [ ] prod-like |

Havolalar: [go-live](./bank-transfer-inbox-go-live-checklist.md) · [prod readiness](./bank-transfer-inbox-prod-readiness.md) · [SOP](./bank-transfer-inbox-kassir-sop.md) · [adapter](./bank-transfer-inbox-adapter-contract.md)

---

## Ssenariylar (to‘ldiring)

| # | Ssenariy | Qanday | Kutilgan | Natija | Izoh / evidence |
|---|----------|--------|----------|--------|-----------------|
| 1 | Exact match | Unikal INN/счёт → import yoki `demo:bti` → **Новые** | `matched`; ixtiyoriy **Создать оплату** | [ ] PASS [ ] FAIL | |
| 2 | Ambiguous | Ikki mijozda bir xil INN/hisob | `ambiguous`; assign + izoh ≥3 | [ ] PASS [ ] FAIL | |
| 3 | Unmatched | Noma’lum INN / identifikatorsiz | `unmatched`; qidiruv + assign | [ ] PASS [ ] FAIL | |
| 4 | Reassign | Pending → boshqa mijoz + izoh | Yangi mijoz; pending to‘lov | [ ] PASS [ ] FAIL | |
| 5 | Confirm block | Confirm → qayta reassign | **409** | [ ] PASS [ ] FAIL | |
| 6 | Comment min | Izoh 1–2 belgi | **400** | [ ] PASS [ ] FAIL | |
| 7 | RBAC | Ruxsatsiz user | Menyuda yo‘q / **403** | [ ] PASS [ ] FAIL | |
| 8 | Mobile | Перечисления: list/assign/create-payment/confirm; import N/A | MVP OK | [ ] PASS [ ] FAIL [ ] N/A | |

---

## Avtomatik smoke (dev)

```bash
cd backend
npm run smoke:bti
npm run smoke:bank-transfer-assign
npm run smoke:bank-transfer-import
npm run demo:bti
npm run audit:client-bank-ids -- <tenant-slug>
```

| Buyruq | Natija | Sana |
|--------|--------|------|
| smoke:bti | [ ] PASS [ ] FAIL | |
| smoke:assign | [ ] PASS [ ] FAIL | |
| smoke:import | [ ] PASS [ ] FAIL | |
| demo:bti | [ ] PASS [ ] FAIL [ ] N/A | |
| vitest BTI | [ ] PASS [ ] FAIL | |

Fake poll (default OFF):

```bash
BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
```

---

## Yakun

- [ ] UAT 1–5 hammasi PASS
- [ ] Go-live checklist F belgilangan
- [ ] Prod readiness to‘ldirilgan
- Bloklovchi muammolar: _______________________
- Imzo / owner: _______________________

*Shablon: finish-pass UAT.*
