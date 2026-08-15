# Bank Transfer Inbox — 1C / Bank adapter shartnomasi

Hozircha real 1C/bank ulanishi **yo‘q** (**tashqi blok**). Kundalik ish: Excel/CSV/manual →  
`POST /api/:slug/bank-transfer-inbox/ingest` yoki `/import`.

Lokal demo uchun **Fake** adapter bor — credentials kerak emas.

**Indeks:** [bank-transfer-inbox-README.md](./bank-transfer-inbox-README.md)

---

## Adapter interfeysi

Kod: `backend/src/modules/bank-transfer-inbox/bank-transfer-inbox.adapters.ts`

```ts
type BankTransferSourceAdapter = {
  source: "bank_api" | "one_c";
  fetchPending(): Promise<BankTransferIngestItem[]>;
};
```

| Klass | Vazifa |
|--------|--------|
| `StubBankTransferAdapter` | Bo‘sh massiv — hech narsa ingest qilmaydi |
| `FakeBankTransferAdapter` | 3 ta sample qator (exact/unmatched/no-ids) — faqat lokal demo |
| `OneCBankTransferAdapter` | Skeleton — credentials yo‘q bo‘lsa `BankTransferAdapterNotConfiguredError` (`ONEC_*`) |
| `BankApiBankTransferAdapter` | Skeleton — `BANK_API_*` kerak; live HTTP hali wired emas |
| `resolveBankTransferPollAdapter(mode)` | `fake` \| `stub` \| `one_c` \| `bank_api` |
| `ingestFromAdapter(tenantId, adapter, actorUserId?)` | `fetchPending` → `ingestBankTransfers` |

`BankTransferIngestItem` (`contracts/bank-transfer-inbox.schemas.ts`):
- `amount` (majburiy, > 0)
- ixtiyoriy: `external_id`, `currency`, `paid_at`, `payer_name`, `payer_inn`, `payer_pinfl`, `payer_bank_account`, `payer_bank_mfo`, `payer_client_code`, `purpose`, `raw`, `cash_desk_id`

Matcher tartibi o‘zgarmaydi: `bank_account` → `inn`/`pinfl` → `client_code` (**nom bo‘yicha avto-match yo‘q**).

---

## Env (`.env.example`)

```bash
# Poll default OFF
# BANK_TRANSFER_POLL_ENABLED=0
# BANK_TRANSFER_POLL_ADAPTER=fake   # fake | stub | one_c | bank_api

# 1C
# ONEC_BASE_URL=
# ONEC_USER=
# ONEC_PASSWORD=
# ONEC_BANK_TRANSFER_PATH=

# Bank API
# BANK_API_BASE_URL=
# BANK_API_TOKEN=
# BANK_API_TRANSFERS_PATH=
```

---

## Lokal demo (fake)

```bash
cd backend
npm run demo:bti
# ixtiyoriy: TENANT_SLUG=test1 npm run demo:bti
```

Ixtiyoriy poll (default **OFF**):

```bash
BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
BANK_TRANSFER_POLL_ADAPTER=stub BANK_TRANSFER_POLL_ENABLED=1 npm run poll:bank-transfer-inbox
# one_c / bank_api — credentials yo‘q bo‘lsa exit 2 + missing env ro‘yxati (live chaqiriq YO‘Q)
```

---

## Real 1C / bank ulash (keyingi — tashqi)

1. `.env` ga `ONEC_*` yoki `BANK_API_*` qo‘ying (repoga commit qilmang).
2. `OneCBankTransferAdapter.fetchPending` / `BankApiBankTransferAdapter.fetchPending` ichida HTTP + map yozing (`BankTransferIngestItem`, barqaror `external_id`).
3. Cron: `BANK_TRANSFER_POLL_ENABLED=1` + `BANK_TRANSFER_POLL_ADAPTER=one_c|bank_api`.
4. Rate limit / xatoliklarni loglang; muvaffaqiyatsiz qatorlar ingest `error` statusida qaytadi.

**Muhim:** skeleton credentials bo‘lsa ham «LIVE_IMPLEMENTATION_PENDING» tashlaydi — bu ataylab; live deb ko‘rsatilmaydi.

Ingest endpoint (`source: "bank_api" | "one_c"`) qo‘lda/test uchun ochiq qoladi.

---

## Go-live

- [bank-transfer-inbox-go-live-checklist.md](./bank-transfer-inbox-go-live-checklist.md)
- [bank-transfer-inbox-kassir-sop.md](./bank-transfer-inbox-kassir-sop.md)
- [bank-transfer-inbox-uat-results.md](./bank-transfer-inbox-uat-results.md)
- [bank-transfer-inbox-prod-readiness.md](./bank-transfer-inbox-prod-readiness.md)
