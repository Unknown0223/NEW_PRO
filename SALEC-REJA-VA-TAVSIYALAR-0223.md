# SALEC — Loyihani rivojlantirish rejasi va tavsiyalar

> _0223 jamoasi uchun tuzilgan batafsil reja, texnik tavsiyalar va real misollar._

---

## 1. Loyihaning joriy holati tez ko‘rinishi

| Bo‘lim | Holat | Izoh |
|--------|-------|------|
| **Konsignatsiya (konsigantsiya)** | Yaxshi | Oy yopilish `period_closed_at`, qarz yopilishi `debt_cleared_at` — avtomatik hisoblanadi, bildirishnomalar bor |
| **Bonus tizimi** | Yaxshi | BonusRule, BonusStrategy, PayrollBonusAssignment — ishlayapti |
| **Avtomatik jadval aniqlash** | Qisman | Faqat `clients.import.runtime.ts` da — `findImportTableInWorkbook()` |
| **Push / Bildirishnomalar** | Qisman | Faqat in-app (`InAppNotification`), FCM (`DeviceToken`) faqat model darajasida |
| **Interfeyslar (UI)** | O‘rtacha | Frontend to‘g‘ri ishlayapti, lekin ba‘zi joylarni yaxshilash mumkin |
| **Rollar (roles)** | Yaxshi | Agent, supervisor, admin, kasbbo‘yicha (CBR, expeditor, SVR) — asosiy kontseptsiya tayyor |

---

## 2. Asosiy muammo: qarz erta yopilsa — bonus berilsin

### 2.1. Joriy holat (nima bor)

- `AgentConsignmentMonthStatus` modeli:
  - `period_closed_at` — oy yopilgan sana (masalan, har oyning 5-sanasidan keyin)
  - `debt_cleared_at` — qarz to‘liq to‘langan sana
- `reconcileAgentConsignmentMonthClosure()` har kuni (6 soatda) barcha agentlar uchun hisoblaydi
- Qarz 0 ga teng bo‘lsa — `debt_cleared_at` ga sana yoziladi
- **Hozircha hech qanday bonus berilmaydi**

### 2.2. Yangi bonus mexanizmi (ER TAKLIFI)

#### Qadam 1: Yangi model — `ConsignmentEarlyClosureBonus`

```prisma
model ConsignmentEarlyClosureBonus {
  id                  Int      @id @default(autoincrement())
  tenant_id           Int
  agent_user_id       Int
  year                Int
  month               Int
  period_closed_at    DateTime
  debt_cleared_at     DateTime
  bonus_amount        Decimal  @db.Decimal(12, 2)
  bonus_percentage    Decimal  @db.Decimal(5, 2)   // masalan: 5.00 = 5%
  base_debt_amount    Decimal  @db.Decimal(12, 2) // qancha qarz boshlang‘ichda bo‘lgan
  days_before_close   Int                           // necha kun oldin yopilgan
  granted_at          DateTime  @default(now())
  granted_by_user_id  Int?
  note                String?
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt

  tenant    Tenant @relation(fields: [tenant_id])
  agent     User   @relation(fields: [agent_user_id])

  @@unique([tenant_id, agent_user_id, year, month])
  @@index([tenant_id, agent_user_id])
}
```

#### Qadam 2: Bonus shartlari

| Shart | Tushuntirish | Hisoblash formuli |
|-------|--------------|-------------------|
| **Qarz 0 ga teng** | Barcha konsignatsiya qarzlar to‘liq to‘langan | `computeAgentMonthConsignmentDebt() === 0` |
| **Yopilish sanasidan oldin** | Qarz `period_closed_at` dan kamida 1 kun oldin yopilgan | `debt_cleared_at < period_closed_at` |
| **Bonus foizi** | Admin tomonidan belgilanadi (masalan, 3% — 10%) | `base_debt * bonus_percentage / 100` |
| **Maksimal bonus** | Kuniga chegaralar bo‘lishi mumkin | `Math.min(bonus_amount, daily_cap)` |
| **Minimal qarz** | Juda kichik qarzlarga bonus berilmasligi mumkin | `base_debt >= min_bonus_threshold` |

#### Qadam 3: Loyihaga qo‘shish (backend)

**Fayl:** `backend/src/modules/consignment/consignment-early-closure-bonus.service.ts`

