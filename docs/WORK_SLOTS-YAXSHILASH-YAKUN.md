# Рабочее место — yaxshilash yakuni

**Sana:** 2026-08-26 (P1 bog‘lanishlar yakunlandi)  
**Holat:** Faza 1–5 + P1 (KPI / marshrut / guruh / orders backfill) — **to‘liq**

---

## Foiz holati

| Faza | Holat | % |
|------|-------|---|
| 1 UI (jadval) | Tayyor | 100% |
| 2 mobile_config → slot + staff redirect | Tayyor | 100% |
| 3 Permission reset (swap) | Tayyor | 100% |
| 4 P1 schema | KPI target + route + kpi group + orders | **100%** |
| 5 Mobile API slot-first | Tayyor | 100% |
| **Umumiy** | | **~100%** (kod) |

---

## 2026-08-26 — P1 bog‘lanishlar

| Jadval | Maydon | Yozish |
|--------|--------|--------|
| `sales_kpi_plan_targets` | `work_slot_id` | `ensurePlansAndTargets`, Excel create |
| `kpi_group_agents` | `work_slot_id` | KPI guruh create/patch |
| `agent_route_days` | `work_slot_id` | marshrut create (snapshot) |
| `orders` | `work_slot_id` | allaqachon create; + tarixiy backfill |

Assign/swap/unassign: `syncUserLinksToWorkSlotTx` — KPI target/guruh yangilanadi; marshrut faqat `NULL` larni to‘ldiradi.

Migratsiya: `20260826120000_work_slot_p1_links`

### Backfill

```powershell
cd backend
npx.cmd tsx scripts/backfill-work-slot-p1-links.ts --tenant=test1 --dry-run
npx.cmd tsx scripts/backfill-work-slot-p1-links.ts --tenant=test1
# yoki barcha tenant:
npm run backfill:work-slot-p1-links
```

`test1` (2026-08-26): targets=32, groups=32, routes=1, orders=12.

---

## Qator amallari (`/work-slots`)

| Icon | Amal |
|------|------|
| Settings | To‘liq konfiguratsiya |
| Eye | Подробнее |
| Pencil | Faqat asosiy maydonlar |
| User | Xodim almashtirish |

Staff «Конфигурация» → `/work-slots/:id?openConfig=1` (slot yo‘q → ogohlantirish).

---

## Qolgan (ixtiyoriy / keyinroq)

1. Plan UI da «по месту» filtr (ustun allaqachon DB da)
2. `prisma generate` — `start-dev` band qilsa, to‘xtatib qayta generate
3. P2: User joy maydonlarini butunlay o‘qish-only / olib tashlash

---

## Backfill (config)

```powershell
cd backend
npx.cmd tsx scripts/backfill-work-slots-config.ts --dry-run
npx.cmd tsx scripts/backfill-work-slots-config.ts
```
