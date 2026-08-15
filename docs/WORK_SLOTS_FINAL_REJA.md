# FINAL REJA: Пользователи → Рабочее место

**Sana:** 2026-07-19  
**Maqsad (sodda):** Joy doimiy qoladi, odam almashadi. Joyga tegishli hamma narsa **Рабочее место**da. Odamga tegishli narsa faqat **Пользователи**da.

---

## 1. Sodda tushuntirish

Hozir ko‘p sozlamalar **xodim kartochkasida** (Пользователи): ombor, hudud, narx, kassa, cheklovlar…

Lekin bu narsalar **joy**niki: xodim ketadi — joy qolishi kerak. Shuning uchun ularni **Рабочее место (WorkSlot)** ga ko‘chiramiz.

| | Пользователи (xodim) | Рабочее место (joy) |
|--|---------------------|---------------------|
| Savol | **Kim?** | **Qayerda / nima ishlaydi?** |
| Misollar | Ism, login, parol, telefon, rol | Filial, ombor, hudud, narx, mijozlar |
| Almashtirishda | Odam ketadi | Sozlamalar **joyda qoladi** |

---

## 2. FINAL: nima USERDA QOLADI (faqat o‘ziga tegishli)

Bu maydonlar / bog‘lanishlar **ko‘chirilmaydi**:

| # | Nima | Nega |
|---|------|------|
| 1 | Login, parol | Shaxs identifikatsiyasi |
| 2 | FIO (ism, familiya, otasining ismi) | Shaxs |
| 3 | Rol (`agent`, `expeditor`, …) | Lavozim turi (slot_type bilan mos) |
| 4 | Telefon, email, PINFL | Shaxs aloqa |
| 5 | Faol / nofaol (`is_active`) | Hisob holati |
| 6 | Ilova / avtorizatsiya (`app_access`, `can_authorize`) | Shaxs ruxsati |
| 7 | Max sessions, qurilmalar, sync | Shaxs sessiyasi |
| 8 | UI preferences (jadval ustunlari) | Shaxsiy interfeys |
| 9 | Shaxsiy ruxsatlar (`user_permissions`) | Shaxs; slotdan chiqganda tozalanadi |
| 10 | Tabel yozuvlari | Kim ishlagan |
| 11 | Tarixiy zakaz/to‘lov (`agent_id`) | Kim qilgan (o‘zgarmaydi) |

---

## 3. FINAL: nima RABOCHIY MESTAGA O‘TADI (to‘liq ro‘yxat)

### 3.1 Sozlamalar (hozir User maydonida)

| # | Hozir (User) | Keyin (WorkSlot) | Nima |
|---|--------------|------------------|------|
| 1 | `branch` | `branch_code` (bor / to‘ldirish) | Filial |
| 2 | `trade_direction` / `trade_direction_id` | `direction_id` (bor) | Savdo yo‘nalishi |
| 3 | `territory` | `territory_zone/oblast/city` | Hudud |
| 4 | `warehouse_id` | `warehouse_id` | Asosiy ombor |
| 5 | `return_warehouse_id` | `return_warehouse_id` | Qaytarish ombori |
| 6 | `price_type` | `price_type` | Asosiy narx turi |
| 7 | `agent_price_types` | `price_types` JSON | Qo‘shimcha narxlar |
| 8 | `agent_entitlements` | `entitlements` JSON | Mahsulot/narx cheklovlari |
| 9 | `consignment*` (limit, close day…) | `consignment_*` | Konsignatsiya limithi (joy) |
| 10 | `warehouse_staff_entitlements` | slot config (skladchik) | Omborchi panel cheklovi |
| 11 | `expeditor_assignment_rules` | slot config (expeditor) | Dastavchik qoidalari |
| 12 | `supervisor_user_id` | `supervisor_user_id` (keyin slot) | Ustavi / jamoa |
| 13 | `kpi_color` | ixtiyoriy slot | KPI rangi |
| 14 | `code` (agent kodi) | **`slot_code`** asosiy tashqi kod | Joy kodi |

### 3.2 Bog‘lanishlar / jadvallar

| # | Hozir | Keyin |
|---|-------|-------|
| 15 | `warehouse_user_links` | Slot ombori + sync (yoki slot link) |
| 16 | `cash_desk_user_links` | `cash_desk_id` slotda + sync |
| 17 | `clients.agent_id` | Manba: slot; `agent_id` = hozirgi xodim (mirror) |
| 18 | `client_agent_assignments` | `work_slot_id` asosiy |
| 19 | `sales_kpi_plan_targets` (user) | + `work_slot_id` (reja joyga) |
| 20 | `kpi_group_agents` | Slot bog‘lanishi |
| 21 | `agent_route_days` | Marshrut kunlari → slot |

