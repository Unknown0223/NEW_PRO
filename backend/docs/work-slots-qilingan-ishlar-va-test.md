# Ishchi o‘rni (WorkSlot) — qilingan ishlar va tekshirish

Oxirgi yangilanish: 2026-05-16  
Reja: `.cursor/plans/ishchi_o‘rni_soddalashtirilgan_reja_ca80c600.plan.md`

---

## 1. Qilingan ishlar (qisqa ro‘yxat)

### Ma’lumotlar bazasi
- Jadvalar: `work_slots`, `slot_user_links`, `slot_audit_entries`
- `client_agent_assignments` kengaytirildi: `lock_type`, `lock_reason`, `lock_set_by`, `auto_assign_status`, `work_slot_id`
- Migratsiya: `backend/prisma/migrations/20260601120000_work_slots_foundation/`
- Backfill skript: `npm run backfill:work-slots` (`backend/scripts/backfill-work-slots.ts`)

### Backend API (`/api/{tenant}/...`)
- `GET/POST /work-slots`, `GET/PATCH /work-slots/:id`
- `POST /work-slots/:id/assign`, `POST /work-slots/:id/unassign`
- `GET /work-slots/:id/history`, `GET /work-slots/:id/checklist`
- `GET /work-slots/pending-count`
- `PATCH /client-agent-assignments/:id/lock`
- `GET /client-agent-assignments/pending`
- `POST /client-agent-assignments/:id/resolve`
- Zakaz yaratishda shartnoma qulfi: boshqa agent → `409 ContractAgentMismatch`
- Kassa: bitta inkasator bandligi tekshiruvi
- Xodimlar ro‘yxati: `work_slot_id`, `work_slot_code`; yaratishda `warnings` (kod band bo‘lsa)

### Frontend
- Menyu: **Пользователи → КОМАНДА → Ишчи o‘rni** (`/work-slots`)
- Slot ro‘yxati, yangi slot, pending jadvali + «Tasdiqlash»
- Slot batafsil: `/work-slots/[id]` — almashtirish, tarix, 4 bosqichli checklist
- Sidebar: kutilayotgan agentlar uchun qizil badge (Briefcase ikonka)
- Mijoz kartasi: slot 1 uchun qulflash paneli (`AssignmentLockPanel`)
- Agentlar jadvalida kod ustunida ishchi o‘rni badge

### Avtomatik testlar
| Fayl | Nima tekshiradi |
|------|-----------------|
| `backend/tests/work-slots.pure.test.ts` | 9 ta — rol mosligi, Zod, `slot_code` o‘zgarmasligi |
| `backend/tests/work-slots.integration.test.ts` | 7 ta — API oqimi, qulflash, pending, zakaz 409 |

---

## 2. Avtomatik test natijalari

Buyruq (backend papkasida):

```powershell
cd d:\SALEC\backend
npm run test:work-slots
```

**Kutilgan natija:** `Test Files 2 passed`, **Tests 16 passed**.

| # | Test nomi | Natija |
|---|-----------|--------|
| 1–9 | `work-slots.pure.test.ts` | ✅ 9/9 |
| 10 | GET /work-slots ro‘yxat | ✅ |
| 11 | POST yaratish → assign → checklist → history → unassign | ✅ |
| 12 | POST duplicate slot_code → 409 CodeTaken | ✅ (konsolda `prisma:error` — kutilgan) |
| 13 | Noto‘g‘ri rol bilan assign → 400 | ✅ |
| 14 | lock → pending → pending-count → resolve | ✅ |
| 15 | Zakaz + contract qulfi + boshqa agent → 409 ContractAgentMismatch | ✅ |
| 16 | lock sababsiz → LockReasonRequired | ✅ |

**Integratsiya testlari uchun:** PostgreSQL + seed. Marker: `backend/tests/.db-integration-ready` ichida `1` bo‘lishi kerak (odatda `npm run db:seed` dan keyin).

---

## 3. Qo‘lda tekshirish (sizning qo‘shimcha testingiz)

Quyidagi tartibda har bir bandni UI dan tekshiring. Login: admin yoki reja rollaridagi foydalanuvchi (`admin`, `operator`, `supervisor`, …).

### Tayyorgarlik
1. Backend: `npm run dev` (yoki `dev:server`) — odatda `http://127.0.0.1:18080`
2. Frontend: `npm run dev` (frontend papkada) — `http://localhost:3000`
3. Migratsiya: `cd backend` → `npm run db:deploy`
4. (Ixtiyoriy) Mavjud agentlardan slot: `npm run backfill:work-slots`
5. **Login** qiling (masalan `test1` / `admin`) — API har doim `/api/{tenantSlug}/...` ko‘rinishida

