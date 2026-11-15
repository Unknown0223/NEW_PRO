# SALEC — «Taklifiy reja» moduli: analiz, biznes mantiq va integratsiya rejasi

Sana: 2026-11-14. Holat: **P0 v5 — interaktiv web prototip tayyor**. Production DB, API va mavjud «Установка планов» hali o‘zgartirilmagan.

V5 da qo‘shildi: «Reja ssenariylari» sahifasi butunlay olib tashlandi, o‘rniga yopilgan oy backtest'i asosida «qaysi taklif o‘zini oqladi / oqlanmadi» ro‘yxati; «Taklifiy reja draftlari» o‘rniga davr + yo‘nalish uchun **hamma uchun bitta** tayyor jadval (qatorni tahrirlash, o‘chirish, tiklash); har bir xodim × KPI uchun bitta tarix tugmasi va umumiy «kim / qachon / nima» audit jadvali. Eski v2 draftlar v3 ga migratsiya qilinadi, ssenariy turlari yadrodan olib tashlandi. V4 da editorlar ixchamlashtirildi. V3 da qo‘shildi: katak bosilganda modal/popover emas, o‘sha ustun yon tomonga kengayib ochiladigan inline editor; katak/agent/ustun/blok/filial darajasida tanlash va expanded editor ichida «blokda hammasini tanlash»; KPI ustuni tepasida faqat shu supervayzer blokiga bittada o‘rnatish; ishlamaydigan dekorativ navigatsiya va ishlatilmaydigan fayl/funksiyalar tozalandi. V2 dan: ko‘p KPI ustunlari, filial → supervayzer akkordeon (default collapsed, single-open), rollup, lazy render + memoizatsiya + sahifalash, draft v2.

## 1. Qisqa xulosa

Talab qilingan oqim: maqsad oyi + yo‘nalish + KPI tanlanadi → tizim shu KPIga aloqador xodimlar bo‘yicha fakt va eski rejani chiqaradi → umumiy yoki tanlangan xodimlar uchun qoida beriladi → taklif jadvalda jonli hisoblanadi → tekshiriladi → draft saqlanadi → keyin bosqichma-bosqich asosiy rejaga ko‘chiriladi.

Asosiy to‘rt formula:

| Asos           | Usul  | Formula                       | Misol                    |
| -------------- | ----- | ----------------------------- | ------------------------ |
| KPI sof fakti  | Foiz  | `fact × (1 + P/100)`          | 100 mln +10% = 110 mln   |
| KPI sof fakti  | Summa | `fact + S`                    | 100 mln +5 mln = 105 mln |
| Eski oy rejasi | Foiz  | `previous_plan × (1 + P/100)` | 90 mln +10% = 99 mln     |
| Eski oy rejasi | Summa | `previous_plan + S`           | 90 mln +5 mln = 95 mln   |

Muhim qaror: **taklif hisobi alohida, davr va yo‘nalish bo‘yicha bitta umumiy draft**. Shaxsiy nusxalar yo‘q; har bir mutatsiya darhol saqlanadi va audit jurnaliga yoziladi. U tasdiqlangan rejani jimjitlik bilan almashtirmaydi. Qo‘lda tuzatish sababi, manba snapshoti, qoida va audit izi saqlanadi.

## 2. Mavjud loyiha analizi

### 2.1 Arxitektura

| Qatlam      | Texnologiya                       | Modul uchun ahamiyati                                                                              |
| ----------- | --------------------------------- | -------------------------------------------------------------------------------------------------- |
| `backend/`  | Fastify, Prisma, PostgreSQL, Zod  | Hisob, manba snapshot, RBAC, atomik ko‘chirish shu yerda bo‘lishi kerak                            |
| `frontend/` | Next.js, TanStack Query, Tailwind | `/plans/...` sahifalari, filtrlar, jadval, import/eksport UI                                       |
| `mobile/`   | Flutter                           | Tasdiqlangan/pending KPI rejasi agentga ko‘rinadi; yangi modul mobil hisobni buzmasligi kerak      |
| `packages/` | Framework-free yadrolar + demo    | Yangi `@salec/plans-proposal` yadro va `@salec/plans-proposal-demo` shu pattern bo‘yicha qo‘shildi |

### 2.2 Reja modeli va oqimi

