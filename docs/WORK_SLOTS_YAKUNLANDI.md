# ✅ Ishchi o‘rni (WorkSlot) — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi)

WorkSlot (ishchi o‘rni): joy doimiy, xodim almashadi, slot kodi o‘zgarmaydi (Q-01), mijoz-agent qulflari, pending tasdiqlash, filial cheklovi (Q-06), mobil/profil/KPI integratsiyasi.

---

## Tekshiruv buyruqlari

```powershell
# Backend (30 test)
cd backend
npm run work-slots:verify

# Frontend (5 test)
cd frontend
npm run work-slots:verify
```

**Jami:** **35/35** test ✅

---

## Test to‘plamlari

| To‘plam | Testlar | Nima tekshiradi |
|---------|---------|-----------------|
| `work-slots.pure.test.ts` | 20 | Q-01 immutable kod, branch scope, Zod sxemalar, KPI date range |
| `work-slots.codes.pure.test.ts` | 3 | `normalizeSlotCode`, `isValidSlotCode` |
| `work-slots.integration.test.ts` | 7 | CRUD, assign/unassign, lock/pending, contract 409, rol tekshiruvi |
| `work-slots-utils.test.ts` (FE) | 5 | Filter query, staff API path, territory parse |

---

## Migratsiya va backfill

```powershell
cd backend
npx prisma migrate deploy
npm run backfill:work-slots          # test1
npm run backfill:work-slots -- --all # barcha tenantlar (staging/prod bir martalik)
```

---

## Amalga oshirilgan funksiyalar (asosiy)

| Band | Holat |
|------|--------|
| DB: `work_slots`, `slot_user_links`, `slot_audit_entries` | ✅ |
| Assign / unassign / history / checklist | ✅ |
| Mijoz qulfi (`lock`, `pending`, `resolve`) | ✅ |
| Zakaz: shartnoma agenti mosligi (`409 ContractAgentMismatch`) | ✅ |
| Q-06: filial bo‘yicha to‘lov cheklovi | ✅ |
| UI: `/work-slots`, pending badge, lock panel | ✅ |
| Mobil/profil: `work_slot_code` | ✅ |
| KPI: `GET /work-slots/activity-report` | ✅ |

---

## Asosiy fayllar

| Qatlam | Yo‘l |
|--------|------|
| BE modul | `backend/src/modules/work-slots/` |
| BE testlar | `backend/tests/work-slots.*.test.ts` |
| FE UI | `frontend/components/work-slots/` |
| FE utils test | `frontend/tests/work-slots-utils.test.ts` |
| Qo‘llanma | `backend/docs/work-slots-qilingan-ishlar-va-test.md` |

---

## Qo‘lda smoke (ixtiyoriy)

1. Veb: **Пользователи → КОМАНДА → Ишchi o‘rni** (`/work-slots`)
2. Yangi slot → agent biriktirish → tarixda `assign` yozuvi
3. Mijoz kartochkasi → agent qulfi → pending ro‘yxatida tasdiqlash
4. Boshqa agent bilan zakaz → `409 ContractAgentMismatch` (qulflangan mijoz)

---

*Reja: `.cursor/plans/ishchi_o‘rni_soddalashtirilgan_reja_ca80c600.plan.md`*
