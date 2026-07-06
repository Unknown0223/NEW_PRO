# ✅ Tasdiqlovchilar (Планы → Настройка утверждающих) — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi)

«Планы → Настройка утверждающих»: har **yo'nalish** (TradeDirection) va **supervayzer** uchun ko'p bosqichli tasdiqlash zanjiri + tenant bo'yicha **главные утверждающие** (rahbarlar).

Reja: `.cursor/plans/utverzhdayushchih-rejasi.plan.md`

---

## Tekshiruv buyruqlari

```powershell
# Backend (7 test)
cd backend
npm run plans:verify

# Frontend (7 test)
cd frontend
npm run plans:verify
```

| Qatlam | Natija |
|--------|--------|
| Backend `plans:verify` | ✅ **7/7** |
| Frontend `plans:verify` | ✅ **7/7** |
| **Jami** | **14/14** ✅ |

---

## Amalga oshirilgan funksiyalar

| Faza | Holat |
|------|--------|
| F0: Prisma (`plan_approver_*`) + migratsiya | ✅ `20260623150000_plan_approvers_foundation` |
| F1: Backend API (options, GET, PUT replace) | ✅ `backend/src/modules/plans/` |
| F2: RBAC kalitlari | ✅ `plans.nastroyka_utverzhdayushchih.view/update` |
| F3: «Планы» nav + sidebar + breadcrumb | ✅ `nav-config.ts`, `app-shell.tsx` |
| F4–5: UI workspace + TanStack Query | ✅ `/plans/approvers` |
| F6: Testlar | ✅ 14/14 |

---

## API

| Method | Path | Vazifa |
|--------|------|--------|
| GET | `/api/:slug/plans/approvers/options` | Dropdownlar (yo'nalish, supervayzer, xodim, rahbar) |
| GET | `/api/:slug/plans/approvers?direction_id=` | Saqlangan zanjir + leaders |
| PUT | `/api/:slug/plans/approvers?direction_id=` | To'liq almashtirish (replace) |

---

## Test to‘plamlari

| To‘plam | Testlar | Nima tekshiradi |
|---------|---------|-----------------|
| `plans-schemas.pure.test.ts` | 4 | Zod query/body validatsiya |
| `plans-approvers.integration.test.ts` | 3 | GET options, PUT→GET persist, bad direction |
| `approver-state.test.ts` (FE) | 7 | Jadval bosqichlari, ustun qo'shish/o'chirish |

---

## Asosiy fayllar

| Qatlam | Yo‘l |
|--------|------|
| Prisma | `backend/prisma/models/group-08.prisma` |
| Service | `backend/src/modules/plans/plans.approvers.service.ts` |
| Route | `backend/src/modules/plans/plans.route.ts` |
| Sahifa | `frontend/app/(dashboard)/plans/approvers/page.tsx` |
| Workspace | `frontend/components/plans/approval-workflow-workspace.tsx` |
| State | `frontend/components/plans/approver-state.ts` |

---

## Qo‘lda smoke (ixtiyoriy)

1. Veb: **Планы → Настройка утверждающих** (`/plans/approvers`)
2. Yo'nalish tabini tanlang → supervayzer qatorida bosqichlarni to'ldiring
3. «Главные утверждающие» qo'shing → **Сохранить**
4. Sahifani yangilang — saqlangan qiymatlar qolishi kerak

Ruxsat: `plans.nastroyka_utverzhdayushchih.view` / `.update`

---

*Reja: `.cursor/plans/utverzhdayushchih-rejasi.plan.md`*
