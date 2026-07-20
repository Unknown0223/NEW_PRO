# AUDIT: zanjir konfliktlari + Plan (tasdiqlangan oy + xodim ±)

**Sana:** 2026-07-19  
Bog‘liq: `WORK_SLOTS_FINAL_REJA.md`

---

## 1. Sodda javob (xulosa)

| Savol | Javob |
|-------|--------|
| 1→2→3 zanjir keyin konflikt beradimi? | **Berishi mumkin**, agar tartibni buzsak yoki ikki manba (User+Slot) birga yozilsa. **To‘g‘ri tartib + bitta yozish manbasi** bilan beradi. |
| Plan to‘liq tasdiqlangan, oy o‘rtasida yangi keldi / ishdan olindi? | **Tasdiqlangan raqam o‘zi o‘chmaydi.** Hisobda: ketgan = FULL (default), yangi = qolgan kunlar ulushi — **lekin yangiga alohida target bo‘lishi kerak** (hozir avtomatik yaratilmaydi). |

---

## 2. Zanjir bo‘yicha audit (1 → 2 → 3 → …)

Har bosqich keyingisini «sindirishi» mumkinmi — tekshiruv.

```
Z1 Config slotga     →  Z2 Mirror/clear user
        ↓
Z3 Mijoz/ombor/kassa →  Z4 KPI/plan slotga
        ↓
Z5 Order snapshot    →  Z6 Hisobotlar / cutover
```

### Zanjir 1 — Slot config (P0)
| Keyingi zanjir | Konflikt? | Sabab / himoya |
|----------------|-----------|----------------|
| → Z2 mirror | Yo‘q, agar mirror majburiy | Assign da slot→user nusxa |
| → Mobil/zakaz | **Ha**, agar o‘qish hali Userdan | Himoya: `resolveEffectiveConfig` slot-first |
| → Staff forma | **Ha**, agar staff ham yozsa | Himoya: staff joy maydonlari yopiq |

### Zanjir 2 — Mirror + unassign clear
| Keyingi | Konflikt? | Himoya |
|---------|-----------|--------|
| → Mijoz agent_id | Yo‘q | Swap allaqachon migrate qiladi |
| → Permission | Yo‘q (kutilgan) | Reset — ogohlantirish UI |
| → Ombor link | **Ha**, agar link tozalanmasa | Unassign: warehouse/cash link clear |

### Zanjir 3 — Mijoz / ombor / kassa (P1)
| Keyingi | Konflikt? | Himoya |
|---------|-----------|--------|
| → Qarz undirish | Past | Workplace agent allaqachon |
| → Contract lock | Yo‘q | Lock skip (bor) |
| → Kassa 2 collector | **Ha** | Checklist + unique desk |
| → Plan (Z4) | **Ha**, agar plan hali userda | Dual-write / slot target |

### Zanjir 4 — KPI / plan slotga (P1)
| Keyingi | Konflikt? | Himoya |
|---------|-----------|--------|
| → Tasdiqlangan oy | **Asosiy savol — §3** | Policy + qoida (quyida) |
| → Monitoring «по агенту» | O‘rta | Dual filtr agent + slot |
| → Ikki target (user+slot) | **Ha** | Bitta manba: slot; user mirror yoki o‘chirish |

### Zanjir 5 — Order `work_slot_id`
| Keyingi | Konflikt? | Himoya |
|---------|-----------|--------|
| → Tarixiy orderlar | Yo‘q | Eski qatorlar null qoladi; agent_id saqlanadi |
| → Hisobot | O‘rta | Filtr ikkala maydon |

### Zanjir 6 — Cutover (P2)
| Keyingi | Konflikt? | Himoya |
|---------|-----------|--------|
| → Import | **Ha** | Import mapper slotga |
| → Eski API client | **Ha** | Deprecation muddati / dual o‘qish |

### Umumiy xulosa zanjir bo‘yicha
- **Xavfli nuqta:** Z1 dan keyin Z2/Z3 ni o‘tkazib Z4 qilish → chalkash.  
- **Xavfsiz yo‘l:** qat’iy P0 → P1 → P2; har bosqichda bitta yozish manbasi.  
- Keyingi zanjirlar **o‘z-o‘zidan sindirmaydi**, agar dual-write oynasida slot g‘olib bo‘lsa.

---

## 3. PLAN bo‘limi — sizning savolingiz

### Hozir tizim qanday ishlaydi
1. Reja **agent (user_id)** ga yoziladi: `sales_kpi_plan_targets`.  
2. Status: `draft` → `pending_approval` → **`approved`**.  
3. KPI hisobi `approved` / `pending_approval` ni oladi.  
4. Oy o‘rtasi swap uchun **`plan_policy`** faqat **o‘qishda** ulush beradi (FULL/prorata) — **tasdiqlangan qatorni o‘zgartirmaydi**.  
5. Yangi agentga target **avtomatik yaratilmaydi**.

### Senariylar (plan ALLAQACHON tasdiqlangan)

#### A) Joyda almashuv: A ketdi, B keldi (bir xil slot)
| Kim | Plan bazasi | Hisob (default policy) |
|-----|-------------|-------------------------|
| **A** (oy boshida ishlagan) | O‘zining tasdiqlangan targeti **qoladi** | **FULL** oy rejasi |
| **B** (oy o‘rtasida) | Target **yo‘q** bo‘lsa → KPI da 0 | Agar B ga **shu joy rejasi** yozilsa/nusxa → **PRORATA** (qolgan kunlar) |

