# Release oldidan performance (Sprint 6 — yengil checklist)

Maqsad: har release yoki muhim deploy oldidan **5–10 daqiqalik** tekshiruv — regressiya va sekinlik signalini olish.

## Oldindan (staging yoki nusxa DB)

- [ ] `npm run build` (backend + frontend) yashil.
- [ ] `backend/scripts/perf/` dagi tegishli `EXPLAIN (ANALYZE, BUFFERS)` ni o‘zgartirilgan tenant/sana bilan ishga tushirish; `Seq Scan` kutilmagan joyda paydo bo‘lmasligi.
- [ ] Agar indeks migratsiyasi bo‘lsa: migratsiya izohida **sabab** va kerak bo‘lsa **rollback** qadami yozilganmi?

## Deploy atrofida

- [ ] `/ready` — `database: ok`, Redis holati kutilganidan farq qilmayaptimi?
- [ ] Bir nechta asosiy sahifa: zakazlar ro‘yxati, mijozlar, dashboard — **sub’yektiv** sekinlashish yo‘qmi (cold startdan keyin).
- [ ] Backend logda yangi `slow_request` (≥ 500 ms) portlash **keskin oshgan** emasligini tekshirish (staging log yoki namuna).

## Keyingi sprint

- p50/p95 raqamlarini metrikadan olish va `.cursor/plans/db_slow_query_inventory.md` ga yozish.

Bog‘liq: [SLO va kuzatuv](../../docs/SLO_AND_OBSERVABILITY.md), [SQL perf README](../scripts/perf/README.md).
