# ✅ Polki avto bonus — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi)

Erkin polki vozvratida foydalanuvchi faqat **«Дата · всего к возврату»** kiritadi; **«Бонус / баланс»** ustuni faqat o‘qiladigan; preview doim avtomatik; **«Долг бонус»** mijoz balans jadvalida alohida tur sifatida ko‘rinadi.

---

## Tekshiruv buyruqlari

```powershell
# Backend (16 test)
cd backend
npm run polki:verify

# Frontend (8 test + typecheck)
cd frontend
npm run polki:verify
npm run typecheck
```

**Jami:** **24/24** unit test + frontend typecheck ✅

---

## Test to‘plamlari

| To‘plam | Testlar | Nima tekshiradi |
|---------|---------|-----------------|
| `returns-bonus-reverse.preview.test.ts` | 8 | Bonus teskari hisob, dolg bonus qty |
| `returns-bonus-reverse.peresort.test.ts` | 3 | Avto-peresort (same/peresort/mixed) |
| `returns-enhanced.bonus-debt.test.ts` | 2 | `bonusDebtNote`, «Долг бонус · VR-…» |
| `client-balance-ledger.bonus-debt.test.ts` | 2 | Ledger `type_label = Долг бонус` |
| `period-return-route.schema.test.ts` | 1 | Erkin polki POST body (`bonus_debt_amount`) |
| `polki-bonus-balance.logic.test.ts` | 8 | FE display, allocation mode, debt calc |

---

## Amalga oshirilgan funksiyalar

| Band | Holat |
|------|--------|
| Doim yoqilgan preview (`use-polki-auto-bonus.ts`) | ✅ toggle/apply yo‘q |
| O‘qiladigan bonus ustuni (`polki-return-bonus-summary.tsx`) | ✅ input/select yo‘q |
| Avto-peresort (backend preview + FE map) | ✅ |
| Submit: `bonus_debt_amount` + explicit split | ✅ |
| `applyClientBonusDebt` → `client_payments` + movement | ✅ |
| Ledger: `type_label «Долг бонус»` | ✅ |

---

## Asosiy fayllar

| Qatlam | Fayl |
|--------|------|
| FE hook | `frontend/components/orders/order-create/hooks/use-polki-auto-bonus.ts` |
| FE UI | `polki-return-bonus-summary.tsx`, `polki-return-lines-table.tsx` |
| FE logic | `polki-bonus-balance.logic.ts` |
| BE preview | `backend/src/modules/returns/returns-bonus-reverse.preview.ts` |
| BE peresort | `returns-bonus-reverse.peresort.ts` |
| BE debt | `returns-enhanced.bonus-debt.ts` |
| BE ledger | `client-balance-ledger.helpers.ts` |

---

## Qo‘lda smoke (ixtiyoriy)

1. Veb: `/orders/create?type=return&isPolkiFree=1`
2. Mijoz tanlang, qty kiriting → «Бонус / баланс» avtomatik to‘ldiriladi
3. Submit → mijoz kartochkasi → **Балансы** → tur **«Долг бонус»** (qarz bo‘lsa)

Seed stsenariylar: `npm run seed:polki-return-scenarios` (7 stsenariy)

---

*Reja: `.cursor/plans/polki_avto_bonus_ui_bd424d6e.plan.md`*