- `KpiGroup` — KPI guruhi; `KpiGroupProduct` mahsulotlarni, `KpiGroupAgent` xodimlarni bog‘laydi.
- `SalesKpiPlan` — `tenant × year × month × trade_direction × kpi_group` bo‘yicha yagona reja.
- `SalesKpiPlanTarget` — xodim × reja; `cost`, `count`, `volume`, `acb`, `order_count`, `comment`, `status`, `work_slot_id`.
- Amaldagi oqim: `draft → pending_approval → approved`; `return` approved/pending ni draftga qaytaradi.
- Dashboard va kunlik KPI odatda `approved + pending_approval` ni rasmiy/ishchi reja sifatida oladi.
- «Настройка утверждающих» yo‘nalish × supervayzer zanjirini saqlaydi; yangi modul Yakuniy tasdiqda shu zanjirni qayta ishlatishi kerak.

### 2.3 Aniqlangan muhim joylar

1. **Fakt ta’riflari har xil.** `plans.daily-kpi.day-matrix.ts` savdoni `orders.created_at` bo‘yicha yig‘adi; `payroll-kpi-fact.ts` yetkazilgan (`delivered_at`) qatorlar va qaytarishlar taqsimotidan foydalanadi. Yangi oylik taklif uchun bitta kanonik kontrakt tanlanmasa, foydalanuvchi turli bo‘limlarda turli «fakt» ko‘radi.
2. **KPI a’zoligi bo‘sh bo‘lsa eski modullar «hammaga ochiq» deb talqin qiladi.** Taklifda bu xavfli: bo‘sh a’zolik = alohida diagnostika, avtomatik ommaviy reja emas.
3. **Bir xodim — bir mahsulot — bitta faol KPI guruhi** qoidasi mavjud (`assertUniqueKpiProducts`). Taklif ham double-count qilmasligi kerak.
4. **`GET /plans/setup` yashirin yozuv qiladi:** `ensurePlansAndTargets()` draft reja/targetlarni yaratadi. Yangi analiz endpointi read-only bo‘lishi kerak.
5. **`work_slot_id` dual-write bosqichida.** Target unique hozir `plan_id + user_id`; bir xodimning ikki ish o‘rni kelajakda muammo bo‘lishi mumkin. Prototip kaliti `user_id:work_slot_id`, production migratsiyasi alohida qaror.
6. **Agent bo‘lmagan xodimlar** KPI a’zosi bo‘lishi mumkin, lekin monitoring aggregatlari ko‘pinca `role='agent'` filtrlaydi. P1 da qamrov aniq belgilanadi; prototip asosan agentlar bilan.
7. **Pul aniqligi.** Prisma Decimal ishlatiladi. Yangi yadro JS float emas, integer minor birlik (`tiyin`) va BigInt bilan hisoblaydi.

## 3. Biznes mantiq — to‘liq qoidalar

### 3.1 Kontekst va manba

- Maqsad: `year + month`, yo‘nalish, KPI guruhi, metrika. P0 faqat `cost` (UZS summa).
- Manba oyi default `maqsad − 1 oy`; foydalanuvchi oldingi 6 oydan birini tanlay oladi. Yanvar → oldingi yil Dekabr.
- Fakt: tanlangan KPI mahsulotlari bo‘yicha sof savdo. Qaytarish, bonus qatorlar va bekor qilingan zakazlar siyosati kanonik fakt kontraktida qayd etiladi.
- Eski reja: ayni tenant/yo‘nalish/KPI/xodim/manba oyidagi target. Default faqat `approved`; `pending_approval` qo‘shish — alohida opt-in.
- Oy yopilgan/yopilmaganligi aniq ko‘rsatiladi. MTD to‘liq oy sifatida ishlatilmaydi.

### 3.2 Qamrov va ustuvorlik

1. **Hisobdan chiqarish** — qator umuman yakuniy summadan chiqadi.
2. **Qo‘lda qiymat + sabab** — barcha formulalardan ustun; sababsiz saqlanmaydi.
3. **Jadval katak formulasi** — agent × KPI katakchasida bevosita kiritilgan `cellFormulas`; tanlangan kataklar, ustun tepasidagi blok amali va filial/blok ommaviy formulasi ham shu qatlamga yoziladi.
4. **Maxsus qoidalar** — faol qoidalar ro‘yxatida _oxirgi mos qoida_ yutadi. Qoidalar ketma-ket qo‘shilib ketmaydi.
5. **Umumiy qoida** — maxsus qoida topilmasa, KPIga biriktirilgan barcha faol xodimlarga.