```typescript
export type EarlyClosureBonusInput = {
  tenantId: number;
  agentId: number;
  year: number;
  month: number;
  bonusPercentage: number;      // masalan: 5 (5%)
  minBaseDebt?: number;         // default: 0
  dailyCap?: number | null;     // default: null (cheksiz)
};

export async function evaluateAndGrantEarlyClosureBonus(
  input: EarlyClosureBonusInput
): Promise<{ granted: boolean; bonus?: number; reason?: string }> {
  // 1. Qarzni hisoblaymiz
  const debt = await computeAgentMonthConsignmentDebt(...);

  // 2. Yopilish holatini tekshiramiz
  const status = await findAgentConsignmentMonthStatus(...);

  // 3. Shartlarni tekshiramiz
  //    - debt === 0
  //    - debt_cleared_at < period_closed_at

  // 4. Bonus miqdorini hisoblaymiz
  //    bonus = base_debt * percentage / 100

  // 5. Saqlaymiz
  //    INSERT INTO ConsignmentEarlyClosureBonus ...

  // 6. Bildirishnoma yuboramiz
}
```

**Fayl:** `backend/src/modules/consignment/consignment-early-closure-bonus.route.ts`

```typescript
// GET /api/:slug/consignment/bonus-settings
// PATCH /api/:slug/consignment/bonus-settings
// POST /api/:slug/consignment/bonus/evaluate
// GET /api/:slug/consignment/agents/:id/bonus-history
```

#### Qadam 4: Reja (cron) orqali avtomatik grant

`consignment-closure-cron.ts` ga qo‘shish:

```typescript
// Har kuni tonggi soat 02:00 da (tenant vaqti)
// Barcha agentlar uchun evaluateAndGrantEarlyClosureBonus() ni chaqirish
```

---

## 3. Avtomatik jadval aniqlash — umumiy tizimga oshirish

### 3.1. Joriy holat

Faqat **client import** uchun mavjud:
- `clients.import.runtime.ts` — `findImportTableInWorkbook()`
- Excel fayldagi barcha sheetlarni skanerlaydi, 50 ta qatorni tekshiradi
- Sarlavhalarni topadi, eng ko‘p ma‘lumotli jadvalni tanlaydi

### 3.2. Yangi umumiy tizim

**Yangi modul:** `backend/src/modules/import-table-detector/`

```
backend/src/modules/import-table-detector/
  ├── detector.service.ts          # Asosiy logika
  ├── detector.types.ts            # Tiplar
  └── detector.route.ts            # API endpoint
```

**Asosiy funksiya:**

```typescript
export interface DetectedTable {
  sheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  columns: Array<{
    excelColumn: string;   // A, B, C ...
    detectedKey: string;   // clients.name, products.price ...
    confidence: number;    // 0..1
  }>;
  rowCount: number;
}

export function detectTableInWorkbook(
  workbook: XLSX.WorkBook,
  expectedKeys: string[]
): DetectedTable | null;
```

**Ishlash prinsipi:**

1. Barcha sheetlarni aylanib chiq
2. Har bir sheetning birinchi 50 qatorini tekshir
3. Sarlavhalarni `excelHeaderToImportKey()` orqali mapping qil
4. Eng ko‘p mos kelgan columnlar bo‘lgan jadvalni tanlash
5. `confidence` — necha foiz sarlavha topilganini aytadi

**Modullarga qo‘llash:**

| Modul | Joriy holat | Yangi holat |
|-------|-------------|-------------|
| Client import | `findImportTableInWorkbook()` | `detectTableInWorkbook()` |
| Product import | Excel import mavjud | Jadval avtomatik aniqlanadi |
| Stock import | Excel import mavjud | Jadval avtomatik aniqlanadi |
| Staff import | Excel import mavjud | Jadval avtomatik aniqlanadi |
| Consignment limit import | Excel import mavjud | Jadval avtomatik aniqlanadi |

---

## 4. Push / Bildirishnomalar tizimi — umumiy

### 4.1. Joriy holat

- `InAppNotification` modeli — ichki ilova uchun
- `notifyUsers()` — in-app yuborish
- `DeviceToken` modeli — FCM uchun (lekin faollashtirilmagan)
- **Mobil app:** bildirishnomalar faqat in-app, push yo‘q

### 4.2. Tavsiya: 3 bosqichli push tizimi

#### Bosqich 1: In-app bildirishnomalar (tayyor)

- `notifyUsers()` funksiyasidan foydalanish
- Barcha modullarda (consignment, payroll, advances) ishlatish

#### Bosqich 2: Telegram bot (qo‘shimcha)

- `telegram-client-bot/` mavjud — uni kengaytirish
- Agentlarga bildirishnoma yuborish:
  - Qarz yopilganda
  - Bonus berilganda
  - O‘zgartirishlar bo‘lganda

