# SALEC — Taklifiy reja web prototipi

Bu paket `Планы` bo‘limiga qo‘shiladigan **«Taklifiy reja»** sahifasining mustaqil, to‘liq interaktiv prototipi. U `@salec/plans-proposal` hisoblash yadrosidan foydalanadi.

## Muhim chegara

- Ma’lumotlar **sintetik**. Real mijoz/agent ma’lumotlari yo‘q.
- Backend, PostgreSQL va mavjud Next.js panelga ulanmagan.
- Bitta umumiy draft va audit tarixi faqat shu brauzer `localStorage` xotirasiga avtomatik yoziladi (v3). Shaxsiy nusxalar yo‘q.
- «Установка планов», tasdiqlash holatlari va production rejalari o‘zgarmaydi.
- Sana demo uchun **2026-11-14** ga mahkamlangan; Noyabr manbasi ataylab MTD.

## Ishga tushirish

```bash
# repo ildizidan
npm install
npm run plans:proposal:demo
```

Yoki faqat shu paket:

```bash
npm install --prefix packages/plans-proposal-demo
npm run dev --prefix packages/plans-proposal-demo
```

Port: `5175`, host: `0.0.0.0`. Arena live preview shu portni ochadi.

## Nimalarni sinash mumkin

1. Maqsad oyi/yili, yo‘nalish va manba oyini tanlash. Bir yo‘nalishdagi barcha KPI ustunlari ko‘rinadi; keraksiz ustunni yashirish mumkin.
2. Filial bloklari default yig‘ilgan. Filialni oching → supervayzer blokini oching. Bitta blok ochilsa, avvalgisi yopiladi.
3. Jadval katagini bosing: modal/popover emas, o‘sha ustun yon tomonga kengayib inline editor ochiladi. Asos (fakt/eski reja), usul (% yoki so‘m) va qiymatni kiriting. Enter saqlaydi, Escape yopadi.
4. Katak, agent, KPI ustuni, supervayzer bloki yoki filial checkboxlari bilan katak darajasida tanlang. Expanded editor ichida «Ustunni tanlash» va «Blokda hammasini tanlash» bor. Ommaviy panel faqat tanlangan kataklarga formulani qo‘llaydi.
5. KPI ustuni tepasidagi «Hammasiga» tugmasi shu supervayzer bloki doirasida joyida ochiladi va faqat o‘sha blokning ochiq kataklariga bittada o‘rnatadi. Qo‘lda/chiqarilgan/no-faol kataklar o‘tkazib yuboriladi.
6. Qator tafsilotida sabab bilan qo‘lda reja kiritish, reset, hisobdan chiqarish.
7. MTD banneri, ish kunlari prognozi, yaxlitlash, katta o‘sish/outlier ogohlantirishlari. **Sof fakt yo‘q yoki 0/manfiy bo‘lgan katakda** oddiy katak va inline editor ichida eski reja summasi ko‘rsatiladi; «Eski rejaga o‘tish» tugmasi uni asos qilib oladi.
8. **Takliflar natijasi (backtest):** yopilgan oy uchun beshta taklif usuli haqiqiy fakt bilan solishtiriladi — «o‘zini oqladi / oqlanmadi · yuqori / past / ma’lumot yo‘q» ro‘yxati saqlanadi; xodim × KPI og‘ishlari ham KPI ustunli, ierarxiya blokli matritsaga o‘tdi (yopiq jami fakt, kengayganda 5 usul + eng yaqin usul).
9. **Umumiy draft matritsasi:** davr + yo‘nalish uchun hamma uchun bitta tayyor jadval. KPI nomlari qatorda takrorlanmaydi — tepada ustun sarlavhalari; `filial → supervayzer → xodim` bloklari yig‘iladi; yopiq blokda KPI kesimidagi jami va umumiy total ko‘rinadi. KPI ustuni bosilsa 6 ta tafsilot ustuni (`MANBA FAKT · FORMULA · TAKLIF · HOLAT · OXIRGI O‘ZGARTIRISH · AMALLAR`) KPI ichida gorizontal surilib ochiladi; xodim/blok va JAMI ustunlari qotib qoladi. Joyida tahrirlash, o‘chirish/tiklash, katak tarixi, sahifa yangilanganda saqlanish va JSON import/eksport saqlangan.
10. **Audit tarixi:** har bir xodim × KPI uchun bitta «Tarix» tugmasi (kim / qachon / nima / avval → keyin) va umumiy tarix jadvali + Tarix CSV.
11. CSV eksport: KPI nomi, manba, formula, qoida, sabab, ogohlantirish va tayyorlik belgisi.
12. Mobil kenglikda navigatsiya va gorizontal jadval scroll; ikkala matritsada kengaygan KPI tafsilotlari ichki scroll maydonida, xodim va JAMI ustunlari sticky.

