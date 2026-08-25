# Рабочее место — yaxshilash yakuni

**Sana:** 2026-08-25 (UI: Config / Edit ajratildi, staff redirect)  
**Holat:** Faza 1–3 + Faza 4 (orders.work_slot_id) + Faza 5 (slot-first mobile) + UI to‘liq ajratish

---

## Foiz holati (taxminiy)

| Faza | Holat | % |
|------|-------|---|
| 1 UI (**jadval** — Agents/Expeditors kabi) | Tayyor | 100% |
| 2 mobile_config → slot + staff redirect/block | Tayyor | 100% |
| 3 Permission reset (swap) + audit note | Tayyor + test | 100% |
| 4 P1 schema | `orders.work_slot_id` qo‘shildi; KPI target — keyingi | ~60% |
| 5 Mobile API slot-first | Tayyor | 100% |
| 6 Testlar / hujjat | Shu hujjat | — |
| **Umumiy (reja bo‘yicha)** | | **~90%** |

---

## 2026-08-25 (kechki) — Config / Edit / Staff to‘liq ajratish

### `/work-slots` qator amallari (aniq)

| Icon | Amal | Nima ochiladi |
|------|------|----------------|
| Settings | **Конфигурация** | `SlotWorkplaceConfigDialog` — narx, limit, mobile, expeditor rules, skladchik… |
| Eye | **Подробнее** | detail sahifa |
| Pencil | **Редактировать** | faqat asosiy maydonlar (kod, nom, rol, filial, territory/sklad/kassa) — **config yo‘q** |
| User | **Сменить сотрудника** | yangilangan «Xodim almashtirish» modal |

### Staff (agent / expeditor / supervisor / skladchik / collector / auditor)

- «Конфигурация» tugmasi: faol `work_slot_id` → `/work-slots/:id?openConfig=1`
- Slot yo‘q → dialog: **«Avval rabochee mesto biriktiring»** (+ link `/work-slots`)
- Staff form/edit: faqat shaxsiy ma’lumot (FIO, login, parol, telefon, rol, app_access…)
- User workplace editor (yarim ishlaydigan duplicate) **olib tashlandi**

### Backend

- `WORKPLACE_STAFF_PATCH_KEYS` + `cash_desk_id`
- Individual staff PATCH: faol slotda joy maydonlari → `WORKPLACE_ON_SLOT` (409)
- Agents bulk (`set_agent_entitlements`, trade_direction, consignment, product_list): faol slot bor bo‘lsa → `WORKPLACE_ON_SLOT`
- `patch_mobile_config` bulk: slot bo‘lsa → slot entitlements ga yozadi (oldingidek)

### Swap modal

- «Xodim almashtirish»: SalesArena uslubida (hozirgi/yangi kartochka, qidiruv, ixcham checklist)

---

## Nima qilindi (oldingi fazalar)

### Faza 1 (UI — **table-first**)

- `/work-slots` asosiy ko‘rinish: `StaffWorkspaceTable`
- Ustunlar: kod, nomi, rol, filial, xodim, ombor, zona/oblast/shahar, kassa, status
- Detail sahifa; konfiguratsiya modal — rol tablar

### Faza 2

- `WorkSlot.entitlements.mobile_config` — **manba**
- Staff joy maydonlari PATCH: `WORKPLACE_ON_SLOT`
- Slot «Мобильное» tab

### Faza 3–5

- Assign/swap/unassign: ruxsat reset + audit
- `orders.work_slot_id`
- Mobile API slot-first

---

## Qolgan (tashqi / keyingi)

1. `SalesKpiPlanTarget.work_slot_id` + plan UI «по месту»
2. Marshrut kunlari (`agent_route_days`) → slot
3. KPI guruh bog‘lanishi slotga
4. Eski zakazlarga `work_slot_id` backfill (ixtiyoriy)
5. User dagi joy maydonlarini P2 da to‘liq o‘qish-only / o‘chirish
6. `npx prisma migrate deploy` / generate — `20260825120000_orders_work_slot_id`

---

## Backfill (bir marta)

```powershell
cd backend
npx.cmd tsx scripts/backfill-work-slots-config.ts --dry-run
npx.cmd tsx scripts/backfill-work-slots-config.ts
```

Endi backfill `mobile_config` ni ham slotga ko‘chiradi.