Qoida qamrovi: `all` yoki aniq `employeeIds`; ixtiyoriy filial va supervayzer filtrlari bilan **AND**. «Tanlanganlarga qoida» tugmasi jadval checkboxlaridan aniq ID ro‘yxatini oladi. KPI/yo‘nalish o‘zgarsa maxsus qoidalar va manual qiymatlar tozalanadi — boshqa kontekstga tasodifan o‘tib ketmaydi.

**Ommaviy summa semantics:** «+5 mln» har bir tanlangan katakning o‘z asosiga +5 mln qo‘shadi; 5 mln ni guruhga bo‘lib bermaydi. «+10%» har bir katakning o‘z asosiga 10%. Tanlov `kpiId + employeeKey` katak identifikatorlari bilan saqlanadi; yashirilgan KPI, manual, excluded, nofaol yoki bog‘lanmagan kataklar tanlovdan tushadi va ommaviy yozuvda o‘tkazib yuboriladi. Ustun tepasidagi «Hammasiga» faqat ochiq supervayzer bloki satrlariga qo‘llanadi, boshqa filial/bloklarga emas. Jadval filtri faqat ko‘rinishni o‘zgartiradi; aniq `employeeIds` qoidasi filtr o‘zgarganda ham o‘sha IDlarda qoladi. `all` qoida esa joriy KPI a’zoligiga dinamik bog‘liq.

### 3.3 Aralash misol

Maqsad: Dekabr 2026, manba: Oktabr 2026, KPI: «Asosiy assortiment».

| Xodim | Sof fakt | Eski reja | Qo‘llangan qaror                       |     Taklif |
| ----- | -------: | --------: | -------------------------------------- | ---------: |
| A     |  100 mln |    90 mln | Umumiy: fakt +10%                      |    110 mln |
| B     |   80 mln |    85 mln | Maxsus: eski reja +5 mln               |     90 mln |
| C     |  120 mln |   100 mln | Ikki mos qoida; oxirgisi fakt +20%     |    144 mln |
| D     |   70 mln |    65 mln | Qo‘lda 75 mln, sabab: «hudud kengaydi» |     75 mln |
| E     |     yo‘q |    60 mln | Fakt yo‘q, manual kiritilmagan         | bloklanadi |

Jami tayyor taklif = 419 mln. E bloklanadi, lekin yo‘qolmaydi. D ning sababi audit/CSVda qoladi. B va C ga qoida «ketma-ket qo‘shish» emas — har biri bitta g‘olib formuladan hisoblanadi.

### 3.4 Hisob va yaxlitlash

- Foiz: `base × (10000 + bps) / 10000`, bu yerda `bps = P × 100`; yarim birlik yuqoriga (half-up).
- Summa: `base + S`; `S` manfiy bo‘lishi mumkin.
- Oraliq natija manfiy bo‘lsa 0 ga clamp; yakuniy 0 reja bloklanadi va qo‘lda tuzatish talab qiladi.
- Faqat yakuniy qiymat qadamga yaxlitlanadi (1 / 100 / 1 000 / 10 000 so‘m). Oraliq hisob yaxlitlanmaydi.
- Foiz chegarasi: −100%…+1000%, ko‘pi bilan 2 kasr. Summa UZS, 2 kasrgacha.
- MTD prognozi opt-in: `net × jami_ish_kuni / o‘tgan_ish_kuni`. Bu **prognoz**, fakt emas; eski rejaga qo‘llanmaydi. P0 demo ish kunlari umumiy, productionda agent jadvali/ta’til/istisnolaridan olinadi.

### 3.5 Ma’lumot sifati

| Holat                                         | Natija                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| Fakt yo‘q / eski reja yo‘q                    | `null`, bloklanadi; 0 deb taxmin qilinmaydi                                     |
| Fakt yoki reja aniq 0                         | Ogohlantirish; foizli 0 natija bloklanadi, summa qo‘shilsa musbat natija mumkin |
| Qaytarish savdodan katta                      | Hisob asosi 0, ogohlantirish                                                    |
| Eski reja draft / maqom filtriga tushmagan    | Bloklanadi yoki manual bilan hal qilinadi                                       |
| Xodim nofaol / KPIga bog‘lanmagan             | Bloklanadi, jami summaga kirmaydi                                               |
| MTD manba                                     | Ogohlantirish; prognoz faqat opt-in                                             |
| Eski reja fakt snapshotidan keyin yangilangan | «Qayta hisoblang» ogohlantirishi                                                |
| Natija asosga nisbatan chegaradan katta o‘sdi | Ogohlantirish; avtomatik kesilmaydi                                             |
| Fakt oxirgi 3 oy medianasidan >2×             | Outlier ogohlantirishi                                                          |
| Qo‘lda qiymat                                 | Sabab majburiy; manba yetishmasa ogohlantirish qoladi, lekin to‘siq olinadi     |