**Muhim:** Tasdiqlangan reja «joy»niki emas, hozircha «A shaxs»niki. Shuning uchun B ga alohida qadam kerak (nusxa yoki yangi target).  
**FINAL reja P1 dan keyin:** target **slot**ga bog‘lanadi → A/B almashganda joy rejasi bir xil; ulush policy bilan.

#### B) Ishchi KAMAYDI: A ishdan / unassign, o‘rniga hech kim yo‘q
| Nima | Natija |
|------|--------|
| Slot config | Joyda qoladi (P0 dan keyin) |
| Mijozlar | Qulflanmaganlari A da qolishi yoki pending (hozir unassign migrate qilmaydi — diqqat) |
| A ning tasdiqlangan plani | **Qoladi**, FULL hisob (starter) |
| Joy bo‘yicha jamoa plan yig‘indisi | A hali «planli»; bo‘sh slot yangi fakt bermaydi |
| Tabel | A past+qizil, chiqishdan keyin blok |

**Biznes savol:** bo‘sh slotning oy rejasi jamoa totaliga kiritilsinmi?  
**Tavsiya:** ha — slot plan saqlansin; bajarilish 0 ga yaqin (xodim yo‘q).

#### C) Ishchi QO‘SHILDI: yangi slot + yangi agent (oy o‘rtasida)
| Nima | Natija |
|------|--------|
| Eski tasdiqlangan planlar | O‘zgarmaydi |
| Yangi joy/agent | **Yangi target** kerak (qo‘lda yoki «slotdan nusxa») |
| Ulush | Kelgan kundan PRORATA (agar policy default) |
| Jamoa totali | + yangi (prorata) summa — **oshadi**, agar target qo‘shilsa |

#### D) Ishchi qisqardi: slot yopildi / arxiv
| Nima | Tavsiya |
|------|---------|
| Tasdiqlangan target | Oy oxirigacha saqlash (audit); keyingi oyga yo‘q |
| KPI | Starter FULL; yangi oyda slot inactive → target yo‘q |

### «Plan qayta tasdiqlash kerakmi?»

| Holat | Avto o‘zgarishmi? | Admin nima qiladi |
|-------|-------------------|-------------------|
| Swap A→B, B ga target yo‘q | Yo‘q | B ga target qo‘shish yoki «slot rejasidan nusxa» |
| Swap, target slotga o‘tgan (P1) | Raqam o‘zgarmaydi | Qayta approve **shart emas**; faqat ulush hisobda |
| Yangi slot oy o‘rtasida | Yo‘q | Yangi target + ixtiyoriy qisqa approve oqimi |
| Raqamni o‘zgartirish kerak | — | Return to draft → tahrir → qayta approve |

**Qoida (FINAL ga qo‘shamiz):**  
> `approved` reja **avtomatik qayta draft bo‘lmaydi** swap/unassign da.  
> O‘zgaradi faqat **kimga tegishli** (user→slot) va **hisob ulushi** (policy).  
> Yangi odam/joy uchun target **yo‘q** → alohida yaratish (yoki swap paytida «nusxa + prorata» opsiyasi).

---

## 4. Tavsiya qilinadigan PLAN qoidasi (maqullash uchun)

Oy o‘rtasida, plan **allaqachon approved**:

1. **Almashtirish (A→B, bir slot)**  
   - Joy rejasi (slot target) saqlanadi.  
   - A: FULL (oy boshida turgan).  
   - B: PRORATA.  
   - Approve qayta **kerak emas**.

2. **Ishdan olish, o‘rin bo‘sh**  
   - Slot + plan qoladi.  
   - A: FULL, fakt to‘xtaydi.  
   - Mijoz siyosati: alohida (qulf / pending).

3. **Yangi ishchi + yangi slot**  
   - Yangi target (to‘liq oy yoki prorata — tanlov).  
   - Default: **prorata** kelgan kundan.  
   - Kichik approve yoki admin «qo‘shish» huquqi.

4. **Jamoa yig‘indisi**  
   - Starter FULL + yangi PRORATA = odatda **bir joy uchun ~1× oy** (ikki to‘liq emas).  
   - `full_both` policy bo‘lsa — ataylab 2× bo‘ladi (sozlama).

---

## 5. Audit xulosasi

| Band | Holat |
|------|--------|
| 1→2→3 zanjir | Tartib bilan **xavfsiz**; eng xavfli — ikki yozish manbasi va Z4 ni erta qilish |
| Keyingi bog‘lanishlar | Konflikt **oldini olish** mumkin (ro‘yxat §2) |
| Plan tasdiqlangan + ± xodim | Raqam saqlanadi; ulush policy; **yangi uchun target qoida** kerak |
| Bo‘shliq (hozir) | Swapda B ga target avtomatik emas; unassign mijozlarni ko‘chirmaydi |

---

## 6. FINAL reja ga qo‘shiladigan 3 band (agar rozimisiz)

1. Swap UI: «Joy rejasini yangi xodimga nusxalash (prorata)» checkbox.  
2. Unassign siyosati: mijozlar qoladimi / pendingmi — aniq qoida.  
3. Approved plan hech qachon avto-draft bo‘lmasin (faqat qo‘lda return).

---

**Keyingi qadam:** shu audit + plan qoidasi maqulmi?  
Maqul bo‘lsa — P0 (config slotga) + yuqoridagi 3 bandni reja bilan birga kodga olamiz.
