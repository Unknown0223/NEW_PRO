# Slot swap: plan/KPI, tabel, dostup — qo‘lda test

Oxirgi yangilanish: 2026-07-19

## Nima qilindi

1. **Plan siyosati** (`tenant.settings.work_slots.plan_policy`):
   - `full_for_starter_prorata_for_new` (default) — oy boshida turgan agent FULL; yangi — qolgan ish kunlari ulushi
   - `prorata_both` — ikkalasi ham bandlik bo‘yicha
   - `full_both` — ikkalasi ham to‘liq oy rejasi
2. **KPI** — web kunlik KPI overview + mobile agent KPI shu ulushni qo‘llaydi (`slot_user_links`).
3. **Tabel** — slotdan chiqqan xodim pastga, qizil; chiqish sanasidan keyin tahrir blok; faqat **admin** ochadi.
4. **Unassign/swap** — chiqqan (va yangi assign) foydalanuvchida shaxsiy `user_permissions` tozalanadi, rol standarti qaytariladi. Tarixiy qarz/zakaz o‘tkazilmaydi.

### API (siyosat)

- `GET /api/{slug}/work-slots/plan-policy`
- `PATCH /api/{slug}/work-slots/plan-policy` — body: `{ "plan_policy": "full_for_starter_prorata_for_new" }` (faqat admin)

---

## Qo‘lda test ketma-ketligi

### 0. Tayyorgarlik

1. Backend + frontend `npm run dev`.
2. Admin bilan login.
3. Ikki agent: **A** (eski) va **B** (yangi), bir xil yo‘nalish.
4. `/work-slots` da agent slot (masalan `T-TEST`), A ni biriktirib qo‘ying.
5. **Установка планов** da A ga oy uchun aniq summa (masalan 1 000 000).

### 1. Oy o‘rtasida almashtirish + KPI

1. A ning shaxsiy ruxsatlariga bitta ekstra grant qo‘shing (Access → user) — keyin tozalanishini tekshirish uchun.
2. Slotda A → B **swap** qiling (oy o‘rtasi).
3. B ga ham xuddi shu oy uchun **xuddi shu** plan summasini yozing (yoki A dagi targetni B ga ko‘chiring) — tizim ulushni hisoblaydi.
4. **Kunlik KPI / monitoring** (web) oching:
   - **A**: `month_plan` ≈ to‘liq (1 000 000)
   - **B**: `month_plan` ≈ qolgan ish kunlari / oy ish kunlari × 1 000 000
5. Mobile KPI (B login): plan_sum ham prorata bo‘lishi kerak.
6. A da qolgan fakt faqat uning zakazlari; B da — o‘ziniki.

### 2. Tabel

1. **Пользователи → Табель**, joriy oy.
2. A pastroqda, **qizil** ism («ушёл»).
3. A ning `slot_left_at` dan **keyingi** kunni tahrirlashga urinish:
   - operator/manager → xato / blok (`SlotLeftDayLocked`)
   - **admin** → o‘zgartirish mumkin
4. Chiqish kunigacha (shu kun bilan) tahrir ishlashi kerak.

### 3. Dostup

1. A (chiqqan) Access sahifasida: shaxsiy ekstra grant **yo‘q**, faqat rol standarti.
2. B da ham ekstra A dan o‘tmagan (tozalangan / rol default).
3. A slotga bog‘liq ishlarni qila olmasligi (agent-gate / faol slot yo‘q) — mavjud slot gate bo‘yicha.
4. Mijozlar B da; eski zakazlar A da qoladi; yangi undirish/to‘lov — joriy agent (B) orqali.

### 4. Siyosatni o‘zgartirish (ixtiyoriy)

1. Admin: `PATCH .../work-slots/plan-policy` → `prorata_both`.
2. KPI ni qayta oching — A ham prorata bo‘lishi kerak.
3. Qayta `full_for_starter_prorata_for_new` qilib qo‘ying.

### 5. Unassign

1. B ni slotdan **unassign**.
2. B ruxsatlari yana rol standartiga tushishi.
3. Tabelda B ham «ушёл» bo‘lishi mumkin (oy ichida ended_at bo‘lsa).

---

## Avtomatik test

```powershell
cd backend
npx vitest run tests/work-slots.pure.test.ts
```

Plan-policy unit testlar shu faylda.