Jami taklif, jami asos va solishtirish summalariga **faqat tayyor qatorlar** kiradi. Bloklangan qatorlar yo‘qolmaydi — jadvalda «Ma’lumot kerak» bo‘lib qoladi.

## 4. Yaxshilangan UX va qo‘shimcha takliflar

### 4.1 P0 da allaqachon bor

Kontekst tanlash; manba holati banneri; 4 formula; ko‘p KPI ustunlari va ustun yashirish; katak bosilganda joyida yon tomonga kengayuvchi inline editor (modal emas); katak/agent/ustun/blok/filial tanlovi va bir nechta katakni birdan o‘zgartirish; KPI ustuni tepasida faqat shu blokka ommaviy o‘rnatish; filial → supervayzer yig‘iladigan bloklari (default collapsed, bitta ochiq blok); filial/blok rollup summalar; qidiruv va holat filtri; qator tafsiloti; sababli manual; hisobdan chiqarish; undo; MTD prognoz; yaxlitlash; outlier/katta o‘sish nazorati; oqlash backtest sahifasi (5 usul × yopilgan oy fakti) va uning **KPI ustunli natijalar matritsasi**; bitta umumiy draft v3 **KPI ustunli matritsasi** (filial → supervayzer → xodim bloklari, yopiq total, KPI bosilganda 6 tafsilot ustuni ichki gorizontal scroll bilan, tahrir/o‘chirish/tiklash); har katak uchun tarix tugmasi va umumiy audit jadvali + CSV; JSON import/eksport; KPI-li CSV; sinov checklist va takliflar paneli.

Unumdorlik: hisob `useMemo` bilan faqat input/config o‘zgarganda qayta ishlaydi; matritsa va bloklar memoizatsiya qilingan; faqat ochiq supervayzer bloki jadvali render qilinadi; katta bloklar 40 tadan sahifalanadi; inline katak va jadval komponentlari `memo`; bir vaqtda faqat bitta katak yoki ustun editori kengayadi. Default collapsed holat birinchi ochilishda yuzlab kataklarni DOMga chiqarmaydi. Ishlatilmaydigan `formula-editor`, dekorativ sidebar bandlari va orphan format/grouping funksiyalari olib tashlandi.

### 4.2 V5 qarorlari (demo)

- **Oqlash mezoni:** target = yopilgan oy, source = oldingi oy. Beshta usul (fakt +10%, fakt +5%, eski reja, 3 oy medianasi, joriy umumiy draft qoidalari) source ma’lumotlari bilan hisoblanib, target oyining haqiqiy sof fakti bilan solishtiriladi. Farq ±5% (sozlanadi: 3/5/8/10/15) ichida «o‘zini oqladi», undan katta «yuqori/past», fakt yo‘q bo‘lsa «ma’lumot yo‘q». Usul xulosasi 60% dan yuqori aniqlikda oqlagan deb topiladi.
- **Natijalar matritsasi:** usullar xulosasi jadvali saqlanadi; xodim × KPI natijalari KPI ustunli, `filial → supervayzer → xodim` blokli matritsada. Yopiq holda jami haqiqiy fakt va joriy draft bo‘yicha oqlagan kataklar soni; KPI bosilganda `HAQIQIY FAKT · 5 USUL · ENG YAQIN USUL` ustunlari shu KPI ichida gorizontal surilib ochiladi, xodim va JAMI ustunlari sticky.
- **Bitta umumiy draft:** kalit `tenant:direction:YYYY-MM`. KPI nomlari har qatorda takrorlanmaydi: tepada KPI ustunlari, `filial → supervayzer → xodim` yig‘iladigan bloklari va yopiq holda KPI kesimidagi jami/umumiy total. KPI ustuni bosilsa `MANBA FAKT · FORMULA · TAKLIF · HOLAT · OXIRGI O‘ZGARTIRISH · AMALLAR` ustunlari shu KPI ichida gorizontal surilib ochiladi; xodim va JAMI ustunlari sticky. Joyida formula editori, o‘chirish/tiklash va katak tarixi saqlanadi; o‘chirish qatorni `removed` ro‘yxatiga o‘tkazadi.
- **Fakt yo‘q bo‘lganda eski reja:** sof fakt `null`, `0` yoki manfiy bo‘lsa, yadro uni 0 ga tenglashtirmaydi va bloklaydi; demo katak/editorida esa mavjud tasdiqlangan eski reja summasi ko‘rsatiladi, «Eski rejaga o‘tish» tugmasi formulani `previous_plan` asosiga o‘tkazadi. Avtomatik jim fallback qilinmaydi — foydalanuvchi aniq tanlaydi.
- **Audit:** demo aktori `Planlovchi` (bitta foydalanuvchi). Har bir config diff'i katak kesimida yozuv hosil qiladi: `id, at, actor, contextKey, kpiGroupId, cellKey, employeeName, field, before, after, summary`. Katak tarixi modalda, umumiy tarix jadvalda va CSVda.