### Muammo: `404` yoki `TenantNotFound` (konsolda `/api/work-slots` slug siz)
- Sabab: sessiya yuklanmasdan sahifa API chaqirgan.
- Tekshiring: Network da URL `http://localhost:3000/api/test1/work-slots` bo‘lishi kerak (`test1` o‘rniga sizning tenant slug).
- Yechim: chiqib qayta kiring; sahifani yangilang; backend ishlayotganini tekshiring.

---

### A. Ishchi o‘rni — asosiy sahifa

**Qayer:** chap menyu → **Пользователи** → **Ишчи o‘rni**  
**URL:** `http://localhost:3000/work-slots` (port sizdagi bo‘lishi mumkin)

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| A1 | Sahifani oching | «Ishchi o‘rni» sarlavha, slotlar jadvali |
| A2 | Yangi slot: kod `T-TEST-01`, turi Agent, «Yaratish» | Jadvalda yangi qator |
| A3 | Bir xil kodni qayta yaratishga urinish | Xato / slot yaratilmaydi |
| A4 | Qatorga bosing yoki `/work-slots/{id}` ga o‘ting | Batafsil sahifa |

---

### B. Slot batafsil — odam biriktirish

**URL:** `/work-slots/{id}`

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| B1 | Agent tanlang, «Biriktirish» | Faol xodim ko‘rinadi |
| B2 | Checklist (4 bosqich) | Barcha kerakli bandlar yashil / to‘ldirilgan |
| B3 | «Ajratish» (unassign) | Slot bo‘sh, tarixda yozuv qoladi |
| B4 | Noto‘g‘ri rol (masalan, Ekspeditor slotiga agent emas, boshqa tur) | Xato xabari |

---

### C. Sidebar — kutilayotgan agentlar

**Qayer:** chap pastki qism, bildirishnomalar yonida **Briefcase** ikonka

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| C1 | Pending yaratish (D bo‘limi) | Badge raqami ≥ 1 |
| C2 | Ikonkaga bosing | `/work-slots` ochiladi |
| C3 | Pending hal qilingandan keyin | Badge yo‘qoladi yoki kamayadi |

---

### D. Agent tanlash kutilmoqda (pending)

**Qayer:** `/work-slots` — «Agent tanlash kutilmoqda» kartasi

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| D1 | Mijoz kartasida (E) yoki API orqali `pending_review` holat | Jadvalda qator |
| D2 | Agent tanlang, «Tasdiqlash» | Qator yo‘qoladi, mijozda agent belgilangan |
| D3 | `/work-slots/pending-count` (DevTools Network) | Son kamayadi |

**Pending qo‘lda yaratish (mijoz orqali):**  
Mijoz → tahrirlash → slot 1 → qulflash «Shartnoma» + keyin (agar UI da bo‘lsa) yoki admin orqali assignment `auto_assign_status = pending_review` — oddiy foydalanuvchi uchun eng oson yo‘l: **Ishchi o‘rni** sahifasida allaqachon pending bo‘lsa D2 ni bajaring.

---

### E. Mijoz — mas’ul agent va qulflash

**Qayer:** **Клиенты** → mijozni oching → tahrirlash  
**URL:** `/clients/{id}` (tahrir rejimi)

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| E1 | Slot 1 / «Mas’ul agent» blokini toping | Qulflash paneli (`AssignmentLockPanel`) |
| E2 | «Shartnoma» (contract) + sabab yozing, saqlang | Qulflangan holat |
| E3 | «Qo‘lda» (manual) | Ogohlantirish rejimi |
| E4 | «Erkin» (none) | Avtomatik qoidalarga qaytadi |

---

### F. Zakaz — shartnoma qulfi

**Qayer:** **Заказы** → yangi zakaz  
**URL:** `/orders` yoki yangi zakaz formasi

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| F1 | E2 dagi mijozni tanlang | Mas’ul agent qulflangan |
| F2 | Boshqa agentni tanlab zakaz yuboring | **Xato:** agent mos kelmaydi (409 / xabar) |
| F3 | To‘g‘ri (qulflangan) agent bilan zakaz | Zakaz yaratiladi |

---

### G. Agentlar ro‘yxati — ishchi o‘rni badge