#### Bosqich 3: FCM push (mobil ilova)

- `DeviceToken` modeli allaqachon mavjud
- `backend/src/lib/notifications/fcm.service.ts` yaratish
- Mobil ilova tokenlarni yuborish
- Push orqali: qarz ogohlantirishlari, bonuslar

---

## 5. Interfeys (UI) ni professional qilish rejasi

### 5.1. Umumiy tamoyillar

| Tamoyil | Tavsifi |
|---------|---------|
| **Aniqlik (Clarity)** | Foydalanuvchi bir qarashda nima qilishini tushunishi kerak |
| **Tezkorlik (Speed)** | Ko‘p ma‘lumotni bir necha bosqichda ko‘rish (ekspand/collapse) |
| **Ijobiy tasdiqlash (Positive feedback)** | Har bir harakat natijasini ko‘rsatish |
| **Xatolarni oldini olish (Prevention)** | Xavfli amallarni tasdiqlash bilan boshqarish |
| **Ranglar (Color)** | Yashil — yaxshi, qizil — xato, sariq — ogohlantirish |

### 5.2. Konsignatsiya sahifasi — qayta dizayn

**Hozirgi muammolar:**

- Juda ko‘p ma‘lumot bir vaqtda — chalkash
- Qarz summasi faqat raqam — vizual yo‘q
- Yopilish sanasi oddiy — tushunarsiz

**Takliflar:**

#### A) Boshqaruv paneli (Dashboard)

```
┌─────────────────────────────────────────┐
│  KONSIGNATSIYA — BOSHQARUV PANELI       │
├─────────────────────────────────────────┤
│                                         │
│  [Joriy oy]  [Oktyabr 2026]  [Yangilash]│
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │Agentlar│ │Qarz  │ │Bonus │ │Yopilgan│  │
│  │  42   │ │12.5M │ │ 8 ta │ │  35 ta │  │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                         │
│  [Grafik: Qarz dinamikasi]              │
│                                         │
│  [Agentlar ro‘yxati — filterlar]        │
│                                         │
└─────────────────────────────────────────┘
```

#### B) Agentlar ro‘yxati — yangi ko‘rinish

| Agent | Qarz | Limit | Yopilish | Bonus | Holat |
|-------|------|-------|----------|-------|-------|
| Ali  | 2.5M | 5M | 05.10 | 125K | 🟢 To‘langan |
| Vali | 8.0M | 10M | 05.10 | ⏳ | 🟡 Kutilmoqda |
| Sodiq| 0 | 3M | 05.10 | 150K | 🟢 Bonus berildi |

**Yangi ustunlar:**
- `bonus_status` — bonus berildi / kutilmoqda / berilmadi
- `days_until_close` — necha kun qoldi yopilishgacha
- `early_closure_potential` — agar hozir to‘lasa, necha bonus olishi mumkin

#### C) Agent tafsiloti (modal)

```
┌─────────────────────────────────────────┐
│  Ali Karimov — konsignatsiya tafsiloti  │
├─────────────────────────────────────────┤
│                                         │
│  Qarz: 2,500,000 so‘m                   │
│  Limit: 5,000,000 so‘m                  │
│  Qolgan limit: 2,500,000 so‘m           │
│                                         │
│  Yopilish sanasi: 05.10.2026            │
│  Qoldi: 3 kun                           │
│                                         │
│  Agar hozir to‘lasa:                    │
│  Bonus: 125,000 so‘m (5%)              │
│                                         │
│  [Qarz to‘lash] [Yopish]                │
│                                         │
└─────────────────────────────────────────┘
```

### 5.3. Bonus sozlamalari — yangi interfeys

**`/settings/bonus-rules/` sahifasiga qo‘shish:**

```
┌─────────────────────────────────────────┐
│  BONUS SOZLAMALARI                       │
├─────────────────────────────────────────┤
│                                         │
│  Konsignatsiya uchun erta yopish:        │
│                                         │
│  [ ] Aktiv                              │
│                                         │
│  Bonus foizi: [5] %                     │
│  Minimal qarz: [100,000] so‘m           │
│  Kunlik cheklov: [500,000] so‘m         │
│                                         │
│  Qo‘llash:                              │
│  ( ) Barcha agentlar                     │
│  ( ) Tanlangan guruhlar                  │
│  ( ) Tanlangan agentlar                  │
│                                         │
│  [Saqlash]                              │
└─────────────────────────────────────────┘
```

### 5.4. Frontend tuzilishi (pages)