### 4.3 Keyingi bosqichlar uchun tavsiyalar

- **Maqsadli budjetni taqsimlash:** rahbar jami summa kiritsa, agentlar og‘irligi bo‘yicha taqsimlash + qoldiqni eng katta kasrlarga berish; jami aynan teng chiqishi shart.
- **Mavsumiylik:** oddiy o‘tgan oy o‘rniga 3/6/12 oy medianasi, o‘tgan yil shu oyi, YoY indeks. Har bir usul alohida ko‘rsatiladi, aralashib ketmaydi.
- **Yangi xodim ramp-up:** to‘liq tarix bo‘lmasa supervayzer/shablon rejasi, 1–3 oylik ramp koeffitsiyenti.
- **Floor/cap siyosati:** minimal reja, maksimal o‘sish, «kesish yoki faqat ogohlantirish» tanlovi. Default P0 da faqat ogohlantirish.
- **Top-down vs bottom-up:** agent takliflari yig‘indisi rahbar maqsadidan farq qilsa, delta paneli va qayta taqsimlash.
- **Ko‘p metrika:** `count`, `volume`, `acb`, `order_count` uchun alohida formula/rounding; pul foizini miqdorga avtomatik ko‘chirmaslik.
- **Excel import/eksport:** mavjud smart-code import patternini qayta ishlatish; preview, xato qatorlari, atomik apply.
- **Bildirishnoma:** draft tayyor, to‘siqlar bor, tasdiqqa yuborildi, qaytarildi; mavjud in-app notification orqali.
- **Versiya va audit:** demo da kim/qachon/qaysi qoida/oldingi-keyingi qiymat/sabab yoziladi; productionda draft versiyalari, real foydalanuvchi, optimistic lock va rollback kerak.

## 5. Production integratsiya dizayni

### 5.1 Tavsiya etilgan kanonik fakt

Oylik taklif uchun `payroll-kpi-fact` uslubidagi **yetkazilgan qatorlar − taqsimlangan qaytarishlar**ni kanonik qilish tavsiya etiladi; kunlik operativ KPI created_at bilan qolishi mumkin, ammo UI da «operativ» deb belgilanadi. Bu biznes qarori: integratsiyadan oldin egasi tasdiqlashi kerak. Vaqt mintaqasi `Asia/Tashkent`, oy chegarasi `[start, next_start)`.

### 5.2 Saqlash modeli

Yangi jadvallar (mavjud targetlarga aralashmasdan):

- `sales_plan_proposals`: tenant, target/source period, direction, KPI, metric, name, status (`draft/ready/applied/archived`), config JSON, source snapshot hash, version, created/updated/applied by/at, idempotency key.
- `sales_plan_proposal_rows`: proposal, user, work_slot, source fact/plan snapshot, resolved rule, base, proposed, manual value/reason, excluded, issues JSON, ready flag.
- Audit: mavjud tenant audit eventlariga `plan_proposal.calculate/save/apply` yozuvlari; before/after qiymatlar.

Prisma migratsiyasi alohida PR. `SalesKpiPlanTarget` ga taklif maydonlari qo‘shilmaydi — rasmiy reja va taklif aralashmaydi.

### 5.3 API kontrakti