**Qayer:** **Пользователи → Агент**  
**URL:** `/settings/spravochnik/agents`

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| G1 | Slotga biriktirilgan agentni toping | «Код» ustunida kichik badge (masalan `T-12`) |
| G2 | Slotdan ajratilgan agent | Badge yo‘q |

---

### H. Xodim yaratish — kod ogohlantirishi

**Qayer:** Agentlar → yangi agent

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| H1 | Kod mavjud slot kodi bilan, lekin boshqa odam band | Yaratiladi, lekin `warnings` (Network javobida) yoki UI ogohlantirish |

---

### I. Kassa — bitta inkasator (agar kassalar moduli ishlayotgan bo‘lsa)

**Qayer:** kassa / inkasator biriktirish ekrani

| Qadam | Nima qilish | Kutilgan natija |
|-------|-------------|-----------------|
| I1 | Bir kassaga ikkinchi inkasator biriktirish | Band / xato |

---

## 4. UI/UX hujjat (v1.0) — nima qo‘shildi / nima keyinroq

### Qo‘shilgan (May 2026 UI yangilanishi)

| Hujjat bo‘limi | Holat |
|----------------|--------|
| `/work-slots` — header, qidiruv, **Yangi slot** modal | ✅ |
| Slot **kartalar** (grid), accordion (qisqa meta) | ✅ |
| Chap **filter** paneli (filial, tur, aktiv) | ✅ (qisman) |
| Pagination | ✅ |
| Modal: **Yangi slot** (`CreateSlotDialog`) | ✅ |
| Modal: **Tahrirlash** (`EditSlotDialog`, kod o‘zgarmaydi) | ✅ |
| Modal: **Almashtirish** (`AssignUserDialog`, qidiruv, checklist) | ✅ |
| `/work-slots/:id` — 3 bo‘lim (ma’lumot, mas’ul, tarix) | ✅ |
| Pending agentlar jadvali | ✅ |
| Sidebar pending badge | ✅ |

### Hujjatda bor, hozircha yo‘q (backend yoki keyingi faza)

| Element | Sabab |
|---------|--------|
| `lock_info` slot kartada | Qulflash mijoz `client_agent_assignments` da, slot emas |
| `GET /users/search` | Yo‘q — staff ro‘yxati (`/agents`, `/collectors`, …) |
| `POST .../pre-assign-check` | Yo‘q — `GET .../checklist` ishlatiladi |
| Lock modal slot batafsilda | Mijoz kartasidagi `AssignmentLockPanel` |
| Bulk tahrirlash, Excel import/export | API yo‘q |
| Saved filters, analytics, workflow rules | Keyingi faza (§7) |

---

## 5. Hali to‘liq qilinmagan (reja bo‘yicha keyingi bosqich)

- Production: `npm run backfill:work-slots` staging/prod da bir martalik (skript tayyor)

### 2026-05-17 — reja davomi

- **Q-01:** `PATCH /work-slots/:id` endi `slot_code` qabul qilmaydi; UI tahrirda kod faqat o‘qiladi
- **Q-06:** `createPayment` / `createClientExpense` — maydon xodimi boshqa filial agent/mijoz uchun to‘lov yozolmaydi (`403 BranchScopeViolation`)
- **Linkage:** `GET .../territories/agent-picker-context` — `agent_pick_ambiguous`, `requires_supervisor_review`
- **Mijoz yaratish:** manzil bilan minimal yaratilganda `applyTerritoryAutoAssignAfterAddressChange`

### 2026-05-17 — reja G (kelajakdan v1)

- **Mobil:** `GET /api/{tenant}/mobile/agent-config` — `work_slot_id`, `work_slot_code`
- **Profil:** `GET /auth/me` — `work_slot_id`, `work_slot_code`
- **KPI hisobot:** `GET /api/{tenant}/work-slots/activity-report?date_from=&date_to=`
- **UI:** `/work-slots` pastida «Slot bo‘yicha faollik» paneli

---

## 5. Foydali fayllar

| Maqsad | Yo‘l |
|--------|------|
| API modul | `backend/src/modules/work-slots/` |
| Migratsiya | `backend/prisma/migrations/20260601120000_work_slots_foundation/` |
| UI ro‘yxat | `frontend/components/work-slots/work-slots-workspace.tsx` |
| UI batafsil | `frontend/components/work-slots/work-slot-detail.tsx` |
| Mijoz qulfi | `frontend/components/work-slots/assignment-lock-panel.tsx` |
| Testlar | `backend/tests/work-slots.*.test.ts` |