```
frontend/app/(dashboard)/
  ├── settings/
  │   ├── consignment/
  │   │   ├── page.tsx                     # Asosiy konsignatsiya sahifasi
  │   │   ├── bonus-settings/
  │   │   │   └── page.tsx                 # Yangi: bonus sozlamalari
  │   │   └── bonus-history/
  │   │       └── page.tsx                 # Yangi: bonus tarixi
  │   └── bonus-rules/
  │       └── [id]/edit/
  │           └── page.tsx                 # Yangi: konsignatsiya bonus flagi
  └── reports/
      └── consignment-bonus/
          └── page.tsx                     # Yangi: bonus hisoboti
```

### 5.5. Komponentlar (yangi)

```
frontend/components/consignment/
  ├── consignment-dashboard.tsx            # Boshqaruv paneli
  ├── consignment-agent-table.tsx          # Agentlar jadvali (yangilangan)
  ├── consignment-agent-detail-modal.tsx   # Agent tafsiloti
  ├── bonus-settings-form.tsx              # Bonus sozlamalari formasi
  ├── bonus-history-table.tsx              # Bonus tarixi jadvali
  ├── bonus-badge.tsx                      # Bonus statusi belgisi
  ├── early-closure-potential.tsx          # Ertaga yopish potensiali
  └── import-table-detector.tsx            # Avtomatik jadval aniqlash UI
```

---

## 6. Texnik reja — Qadamlar

### Bosqich 1: Backend (hafta 1-2)

1. **`ConsignmentEarlyClosureBonus` modeli va migratsiya**
   - `backend/prisma/models/group-*.prisma` ga qo‘shish
   - Migratsiya yaratish: `npx prisma migrate dev --name add_early_closure_bonus`

2. **Bonus xizmati (service)**
   - `consignment-early-closure-bonus.service.ts`
   - `evaluateAndGrantEarlyClosureBonus()` funksiyasi
   - Shartlarni tekshirish, hisoblash, saqlash

3. **API endpointlar**
   - `GET /api/:slug/consignment/bonus-settings`
   - `PATCH /api/:slug/consignment/bonus-settings`
   - `POST /api/:slug/consignment/bonus/evaluate`
   - `GET /api/:slug/consignment/agents/:id/bonus-history`

4. **Cron integratsiya**
   - `consignment-closure-cron.ts` ga avtomatik grant qo‘shish

### Bosqich 2: Frontend (hafta 2-3)

5. **Bonus sozlamalari sahifasi**
   - `/settings/consignment/bonus-settings/page.tsx`
   - `bonus-settings-form.tsx` komponenti

6. **Konsignatsiya jadvalini yangilash**
   - `consignment-agent-table.tsx` — yangi ustunlar
   - `bonus-badge.tsx` — status belgisi
   - `early-closure-potential.tsx` — potensial bonus

7. **Agent tafsiloti**
   - `consignment-agent-detail-modal.tsx`
   - Qarz to‘lash, bonus ko‘rish

8. **Bonus hisoboti**
   - `/reports/consignment-bonus/page.tsx`
   - `bonus-history-table.tsx`

### Bosqich 3: Avtomatik jadval aniqlash (hafta 3-4)

9. **Umumiy detector moduli**
   - `import-table-detector/` yaratish
   - Mavjud `findImportTableInWorkbook()` ni refactor qilish

10. **Barcha import modullarini yangilash**
    - Client, product, stock, staff, consignment limit

### Bosqich 4: Push bildirishnomalar (hafta 4)

11. **Telegram bot integratsiya**
    - `telegram-client-bot/` ni kengaytirish

12. **FCM push (mobil)**
    - `fcm.service.ts` yaratish
    - Mobil ilova tokenlarni yuborish

### Bosqich 5: Test va dokumentatsiya (hafta 5)

13. **Backend testlar**
    - Bonus hisoblash testlari
    - Shartlarni tekshirish testlari
    - Cron integratsiya testlari

14. **Frontend testlar**
    - UI komponent testlari
    - Form validatsiya testlari

15. **Dokumentatsiya**
    - API hujjatlari
    - Foydalanuvchi qo‘llanmasi

---

## 7. Real misol (oddiy tushuntirish)

### Ssenariy: Ali agent — erta qarz yopish

**1. Boshlanish holati (1-oktyabr):**

- Ali agentning oktyabr oyi uchun konsignatsiya qarzi: **10,000,000 so‘m**
- O‘y yopilish sanasi: **5-noyabr** (har oyning 5-sanasidan keyin)
- Admin tomonidan belgilangan bonus foizi: **5%**
- Minimal qarz: **100,000 so‘m**