## Tekshiruv

```bash
npm run plans:proposal:test
npm run test:e2e --workspace=@salec/plans-proposal-demo
```

Unit: yadro 32 ta + demo 28 ta; E2E: 17 ta brauzer oqimi.

E2E uchun bir marta `npx playwright install chromium` (shu paket ichida). Sandboxda maxsus Chromium yo‘li `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` orqali berilishi mumkin.

## Tuzilma

- `src/data/demo-data.ts` — deterministik sintetik agent/KPI/fakt/reja dataset.
- `src/hooks/use-proposal.ts` — holat, undo, hisob, eksport; har o‘zgartirishni umumiy draftga yozadi.
- `src/hooks/use-shared-draft.ts` — davr + yo‘nalish uchun yagona draft va avtomatik saqlash.
- `src/hooks/use-selection.ts` — katak darajasidagi tanlov; yashirilgan/himoyalangan kataklarni avtomatik tozalaydi.
- `src/hooks/use-formula-fields.ts` — inline/ustun/ommaviy editorlar uchun umumiy formula draft va validatsiya.
- `src/lib/audit.ts` — konfiguratsiya diff'i, katak tarixi, audit CSV; `src/lib/storage.ts` — v3 shared draft + v2 migratsiya.
- `src/components/outcome-panel.tsx` — backtest xulosasi; `outcome-matrix.tsx` + `outcome-cells.tsx` — natijalar matritsasi; `drafts-panel.tsx` — umumiy draft; `draft-matrix.tsx` + `draft-cells.tsx` + `draft-row-editor.tsx` — draft matritsasi; `audit-history.tsx` — tarix jadvali va katak modal.
- `../plans-proposal/src/outcome.ts` — framework-free backtest hisobi (`buildOutcomeReport`).
- `src/components/` — sidebar, kontekst, KPI ustunlari, filial bloklari, joyida kengayuvchi katak/ustun editorlari, ommaviy panel, tafsilot, draft va analiz.
- `src/lib/grouping.ts` — hisob-kitob sahifasi uchun agent × KPI matritsasi, filial/SVR rollup va filtrlash; `src/lib/draft-rows.ts` — umumiy draft, `src/lib/outcome-rows.ts` — backtest natijalari uchun xodim × KPI qatorlari va filial/SVR/agent blok totalari.
- `src/lib/source.ts` — fakt yaroqliligi va qabul qilingan eski rejani aniqlash.
- `src/lib/selection.ts` — katak identifikatorlari, tanlash holati va faqat tanlangan kataklarga formula yozish.
- `tests/unit/{selection,audit,source,config-ops,draft-rows,outcome-rows}.test.ts` — tanlash, diff, katak tarixi, fakt/eski reja, config va ikkala matritsa testlari.
- `tests/e2e/proposal.spec.ts` — brauzer orqali asosiy oqimlar.

Biznes va texnik reja: `docs/PLANS_TAKLIFIY_REJA_ANALIZ_VA_REJA.md`.