### 3.3 Snapshot (yangi qo‘shiladi, tarix uchun)

| # | Jadval | Qo‘shiladi |
|---|--------|------------|
| 22 | `orders` | `work_slot_id` — qaysi joyda yaratilgan |
| 23 | To‘lovlar (ixtiyoriy) | `work_slot_id` |

### 3.4 UI (Пользователи bo‘limidan)

| # | Hozir qayerda | Keyin qayerda |
|---|----------------|---------------|
| 24 | Agent «Конфигурации» (ombor, narx, cheklov) | `/work-slots/[id]` Конфигурация |
| 25 | Agent restrictions / entitlements dialog | Slot editor |
| 26 | Expeditor configurations dialog | Slot (expeditor tipi) |
| 27 | Staff forma: filial, hudud, ombor, yo‘nalish | Slot forma (staffda faqat o‘qish yoki yashirish) |
| 28 | Plan o‘rnatish «по агенту» | «по рабочему месту» (+ mirror) |

---

## 4. Nima ALLAQACHON bor (qayta qilmaymiz)

- WorkSlot jadvali, assign/swap/unassign, tarix
- Mijoz migrate + qulf (manual/contract)
- Plan siyosati FULL / prorata
- Tabel: ketgan past+qizil, kun blok
- Unassign: shaxsiy ruxsat tozalash
- Qarz undirish workplace agent bo‘yicha

---

## 5. Konfliktlar (qisqa — yechim bilan)

| Muammo | Yechim |
|--------|--------|
| User va Slot ikkala joyda sozlash | **Yozish faqat Slot**; User = nusxa (mirror) |
| Staff + Slot formasi | Staffda joy maydonlari yopiladi |
| `code` vs `slot_code` | Tashqi kod = slot_code |
| Ikki KPI target | Reja asosan slotga |
| Mid-month ikki to‘liq plan | Mavjud `plan_policy` |
| Kassa bandligi | Bitta aktiv collector / desk |
| Import eski «agent» | Import slotga yozadi |
| Bir odam ikki slot | Taqiqlanadi (1 aktiv link) |

---

## 6. Qanday qilamiz (3 bosqich)

### Bosqich 1 — Asos (P0) ← shu yerdan boshlanadi
1. `work_slots` jadvaliga yuqoridagi sozlama ustunlari  
2. Slotni tahrirlash → **slotga** yoziladi (endi userga emas)  
3. Xodimni slotga qo‘yganda: slot sozlamalari userga **nusxa** (eski kod sindirmaslik)  
4. Slotdan chiqarilganda: userdan joy sozlamalari **tozalanadi**  
5. Eski ma’lumot: faol xodimdan slotga **backfill**  
6. UI: Рабочее место da to‘liq Конфигурация; Пользователи da joy maydonlari yopiladi/read-only  

**Tayyor:** yangi xodimni joyga qo‘ydingiz — ombor/hudud/narx joydan keladi; eski xodimda qolmaydi.

### Bosqich 2 — Bog‘lanishlar (P1)
Mijoz, ombor/kassa link, KPI/plan slotga, marshrut, yangi zakazda `work_slot_id`.

### Bosqich 3 — Tozalash (P2)
Faqat slot o‘qiladi; User dagi joy maydonlariga yozish o‘chadi; hisobotlarda «по месту» / «по сотруднику».

---

## 7. Polzovateli bo‘limida KEYIN nima ko‘rinadi

**Qoladi:** xodim yaratish, FIO, login, rol, telefon, faol/nofaol, shaxsiy ruxsat, tabel.  
**Ko‘chadi / yashirinadi:** ombor, kassa, hudud, narx, entitlements, konsignatsiya limithi, marshrut — hammasi **Рабочее место**.

---

## 8. Sizdan rozilik

Agar shu FINAL reja **maqul** bo‘lsa, keyingi qadam:

→ **Bosqich 1 (P0)** ni kodda boshlaymiz  
(schema + mirror/clear + slot UI config + backfill).

Agar biror bandni o‘zgartirish kerak bo‘lsa (masalan konsignatsiya shaxsda qolsin) — aytib qo‘ying, reja tuzatiladi, keyin ish boshlanadi.
