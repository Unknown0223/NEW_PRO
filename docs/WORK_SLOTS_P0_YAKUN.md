# WorkSlot P0 yakun — joy konfiguratsiyasi slotga

**Sana:** 2026-07-20  
**Holat:** P0 amalga oshirildi + skriptli audit o‘tdi

---

## 1. Nima qo‘shildi

### DB (`work_slots`)
Joy sozlamalari ustunlari: `territory`, `warehouse_id`, `return_warehouse_id`, `cash_desk_id`, `price_type`, `price_types`, `entitlements`, `consignment*`, `supervisor_user_id`, `warehouse_staff_entitlements`, `expeditor_assignment_rules`.

Migratsiya: `prisma/migrations/20260720000000_work_slot_workplace_config/`

### Backend
| Fayl | Vazifa |
|------|--------|
| `work-slots.config-mirror.ts` | `mirrorSlotConfigToUser`, `clearWorkplaceFieldsOnUser`, `applySlotConfigPatch` |
| `work-slots.config-territory.ts` | Hudud string helper |
| `work-slots.service.ts` | PATCH → **slotga** yozadi, keyin faol userga mirror |
| `work-slots.user-attrs.ts` | Endi slot-first (eski «faqat user» yo‘li o‘zgardi) |
| `work-slots.assign.ts` | Swap/unassign: clear + permission reset; assign: mirror |
| `work-slots.query.helpers.ts` | Ro‘yxatda slot config birinchi, user fallback |
| `scripts/backfill-work-slots-config.ts` | User → slot backfill |
| `scripts/smoke-slot-config-migration.ts` | P0 smoke |

npm: `backfill:work-slots-config`

### Hali P1 (keyingi)
- KPI plan `work_slot_id`, order snapshot, marshrut slotga, staff formani to‘liq yopish UI

---

## 2. Jarayon (qanday ishlaydi endi)

1. **Slotni tahrirlash** (ombor/hudud/kassa) → yoziladi `work_slots` ga.  
2. Agar joyda faol xodim bo‘lsa → shu sozlamalar **userga nusxa** (eski mobil/zakaz sindirmaslik).  
3. **Boshqa xodimni biriktirish** → eski userdan joy maydonlari **tozalanadi** + ruxsat reset; yangiga slot config **mirror**.  
4. **Unassign** → clear + permission reset.  
5. Ro‘yxat/API o‘qish: **slot birinchi**, user fallback.

---

## 3. Skriptli test natijasi (shu sessiyada)

| Buyruq | Natija |
|--------|--------|
| `npx.cmd vitest run tests/work-slots.pure.test.ts` | **24/24 OK** |
| `npx.cmd tsx scripts/smoke-slot-config-migration.ts` | **HAMMASI OK** |
| `npx.cmd tsx scripts/smoke-slot-plan-policy.ts` | **HAMMASI OK** (FULL/prorata) |
| DB ustunlari `territory/warehouse_id/...` | **mavjud** |

---

## 4. Siz o‘zingiz test qilish — yo‘riqnoma

### Tayyorgarlik
1. Backend qayta ishga tushiring (Prisma client yangilanishi uchun — agar `EPERM` bo‘lsa, avval backendni to‘xtating, keyin `npx.cmd prisma generate`).
2. Frontend `npm run dev`.
3. (Bir marta) backfill:
   ```powershell
   cd backend
   npx.cmd tsx scripts/backfill-work-slots-config.ts --dry-run
   npx.cmd tsx scripts/backfill-work-slots-config.ts
   ```

### A) Slot config saqlanishi
1. **Пользователи → Ишчи o‘rni** (`/work-slots`).
2. Bir agent slotni oching.
3. Hudud / ombor / kassa ni o‘zgartirib saqlang.
4. Kutilgan: qayta ochganda qiymatlar qoladi (endi manba — slot).

### B) Almashtirish (asosiy P0 tekshiruv)
1. Slotda agent **A** turgan bo‘lsin; ombor X, hudud Y.
2. Slotga agent **B** ni assign/swap qiling.
3. **B** da (staff/mobil): ombor X, hudud Y ko‘rinishi kerak.
4. **A** da: ombor/hudud/kassa **bo‘sh** (tozalangan); shaxsiy ekstra ruxsatlar reset.
5. Slot sozlamasi o‘zgarmagan bo‘lishi kerak.

### C) Unassign
1. B ni unassign.
2. B da joy maydonlari yana tozalangan.
3. Slot config DB da qoladi (keyingi xodim uchun).

### D) Plan (oldingi ish — regressiya)
1. Oy o‘rtasi swap: A FULL / B prorata (B ga target bo‘lsa).
2. Tabel: ketgan past+qizil; chiqishdan keyin kun blok (faqat admin).

### E) Skript (ixtiyoriy qayta)
```powershell
cd backend
npx.cmd vitest run tests/work-slots.pure.test.ts
npx.cmd tsx scripts/smoke-slot-config-migration.ts
npx.cmd tsx scripts/smoke-slot-plan-policy.ts
```

---

## 5. Eslatma

- Prisma `migrate status` da boshqa bo‘sh papka (`20260716100000_product_category_tenant_name_unique`) xato berishi mumkin — P0 SQL alohida qo‘llangan / ustunlar bor.
- `prisma generate` backend ishlab turganda Windows da DLL lock (`EPERM`) — generate uchun serverni to‘xtating.