**2. Jarayon (1-oktyabr dan 3-noyabrgacha):**

- Ali agent kuniga kuniga to‘lov qiladi
- 3-noyabr kuni qarz **0** ga teng bo‘ladi

**3. Yopish (3-noyabr):**

- `debt_cleared_at` = 3-noyabr 2026, 14:30
- `period_closed_at` = 5-noyabr 2026, 00:00
- Farq: **1 kun 9 soat 30 daqiqa oldin**

**4. Bonus hisoblash:**

```
Base qarz: 10,000,000 so‘m
Bonus foizi: 5%
Bonus = 10,000,000 * 5 / 100 = 500,000 so‘m
```

**5. Natija:**

- `ConsignmentEarlyClosureBonus` yozuvi yaratiladi
- Ali agentning balansiga **+500,000 so‘m** qo‘shiladi
- Telegram/FCM push: "Tabriklaymiz! Qarzni erta yopdingiz — 500,000 so‘m bonus"
- In-app bildirishnoma: "✅ Qarz yopildi — 500,000 so‘m bonus berildi"

### Qachon bonus berilmaydi?

| Holat | Sabab |
|-------|-------|
| Qarz 5-noyabr kuni yopilsa | `debt_cleared_at >= period_closed_at` — shart bajarilmagan |
| Qarz 8-noyabr kuni yopilsa | O‘ta kech — bonus yo‘q |
| Qarz 50,000 so‘m bo‘lsa | `min_bonus_threshold` dan kam — bonus yo‘q |

---

## 8. Qo‘shimcha tavsiyalar

### A) KPI guruhlari uchun bonus formuli (allaqachon qo‘shildi)

- `KpiGroup.bonus_formula` — har bir guruh uchun alohida bonus formuli
- Formulalar: `IF(AND(kpi1>100, kpi2>80), salary*0.1, 0)`
- Bu konsignatsiya bonusiga ham qo‘llanilishi mumkin

### B) Qarz to‘lash uchun rag‘batlantirish

- Agentlarga qarzni erta to‘lash uchun bonus — bu biznesni yaxshi yo‘naltiradi
- Qarzni kech to‘lash — javobgarlikni oshiradi

### C) Avtomatik jadval aniqlash

- Har bir import turi uchun header mapping jadvali tayyorlash
- Masalan:
  - `clients/` — `clients.import.keys.ts`
  - `products/` — `products.import.keys.ts`
  - `stock/` — `stock.import.keys.ts`
- Ularni umumiy `detector.service.ts` da birlashtirish

### D) Testlar

```typescript
// Misol: bonus hisoblash testi
it("qarz erta yopilsa, bonus beriladi", async () => {
  // 1. Agent yaratish, qarz yaratish
  // 2. Qarzni to‘lash
  // 3. evaluateAndGrantEarlyClosureBonus() ni chaqirish
  // 4. Bonus miqdorini tekshirish
});

it("qarz kech yopilsa, bonus berilmaydi", async () => {
  // period_closed_at dan keyin debt_cleared_at
  // Bonus bo‘lmasligi kerak
});
```

---

## 9. Qisqa xulosa

| Nima | Qachon | Qancha |
|------|--------|--------|
| **Bonus modeli** | Hafta 1-2 | 2-3 kun |
| **Backend service + API** | Hafta 1-2 | 3-4 kun |
| **Frontend sahifalar** | Hafta 2-3 | 4-5 kun |
| **Avtomatik jadval aniqlash** | Hafta 3-4 | 3-4 kun |
| **Push bildirishnomalar** | Hafta 4 | 2-3 kun |
| **Testlar va dokumentatsiya** | Hafta 5 | 2-3 kun |
| **JAMI** | **~5 hafta** | **~15-20 kun** |

---

## 10. Bog‘liqliklar va ochiq savollar

| Savol | Javob beruvchi |
|-------|----------------|
| Bonus foizi qancha bo‘lishi kerak? | Admin / Boshqaruvchi |
| Minimal qarz chegarasi qancha? | Admin / Boshqaruvchi |
| Kunlik bonus cheklovi kerakmi? | Admin / Boshqaruvchi |
| Qarz to‘lash usullari (naqd, kart, o‘tkazma) | Mavjud tizimda ishlayapti |
| Mobile ilova push qo‘llab-quvvatlash | Hali yo‘q — rejalashtirish kerak |

---

_Dokument yaratilgan sana: 2026-10-06_
_Jamoa: 0223_