| Method | Path                                    | Vazifa                                                          |
| ------ | --------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/:slug/plans/proposals/context`    | Yo‘nalish/KPI/xodim/manba holati, read-only                     |
| POST   | `/api/:slug/plans/proposals/calculate`  | Snapshot + config → natija; DB yozmaydi                         |
| POST   | `/api/:slug/plans/proposals`            | Draft saqlash                                                   |
| GET    | `/api/:slug/plans/proposals/:id`        | Draft + qatorlar + audit                                        |
| PATCH  | `/api/:slug/plans/proposals/:id`        | Optimistik version bilan yangilash                              |
| POST   | `/api/:slug/plans/proposals/:id/apply`  | Tanlangan tayyor qatorlarni rasmiy draft targetlarga ko‘chirish |
| GET    | `/api/:slug/plans/proposals/:id/export` | CSV/XLSX                                                        |

RBAC: `plans.taklifiy_reja.view`, `.calculate`, `.update`, `.apply`, `.export`. Hisoblash huquqi yozish huquqidan ajratiladi. Agent o‘ziga tegishli natijani ko‘rishi mumkin, apply yo‘q.

### 5.4 Apply algoritmi

1. Proposal version/idempotency key tekshirish; takroriy so‘rov ikkinchi marta yozmasin.
2. Faqat `ready && !excluded` qatorlarni olish; manual sabablarini tekshirish.
3. Maqsad reja/target maqomini qayta o‘qish. `approved` yoki `pending_approval` ni bevosita overwrite qilmaslik.
4. Draft target bo‘lsa yangilash, yo‘q bo‘lsa yaratish; `work_slot_id` snapshotini yozish.
5. Bitta tranzaksiya: targetlar + proposal status + audit. Xato bo‘lsa hammasi rollback.
6. Keyin mavjud «Подтвердить → Одобрить» zanjiri. Taklifning o‘zi KPI-ni rasmiy qilib yubormaydi.

## 6. Bosqichlar va qabul mezoni

| Faza  | Ish                                                                         | Tugatish mezoni                                                                                                                           |
| ----- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P0 ✅ | Framework-free yadro, web demo v5, unit/e2e, ushbu hujjat                   | 4 formula, ixcham inline editor, katak/ustun/blok bulk, filial akkordeon, manual, oqlash backtest, bitta umumiy draft + audit, CSV, mobil |
| P1    | Kanonik fakt kontrakti, read-only context/calculate API, Prisma draft, RBAC | Tenant izolatsiya, snapshot hash, 0/missing/MTD testlari, API shartnoma testlari                                                          |
| P2    | Next `/plans/taklifiy-reja`, mavjud nav, draft CRUD, apply, audit           | Approved target overwrite bloklanadi; idempotent apply; approver zanjiri buzilmaydi                                                       |
| P3    | Budjet taqsimoti, mavsumiylik, ramp-up, multi-metrika, Excel                | Alohida feature flag va biznes tasdig‘i                                                                                                   |

Sinov matritsasi: 4 formula × (hammaga / tanlangan / filial / SVR) × (to‘liq oy / MTD / yo‘q manba / 0 / manfiy net / draft reja) + ustuvorlik + yaxlitlash + yil chegarasi + tenant izolatsiya + takroriy apply + parallel yangilash.

## 7. Hozir ochiq qarorlar

1. Kanonik oylik fakt `delivered_at` mi yoki mavjud kunlik KPI kabi `created_at` mi?
2. Eski reja uchun `pending_approval` default ruxsat etiladimi? (Prototip default: yo‘q.)
3. Yaxlitlash qadami va katta o‘sish chegarasi biznes bo‘yicha qancha? (Demo: 1 000 so‘m, 50%.)
4. Agentdan boshqa KPI a’zolari taklifga kiradimi?
5. Bir xodimning bir nechta ish o‘rni productionda qanday unique kalit olishi kerak?
6. Apply huquqi aynan qaysi rollarda va qaysi tasdiqlash bosqichidan keyin?

## 8. Ishga tushirish va fayllar

- Web demo: `packages/plans-proposal-demo` — `npm run dev` (port 5175).
- Hisob yadrosi: `packages/plans-proposal` — `npm test`, `npm run typecheck`.
- Demo batafsil: `packages/plans-proposal-demo/README.md`.
- P0 ataylab backend/DB yozmaydi. Production integratsiya P1–P2 da amalga oshiriladi.
