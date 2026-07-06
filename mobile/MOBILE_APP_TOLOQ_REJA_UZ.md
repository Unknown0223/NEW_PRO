# SalesDoc Mobil Ilova — To'liq Arxitektura, Bog'lanishlar va Reja

> Hujjat sanasi: 2026-05-29  
> Loyiha: SALEC monorepo (`backend/` + `frontend/` + `mobile/`)  
> Mobil ilova holati: **FAZA 9.1–9.3 tayyor (agent)** + **9.7 server yangilanish** — batafsil: [AGENT_REJA_HOLATI.md](./AGENT_REJA_HOLATI.md)  
> Backend mobil API: **tayyor** (qisman scope filtrlari qo'shilishi kerak)

---

## MUNDARIJA

1. [Umumiy tuzilma](#1-umumiy-tuzilma)
2. [Bitta ilova — Android va iOS (Flutter)](#2-bitta-ilova--android-va-ios-flutter)
3. [Server bilan bog'lanish (API)](#3-server-bilan-boglanish-api)
4. [Veb panel ↔ mobil ilova bog'lanishi](#4-veb-panel--mobil-ilova-boglanishi)
5. [Uchta mobil rol — to'liq reja](#5-uchta-mobil-rol--to-liq-reja)
6. [Ruxsatlar tizimi (RBAC)](#6-ruxsatlar-tizimi-rbac)
7. [Sinxronizatsiya va oflayn ishlash](#7-sinxronizatsiya-va-oflayn-ishlash)
8. [Flutter texnologiya stack](#8-flutter-texnologiya-stack)
9. [Flutter loyiha strukturasi](#9-flutter-loyiha-strukturasi)
10. [Bootstrap — bir martalik moslashuv](#10-bootstrap--bir-martalik-moslashuv)
11. [Dizayn tizimi](#11-dizayn-tizimi)
12. [Veb panel — admin nima qiladi](#12-veb-panel--admin-nima-qiladi)
13. [Rivojlantirish bosqichlari (FAZA 9)](#13-rivojlantirish-bosqichlari-faza-9)
14. [Tayyor vs qo'shilishi kerak](#14-tayyor-vs-qo-shilishi-kerak)
15. [API endpointlar ro'yxati](#15-api-endpointlar-ro-yxati)
16. [mobile_config to'liq kalitlar jadvali](#16-mobile_config-to-liq-kalitlar-jadvali)
17. [Xulosa](#17-xulosa)

---

## 1. UMUMIY TUZILMA

### 1.1 Monorepo tuzilmasi

```
SALEC monorepo
├── backend/          → Fastify API, PostgreSQL, Redis (port 18080)
├── frontend/         → Next.js 14 veb panel (port 3000)
└── mobile/           → Flutter mobil ilova (Android + iOS) — FAZA 9
```

### 1.2 Kim qaysi interfeysdan foydalanadi

| Qism | Texnologiya | Foydalanuvchilar |
|------|-------------|------------------|
| `frontend/` | Next.js 14 + React + Tailwind | Admin, operator, buxgalter, ombor, direktor |
| `mobile/` | Flutter + Dart | Agent, ekspeditor, supervayzer |
| `backend/` | Fastify + Prisma | Ikkala frontend uchun umumiy API |

### 1.3 Arxitektura sxemasi

```
┌─────────────────┐     ┌─────────────────┐
│  frontend/      │     │  mobile/        │
│  Next.js (web)  │     │  Flutter (app)  │
│  Port: 3000     │     │  Android + iOS  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTPS + JWT Bearer
                     ▼
            ┌─────────────────┐
            │  backend/       │
            │  Fastify API    │
            │  Port: 18080    │
            └────────┬────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   PostgreSQL                 Redis
   (asosiy ma'lumot)          (kesh, SSE, navbat)
```

### 1.4 Asosiy g'oya

- **Bitta Flutter ilova** — App Store va Google Play ga bitta nom bilan chiqadi.
- Login qilgandan keyin tizim avtomatik ravishda:
  - rolni (`agent` / `expeditor` / `supervisor`) aniqlaydi;
  - ruxsatlarni yuklaydi;
  - `mobile_config` ni oladi;
  - ma'lumotlarni sinxronlaydi;
  - navigatsiya va ekranlarni shu rolga moslashtiradi.
- Veb frontend Flutterga ko'chirilmaydi — ular parallel ishlaydi.

---

## 2. BITTA ILOVA — ANDROID VA IOS (FLUTTER)

### 2.1 Nima uchun Flutter

Flutter tanlangan sabab: **bitta kod bazasi** → Android va iOS ga bir vaqtda build. Native Swift (iOS) va Kotlin (Android) alohida yozish shart emas.

### 2.2 Build tuzilmasi

```
mobile/  (Flutter loyiha)
    │
    ├── android/     → APK / AAB (Google Play)
    ├── ios/         → IPA (App Store)
    └── lib/         → umumiy Dart kodi (~99% bir xil)
```

### 2.3 Platform taqqoslash

| Platform | Flutter qanday ishlaydi | Store |
|----------|-------------------------|-------|
| Android | Dart → ARM bytecode → APK/AAB | Google Play |
| iOS | Dart → AOT compile → native ARM64 | App Store |

### 2.4 Platformga xos qismlar (faqat shu joylarda native)

| Vazifa | Android | iOS |
|--------|---------|-----|
| Token saqlash | Android Keystore | iOS Keychain |
| Push bildirishnoma | FCM | FCM → APNs |
| GPS ruxsat | Android permissions | iOS Info.plist |
| Barmoq izi | BiometricPrompt | Face ID / Touch ID |
| Kamera | Camera permission | Camera permission |

---

## 3. SERVER BILAN BOG'LANISH (API)

### 3.1 API base URL

| Muhit | Mobile API base URL | Manba |
|-------|---------------------|-------|
| Lokal dev | `http://127.0.0.1:18080` | `backend/.env` → `PORT=18080` |
| Production | `https://api.sizning-domen.uz` | Deploy konfiguratsiyasi |

Flutter `.env` namunasi:
```
API_BASE_URL=http://127.0.0.1:18080
```

Veb panel API (frontend) dev rejimda:
- `NEXT_PUBLIC_API_URL` yoki proxy orqali `http://127.0.0.1:18080`
- Manba: `frontend/lib/api.ts`

### 3.2 Har bir HTTP so'rovda kerak bo'ladigan narsalar

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Tenant marshrutlari uchun URL da slug majburiy:
```
GET  /api/{tenant_slug}/mobile/agent-config
POST /api/{tenant_slug}/mobile/sync/full
POST /api/{tenant_slug}/agent-locations
```

### 3.3 Tenant xavfsizligi

Backend `backend/src/plugins/tenant.plugin.ts`:
- URL dan `slug` ni oladi (`/api/{slug}/...`)
- JWT ichidagi `tenantId` bilan solishtiradi
- Mos kelmasa → `403 CrossTenantDenied`

Auth marshrutlari tenant talab qilmaydi:
- `/api/auth/login`
- `/api/auth/refresh`
- `/api/auth/logout`
- `/api/auth/me`

### 3.4 Auth oqimi (ketma-ketlik)

```
1. POST /api/auth/login
   Body: { slug, login, password, device_name? }
   Javob: { accessToken, refreshToken, user: { id, name, login, role, tenantId } }

2. GET /api/auth/me
   Header: Authorization: Bearer <accessToken>
   Javob: { user: { id, login, role, tenantId, tenantSlug, work_slot_id, work_slot_code } }

3. GET /api/{slug}/access/me-permissions
   Javob: { data: { keys: ["orders.view", ...] } }

4. GET /api/{slug}/mobile/agent-config
   Javob: { user_id, mobile_config, agent_entitlements, work_slot_id, work_slot_code }

5. POST /api/{slug}/mobile/sync/full
   Body: { last_sync_at: null | "ISO8601" }
   Javob: { sync_at, clients[], products[], prices[], orders[] }

6. POST /api/{slug}/mobile/fcm/register
   Body: { token, device_type: "android" | "ios" | "web" }
   Javob: { ok: true }
```

### 3.5 Token siyosati

| Token | Muddat | Yangilash |
|-------|--------|-----------|
| accessToken | 15 daqiqa | `POST /api/auth/refresh` |
| refreshToken | 30 kun | Login da yangi beriladi |

Manba: `backend/src/modules/auth/auth.service.ts`

### 3.6 Login body (to'liq schema)

```json
{
  "slug": "test1",
  "login": "agent01",
  "password": "secret123",
  "device_name": "Samsung Galaxy A54"
}
```

Schema manbai: `backend/src/contracts/auth.schemas.ts`

### 3.7 JWT payload tarkibi

```json
{
  "sub": "123",
  "tenantId": 1,
  "role": "agent",
  "login": "agent01",
  "tenantSlug": "test1"
}
```

---

## 4. VEB PANEL ↔ MOBIL ILOVA BOG'LANISHI

### 4.1 Konfiguratsiya zanjiri

```
Veb panel (frontend/)              Backend DB                         Mobil ilova (Flutter)
─────────────────────              ──────────                         ────────────────────
/users/agents                      users.agent_entitlements           GET mobile/agent-config
  → "Конфигурации" dialog   →       .mobile_config            →       mobile_config o'qiladi
  → app_access checkbox     →       users.app_access          →       kirish ruxsati
  → price_types             →       agent_entitlements        →       narx turi scope
  → product_rules           →       agent_entitlements        →       mahsulot scope

/users/expeditors                  xuddi shu users jadvali            expeditor UI
  → ExpeditorConfigurationsDialog

/users/supervisors                 xuddi shu users jadvali            supervisor UI
  → AgentConfigurationsDialog (supervisor variant)
```

### 4.2 Veb paneldagi konfiguratsiya UI (mavjud kod)

| Rol | Veb komponent | Saqlash API |
|-----|---------------|-------------|
| Agent | `frontend/components/staff/agent-configurations-dialog.tsx` | `PATCH /api/{slug}/agents/{id}` |
| Ekspeditor | `frontend/components/staff/expeditor-configurations-dialog.tsx` | `PATCH /api/{slug}/expeditors/{id}` |
| Supervayzer | `frontend/components/staff/agent-configurations-dialog.tsx` (variant: supervisor) | `PATCH /api/{slug}/supervisors/{id}` |

### 4.3 Agent konfiguratsiya tablari (veb panel)

| Tab (veb) | `mobile_config` bloki |
|-----------|----------------------|
| Клиент | `client.*` |
| Gps | `gps.*` |
| Outlet (План) | `outlet.*` |
| Настройки список продуктов | `product_list.*` |
| Фото | `photo.*` |
| Прочие настройки | `misc.*` |
| Синхронизация | `sync.*` |
| Добавления заказа | `orders.*` |
| Аудит | `supervision.*` |
| ВанСеллинг | `van_selling.*` |

Supervayzer uchun faqat 3 tab ko'rsatiladi: `client`, `gps`, `misc` + `supervision`.

Ekspeditor qo'shimcha: `expeditor.*` bloki (to'lov, yo'nalish, barmoq izi).

### 4.4 Schema manbalari (backend ↔ frontend mirror)

| Fayl | Vazifa |
|------|--------|
| `backend/src/modules/staff/agent-mobile-config.types.ts` | Backend schema (manba) |
| `backend/src/modules/staff/agent-mobile-config.parse.ts` | Parse va whitelist |
| `backend/src/modules/staff/agent-mobile-config.validate.ts` | Validatsiya |
| `frontend/components/staff/agent-mobile-config-types.ts` | Frontend mirror (bir xil schema) |
| `frontend/components/staff/agent-mobile-config-order-options.ts` | Buyurtma opsiyalari |

Saqlash joyi: `User.agent_entitlements.mobile_config` (`schema_version: 1`)

### 4.5 app_access — ilovaga kirish ruxsati

| Rol | Veb workspace fayli | DB maydon |
|-----|---------------------|-----------|
| Agent | `frontend/components/staff/agents-workspace.tsx` | `users.app_access` |
| Ekspeditor | `frontend/components/staff/expeditors-workspace.tsx` | `users.app_access` |
| Supervayzer | `frontend/components/staff/supervisors-workspace.tsx` | `users.app_access` |

Default: agent yaratilganda `app_access = true` (field staff).
Web staff (operator va hokazo): default `app_access = false`.

**Muhim:** hozir `POST /api/auth/login` `app_access` ni tekshirmaydi.
Mobil ilova bootstrap da o'zi tekshirishi kerak yoki backend `/auth/me` ga qo'shilishi kerak.

### 4.6 Ishchi o'rni (Work Slot)

| Endpoint | Maydonlar |
|----------|-----------|
| `GET /api/auth/me` | `work_slot_id`, `work_slot_code` |
| `GET /api/{slug}/mobile/agent-config` | `work_slot_id`, `work_slot_code` |

Slot turlari (`backend/src/modules/work-slots/work-slots.constants.ts`):
- agent → prefiks `A`
- expeditor → prefiks `E`
- supervisor → prefiks `N`
- collector → prefiks `I`
- skladchik → prefiks `S`
- auditor → prefiks `U`

Mobil profilda stiker ko'rsatiladi (masalan `A-12`).
Veb panelda vaqtinchalik ko'rsatkich: `WorkSlotProfileBadge` (`frontend/components/work-slots/`).

### 4.7 last_sync_at — veb panel bilan bog'lanish

Backend `sync/full` yoki `sync/delta` chaqirilganda `users.last_sync_at` yangilanadi.
Veb panel agent jadvalida «Oxirgi sync» ustuni shu qiymatni ko'rsatadi:
- `frontend/components/staff/agents-workspace.tsx` → `last_sync_at`

---

## 5. UCHTA MOBIL ROL — TO'LIQ REJA

Backend mobil API faqat 3 rol ni qabul qiladi.
Manba: `backend/src/modules/mobile/mobile.route.ts`

```typescript
const mobileRoles = ["agent", "expeditor", "supervisor"] as const;
```

### 5.0 Rol jadvali

| # | Rol | O'zbekcha | Mobil ilova | Backend API |
|---|-----|-----------|-------------|-------------|
| 1 | agent | Savdo agenti | ✅ | ✅ |
| 2 | expeditor | Ekspeditor / yetkazuvchi | ✅ | ✅ |
| 3 | supervisor | Supervayzer | ✅ | ✅ |

**Hozircha mobil ilovaga kirmaydigan rollar (veb panel):**
admin, operator, director, sales_director, regional_manager, accountant,
warehouse_manager, skladchik, collector, auditor, cashier, manager, storekeeper,
partner, logist, merchandiser, driver, dispatcher

---

### 5.1 AGENT — Savdo agenti

#### 5.1.1 Asosiy vazifalar

- Mijozlar ro'yxati va profili
- Kunlik vizitlar va marshrut
- Buyurtma yaratish (onlayn va oflayn)
- GPS tracking
- Foto hisobot
- Van selling (harakatda sotish)
- Yangi mijoz yaratish (config ruxsat bersa)

#### 5.1.2 Kunlik ish jarayoni

```
Login
  ↓
Bootstrap (sync + config yuklash)
  ↓
Bosh ekran — bugungi reja / marshrut
  ↓
GPS yoqish (config: gps.tracking_enabled)
  ↓
Mijozga yetib borish
  ↓
Vizit boshlash (config: misc.visit_start_end_enabled)
  ↓
┌─ Buyurtma kerakmi?
│   Ha → Mahsulot tanlash
│        → GPS tekshiruv (config: gps.required_for_order)
│        → Foto tekshiruv (config: photo.required_for_order)
│        → Internet bor? → POST orders / enqueue
│        → Internet yo'q? → Oflayn navbat (SQLite)
│   Yo'q → Refusal (rad etish) → POST agent-visits + refusal_reason_ref
  ↓
Vizit tugatish
  ↓
GPS ping davom etadi (config: gps.tracking_interval_sec)
  ↓
Kun oxirida sync
```

#### 5.1.3 API bog'lanishlari (agent)

| Jarayon | HTTP | Endpoint | Ruxsat / config |
|---------|------|----------|-----------------|
| Login | POST | `/api/auth/login` | — |
| Profil | GET | `/api/auth/me` | JWT |
| Ruxsatlar | GET | `/api/{slug}/access/me-permissions` | JWT |
| Config | GET | `/api/{slug}/mobile/agent-config` | agent rol + permission |
| To'liq sync | POST | `/api/{slug}/mobile/sync/full` | sync permission |
| Delta sync | POST | `/api/{slug}/mobile/sync/delta` | entity_type |
| Oflayn buyurtma | POST | `/api/{slug}/mobile/orders/enqueue` | orders.create |
| Pending soni | GET | `/api/{slug}/mobile/orders/pending` | orders.create |
| GPS ping | POST | `/api/{slug}/agent-locations` | gps.tracking_enabled |
| Vizit | POST | `/api/{slug}/agent-visits` | misc.visit_start_end_enabled |
| Kunlik marshrut | GET | `/api/{slug}/agent-route-days/one` | JWT |
| Marshrutlar ro'yxati | GET | `/api/{slug}/agent-route-days` | JWT |
| Push token | POST | `/api/{slug}/mobile/fcm/register` | JWT |

Manba: `backend/src/modules/mobile/mobile.route.ts`, `backend/src/modules/field/field.route.ts`

#### 5.1.4 Agent mobil ekranlar

| Ekran | Tab | Tavsif |
|-------|-----|--------|
| Home | 🏠 Bosh | Bugungi reja, sync holati, statistika |
| Clients | 👥 Mijozlar | Qidiruv, filter, GPS masofa |
| ClientDetail | — | Profil, saldo, buyurtma tarixi |
| OrderCreate | 📦 Buyurtma | Mahsulot tanlash, bonus, narx |
| Visit | 📍 Vizit | Boshlash/tugatish, GPS, foto |
| Profile | ⚙️ Profil | work_slot_code, sync, chiqish |

Bottom navigation (agent):
```
[ 🏠 Bosh ] [ 👥 Mijozlar ] [ 📦 Buyurtma ] [ 📍 Vizit ] [ ⚙️ Profil ]
```

#### 5.1.5 mobile_config → UI ta'siri (agent)

| Config kaliti | Mobil ilovada natija |
|---------------|---------------------|
| `gps.required_for_order` | Buyurtma yuborishdan oldin GPS majburiy |
| `gps.tracking_enabled` | Fon GPS ping yoqiladi |
| `gps.tracking_interval_sec` | Ping intervali (sekund) |
| `gps.min_battery_pct` | Baterya past bo'lsa ogohlantirish |
| `gps.internet_required_for_order` | Internet bo'lmasa buyurtma blok |
| `photo.required_for_order` | Kamera ochiladi, foto majburiy |
| `photo.max_width_px` / `max_height_px` | Foto siqish |
| `photo.jpeg_quality` | JPEG sifati |
| `client.can_create` | «Yangi mijoz» tugmasi ko'rinadi |
| `client.can_edit` | Mijoz tahrirlash mumkin |
| `client.show_balance` | Mijoz kartasida saldo |
| `client.show_photos` | Mijoz fotolari ko'rinadi |
| `client.fields_visible.*` | Forma maydonlari dinamik |
| `client.fields_required.*` | Majburiy maydonlar |
| `client.phone_prefix` | Telefon prefiksi (+998) |
| `product_list.show_out_of_stock` | Tugagan mahsulotlar ko'rinadi/yashirinadi |
| `product_list.allow_submit_for_new_client` | Yangi mijozga buyurtma |
| `orders.bonus_fill_mode` | Bonus to'ldirish rejimi |
| `orders.allow_return_from_shelf` | Polkadan qaytarish |
| `orders.consignment_payment_due_rule` | Konsignatsiya to'lov muddati |
| `sync.block_sync` | Sync vaqtinchalik bloklangan |
| `sync.mandatory_sync_count` | N marta sync qilmasa blok |
| `sync.allowed_window_from/to` | Faqat ma'lum vaqtda sync |
| `van_selling.allow_order_while_moving` | Harakatda buyurtma |
| `van_selling.payment_required` | To'lov majburiy |
| `misc.visit_start_end_enabled` | Vizit boshlash/tugatish |
| `misc.require_within_outlet_radius_m` | Mijoz radiusida bo'lish shart |
| `misc.require_stock_snapshot_for_order` | Ombor snapshot majburiy |
| `misc.allow_exchange_request` | Almashinuv so'rovi |
| `misc.disallowed_payment_method_codes` | Taqiqlangan to'lov usullari |

---

### 5.2 EXPEDITOR — Yetkazuvchi

#### 5.2.1 Asosiy vazifalar

- Bugungi yetkazishlar ro'yxati
- Buyurtmani yetkazib berish va tasdiqlash
- To'lov qabul qilish (yetkazishda, qarzdorlardan)
- Koordinata o'zgartirish (config ruxsat bersa)
- Qisman qaytarish va avtomobildan qayta yuklash
- Nakladnoy tasdiqlash (barmoq izi)

#### 5.2.2 Kunlik ish jarayoni

```
Login
  ↓
Bootstrap
  ↓
Bugungi yetkazishlar ro'yxati
  (filter: expeditor.allowed_trade_direction_ids)
  ↓
Buyurtmani ochish
  ↓
Mijozga yetkazish
  ↓
To'lov kerakmi? (config: expeditor.accept_payment_on_delivery)
  Ha → To'lov usulini tanlash
       (config: expeditor.allowed_payment_method_ids)
       → config: delivery_payment_method_strict?
  ↓
Nakladnoy tasdiq
  (config: expeditor.fingerprint_required_for_shipment_confirm)
  → Barmoq izi (local_auth)
  ↓
Holat yangilash
  ↓
Qaytarish kerakmi?
  Ha → Qisman qaytarish (config: orders.allow_partial_return_edit)
       → Avtomobildan qayta yuklash (config: orders.allow_reload_from_vehicle)
  ↓
Keyingi yetkazish
```

#### 5.2.3 API bog'lanishlari (expeditor)

| Jarayon | HTTP | Endpoint | Config |
|---------|------|----------|--------|
| Yetkazishlar | POST | `/api/{slug}/mobile/sync/full` | allowed_trade_direction_ids |
| To'lov qabul | POST | `/api/{slug}/payments/...` | accept_payment_on_delivery |
| Qarzdor to'lov | POST | payments API | accept_payment_from_debtors |
| Koordinata | PATCH | clients API | client.can_change_client_location |
| Qisman qaytarish | PATCH | orders API | orders.allow_partial_return_edit |
| Avtomobildan yuklash | POST | orders API | orders.allow_reload_from_vehicle |
| GPS ping | POST | `/api/{slug}/agent-locations` | gps.tracking_enabled |
| Push | POST | `/api/{slug}/mobile/fcm/register` | — |

#### 5.2.4 Ekspeditor mobil ekranlar

| Ekran | Tab | Tavsif |
|-------|-----|--------|
| Home | 🏠 Bosh | Bugungi yetkazishlar soni, statistika |
| Deliveries | 🚚 Yetkazish | Ro'yxat, filter, holat |
| DeliveryDetail | — | Buyurtma, mijoz, xarita |
| Payment | 💰 To'lov | To'lov usuli, summa |
| Returns | ↩️ Qaytarish | Qisman qaytarish, dогруз |
| Profile | ⚙️ Profil | work_slot_code, chiqish |

Bottom navigation (expeditor):
```
[ 🏠 Bosh ] [ 🚚 Yetkazish ] [ 💰 To'lov ] [ ↩️ Qaytarish ] [ ⚙️ Profil ]
```

#### 5.2.5 Ekspeditor konfiguratsiya (veb → mobil)

Veb: `frontend/components/staff/expeditor-configurations-dialog.tsx`

Bloklar:
- **Заказ:** qaytarish, dогруз, qisman qaytarish
- **Клиент:** koordinata o'zgartirish, maydonlar
- **Оплата:** to'lov usullari, valyuta, qarzdorlar
- **Gps:** tracking
- **Параметры:** yo'nalish cheklovi (trade_directions)

`expeditor.*` kalitlari:
- `accept_payment_for_order`
- `accept_payment_on_delivery`
- `accept_payment_from_debtors`
- `currency_symbol`
- `allowed_payment_method_ids`
- `allowed_trade_direction_ids`
- `delivery_payment_method_strict`
- `fingerprint_required_for_shipment_confirm`

---

### 5.3 SUPERVISOR — Supervayzer

#### 5.3.1 Asosiy vazifalar

- Kunlik dashboard (vizit %, sotuvlar)
- Agent vizitlarini nazorat qilish
- Checklist (chek, merchandising, narx, motivatsiya, ombor, sotuv)
- QR biriktirish (mijoz/vizit)
- O'z agentlari ro'yxati

#### 5.3.2 Kunlik ish jarayoni

```
Login
  ↓
Bootstrap
  ↓
Dashboard — kunlik xulosa
  (vizit %, sotuvlar, GPS %)
  ↓
Agent vizitlari ro'yxati
  ↓
Checklist (config: supervision.check_*)
  → Chek yuzlari (check_receipt_faces)
  → Merchandising (check_merchandising)
  → Narx tekshiruv (check_default_price)
  → Motivatsiya (check_motivation)
  → Ombor (check_stock)
  → Sotuvlar (check_sales)
  ↓
QR biriktirish (config: misc.qr_attach_visit_page / qr_attach_client_page)
  ↓
Agentlar ro'yxati va samaradorlik
```

#### 5.3.3 API bog'lanishlari (supervisor)

| Jarayon | HTTP | Endpoint | Ruxsat |
|---------|------|----------|--------|
| Dashboard xulosa | GET | `/api/{slug}/dashboard/supervisor/...` | dashboard.supervayzer |
| Vizitlar | GET | dashboard supervisor visits | dashboard.view |
| Agentlar | GET | `/api/{slug}/agents` | staff.agent.prosmotr_agenta |
| Agent GPS | GET | `/api/{slug}/agent-locations?agent_id=` | supervisor rol |
| QR biriktirish | POST | client-qr API | misc.qr_attach_* |
| Sync | POST | `/api/{slug}/mobile/sync/full` | dashboard.view |

#### 5.3.4 Supervisor mobil ekranlar

| Ekran | Tab | Tavsif |
|-------|-----|--------|
| Home | 🏠 Bosh | Kunlik KPI, vizit % |
| Dashboard | 📊 Dashboard | Sotuvlar, rejalar |
| Visits | 👁 Vizitlar | Agent vizitlari, GPS |
| Agents | 👥 Agentlar | O'z agentlari, samaradorlik |
| Profile | ⚙️ Profil | work_slot_code, chiqish |

Bottom navigation (supervisor):
```
[ 🏠 Bosh ] [ 📊 Dashboard ] [ 👁 Vizitlar ] [ 👥 Agentlar ] [ ⚙️ Profil ]
```

#### 5.3.5 Supervision checklist kalitlari

- `supervision.check_receipt_faces`
- `supervision.check_merchandising`
- `supervision.check_default_price`
- `supervision.check_motivation`
- `supervision.check_stock`
- `supervision.check_sales`

---

## 6. RUXSATLAR TIZIMI (RBAC)

### 6.1 Umumiy prinsip

Mobil ilova veb panel bilan **bir xil permission kalitlar** ishlatadi.

```
GET /api/{slug}/access/me-permissions
→ { data: { keys: ["orders.view", "clients.spisok_klientov", ...] } }
```

Manba: `backend/src/modules/access/access.route.me.ts`

### 6.2 Mobil endpoint ruxsatlari

Manba: `backend/src/modules/mobile/mobile.route.ts`

| Mobil endpoint | Kerakli ruxsatlardan kamida bittasi |
|----------------|-------------------------------------|
| `GET mobile/agent-config` | orders.view, orders.create, orders.zakaz.*, clients.*, staff.agent.* |
| `POST mobile/sync/full` | yuqoridagilar + warehouse.view, dashboard.view, dashboard.supervayzer, dashboard.prodazhi |
| `POST mobile/sync/delta` | sync/full bilan bir xil |
| `POST mobile/orders/enqueue` | orders.create, orders.zakaz.sozdanie_zakaza |
| `GET mobile/orders/pending` | orders.create, orders.zakaz.sozdanie_zakaza |
| `POST mobile/fcm/register` | sync/full bilan bir xil |

### 6.3 Flutter da ruxsat tekshiruvi (mantiq)

```
permissions.contains('orders.zakaz.sozdanie_zakaza')
  → Buyurtma yaratish tugmasi ko'rinadi

permissions.contains('clients.spisok_klientov')
  → Mijozlar tab ko'rinadi

permissions.contains('dashboard.supervayzer')
  → Supervisor dashboard ko'rinadi
```

---

## 7. SINXRONIZATSIYA VA OFLAYN ISHLASH

### 7.1 To'liq sinxron (sync/full)

```
POST /api/{slug}/mobile/sync/full
Body: { "last_sync_at": null }   // birinchi marta
Body: { "last_sync_at": "2026-05-29T08:00:00.000Z" }  // keyingi marta

Javob:
{
  "sync_at": "2026-05-29T10:00:00.000Z",
  "clients": [ { id, name, address, phone, latitude, longitude, ... } ],
  "products": [ { id, sku, name, unit, barcode, ... } ],
  "prices": [ { product_id, price_type, price } ],
  "orders": [ { id, number, client_id, status, items: [...] } ]
}
```

Manba: `backend/src/modules/mobile/mobile.service.ts` → `syncFull()`

### 7.2 Delta sinxron (sync/delta)

```
POST /api/{slug}/mobile/sync/delta
Body: {
  "last_sync_at": "2026-05-29T08:00:00.000Z",
  "entity_type": "clients" | "products" | "prices" | "orders"
}
```

Schema manbai: `backend/src/contracts/mobile.schemas.ts`

### 7.3 Oflayn buyurtma navbati

```
Internet yo'q:
  1. Buyurtma lokal SQLite ga yoziladi
  2. offline_queue jadvaliga qo'shiladi
  3. UI: "Oflayn saqlandi" badge

Internet qaytganda:
  1. POST /api/{slug}/mobile/orders/enqueue
     Body: {
       client_id: 123,
       items: [ { product_id: 1, qty: 5, price: 10000 } ],
       offline_created_at: "2026-05-29T09:30:00.000Z"
     }
  2. GET /api/{slug}/mobile/orders/pending
     Javob: { pending: 3 }
  3. Backend: status pending_sync → new, number yangilanadi
```

Enqueue schema manbai: `backend/src/contracts/mobile.schemas.ts` → `mobileEnqueueBodySchema`

### 7.4 Sync siyosati (mobile_config.sync)

| Config kaliti | Ta'sir |
|---------------|--------|
| `sync.mandatory_sync_count` | N marta sync qilmasa ilova bloklanadi |
| `sync.block_sync` | Sync butunlay o'chirilgan |
| `sync.allowed_window_from` | Sync faqat shu vaqtdan keyin |
| `sync.allowed_window_to` | Sync faqat shu vaqtgacha |

### 7.5 Lokal SQLite struktura (Flutter drift)

```
clients        → sync/full dan
products       → sync/full dan
prices         → sync/full dan
orders         → sync/full dan
order_items    → sync/full dan
offline_queue  → oflayn buyurtmalar navbati
sync_meta      → last_sync_at, sync_at
session        → tokens, role, permissions, mobile_config
```

---

## 8. FLUTTER TEXNOLOGIYA STACK

### 8.1 Asosiy

| Qatlam | Texnologiya | Versiya | Sabab |
|--------|-------------|---------|-------|
| Framework | Flutter | 3.x | Android + iOS bitta kod |
| Til | Dart | 3.x | Flutter standart |
| Arxitektura | Clean Architecture + Feature-first | — | Rol modullari ajratish |

### 8.2 Kutubxonalar

| Vazifa | Paket | Versiya (taxmin) |
|--------|-------|------------------|
| HTTP + JWT | dio | ^5.x |
| State management | flutter_riverpod | ^2.x |
| Navigatsiya | go_router | ^14.x |
| Lokal DB | drift | ^2.x |
| Secure token | flutter_secure_storage | ^9.x |
| Env | flutter_dotenv | ^5.x |
| GPS | geolocator | ^13.x |
| Xarita | flutter_map yoki yandex_mapkit | — |
| Kamera | image_picker | ^1.x |
| Foto siqish | flutter_image_compress | ^2.x |
| Push (FCM) | firebase_messaging | ^15.x |
| Firebase core | firebase_core | ^3.x |
| Biometrika | local_auth | ^2.x |
| QR skaner | mobile_scanner | ^6.x |
| Internet holati | connectivity_plus | ^6.x |
| Ruxsatlar | permission_handler | ^11.x |
| JSON | freezed + json_serializable | — |
| Logging | logger | ^2.x |

### 8.3 DevOps

| Vazifa | Asbob |
|--------|-------|
| CI/CD | GitHub Actions |
| Android build | `flutter build appbundle` |
| iOS build | `flutter build ipa` |
| Test | `flutter test` + integration_test |
| Lint | `flutter analyze` + `dart format` |

---

## 9. FLUTTER LOYIHA STRUKTURASI

```
mobile/
├── android/                          # Google Play build
├── ios/                              # App Store build
├── pubspec.yaml
├── .env.example                      # API_BASE_URL
├── lib/
│   ├── main.dart
│   ├── app.dart                      # MaterialApp + theme + router
│   │
│   ├── core/
│   │   ├── api/
│   │   │   ├── dio_client.dart       # Bearer + auto refresh interceptor
│   │   │   ├── auth_api.dart         # /api/auth/*
│   │   │   ├── mobile_api.dart       # /api/{slug}/mobile/*
│   │   │   ├── field_api.dart        # agent-locations, agent-visits
│   │   │   ├── permissions_api.dart  # /access/me-permissions
│   │   │   └── api_exceptions.dart
│   │   ├── auth/
│   │   │   ├── auth_repository.dart
│   │   │   ├── token_storage.dart    # flutter_secure_storage
│   │   │   └── session_manager.dart
│   │   ├── config/
│   │   │   ├── mobile_config.dart    # AgentMobileConfigV1 model
│   │   │   ├── permissions.dart      # PermissionSet helper
│   │   │   └── role_shell.dart       # agent | expeditor | supervisor
│   │   ├── database/
│   │   │   ├── app_database.dart     # drift
│   │   │   └── tables/
│   │   │       ├── clients_table.dart
│   │   │       ├── products_table.dart
│   │   │       ├── orders_table.dart
│   │   │       └── offline_queue_table.dart
│   │   ├── sync/
│   │   │   ├── sync_engine.dart
│   │   │   └── offline_queue.dart
│   │   ├── gps/
│   │   │   └── gps_tracker.dart
│   │   ├── push/
│   │   │   └── fcm_service.dart
│   │   └── theme/
│   │       ├── app_colors.dart
│   │       ├── app_typography.dart
│   │       └── app_theme.dart
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   ├── bootstrap_screen.dart # sync + config yuklash progress
│   │   │   └── auth_provider.dart
│   │   ├── agent/
│   │   │   ├── shell/agent_shell.dart
│   │   │   ├── home/
│   │   │   ├── clients/
│   │   │   ├── orders/
│   │   │   ├── visits/
│   │   │   └── van_selling/
│   │   ├── expeditor/
│   │   │   ├── shell/expeditor_shell.dart
│   │   │   ├── home/
│   │   │   ├── deliveries/
│   │   │   ├── payments/
│   │   │   └── returns/
│   │   ├── supervisor/
│   │   │   ├── shell/supervisor_shell.dart
│   │   │   ├── home/
│   │   │   ├── dashboard/
│   │   │   ├── visits/
│   │   │   ├── agents/
│   │   │   └── checklist/
│   │   └── shared/
│   │       ├── profile/
│   │       ├── sync_status/
│   │       ├── client_card/
│   │       ├── product_picker/
│   │       └── order_lines/
│   │
│   └── routing/
│       ├── app_router.dart
│       └── role_guard.dart           # role → shell tanlash
│
├── assets/
│   ├── icons/
│   └── fonts/
└── test/
    ├── unit/
    └── widget/
```

---

## 10. BOOTSTRAP — BIR MARTALIK MOSHLASHUV

Login muvaffaqiyatidan keyin bitta ketma-ketlik:

```
QADAM 1: role tekshir
  user.role ∈ { agent, expeditor, supervisor }?
  Yo'q → "Mobil ilovaga ruxsat yo'q" ekrani

QADAM 2: app_access tekshir
  users.app_access === true?
  Yo'q → "Ilova kirish o'chirilgan" ekrani

QADAM 3: GET /api/auth/me
  → work_slot_code, tenantSlug saqlash

QADAM 4: GET /api/{slug}/access/me-permissions
  → permission keys[] saqlash (SQLite session)

QADAM 5: GET /api/{slug}/mobile/agent-config
  → mobile_config + agent_entitlements saqlash

QADAM 6: POST /api/{slug}/mobile/sync/full
  → clients, products, prices, orders → SQLite

QADAM 7: POST /api/{slug}/mobile/fcm/register
  → push token yuborish

QADAM 8: role_shell ochish
  agent      → AgentShell (bottom nav: Bosh, Mijozlar, Buyurtma, Vizit, Profil)
  expeditor  → ExpeditorShell (bottom nav: Bosh, Yetkazish, To'lov, Qaytarish, Profil)
  supervisor → SupervisorShell (bottom nav: Bosh, Dashboard, Vizitlar, Agentlar, Profil)
```

Bootstrap ekranida progress ko'rsatiladi:
```
[✓] Autentifikatsiya
[✓] Ruxsatlar yuklandi
[⟳] Ma'lumotlar sinxronlanmoqda... 67%
[ ] Push sozlanmoqda
```

---

## 11. DIZAYN TIZIMI

### 11.1 Ranglar (veb panel bilan mos)

Manba: `frontend/lib/app-theme.ts`

| Token | Hex | Flutter Color |
|-------|-----|---------------|
| Primary (teal) | `#14b8a6` | `Color(0xFF14B8A6)` |
| Background | `#f0fdfa` | `scaffoldBackgroundColor` |
| Muted text | `#64748b` | subtitle rang |
| Error | `#ef4444` | `Color(0xFFEF4444)` |
| Success | `#22c55e` | `Color(0xFF22C55E)` |
| Warning | `#f59e0b` | `Color(0xFFF59E0B)` |

### 11.2 Rol accent ranglari

| Rol | Accent rang | Hex |
|-----|-------------|-----|
| Agent | Teal | `#14b8a6` |
| Expeditor | Orange | `#f97316` |
| Supervisor | Indigo | `#6366f1` |

### 11.3 Mobil UX qoidalari

| Element | Qoida |
|---------|-------|
| Bottom navigation | 4–5 tab, rolga qarab |
| Kartalar | borderRadius: 12, shadow yengil |
| Tugmalar | min balandlik 48dp, to'liq kenglik |
| Work slot badge | Profilda stiker (`A-12`, `E-05`, `N-03`) |
| Sync indikator | Header: ✅ synced / 🔄 syncing / ⚠️ offline |
| Typography | title: 18sp bold, body: 14sp, caption: 12sp |
| Touch target | min 44x44 dp |

### 11.4 Login ekrani

```
┌─────────────────────────────┐
│                             │
│      [SalesDoc logo]        │
│                             │
│  ┌─────────────────────┐   │
│  │ Kompaniya (slug)    │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Login               │   │
│  └─────────────────────┘   │
│  ┌─────────────────────┐   │
│  │ Parol          [👁]  │   │
│  └─────────────────────┘   │
│                             │
│  [      KIRISH      ]       │
│                             │
│  ⚠️ Offline rejim           │
└─────────────────────────────┘
```

---

## 12. VEB PANEL — ADMIN NIMA QILADI

| Admin veb panelda qiladi | Mobil ilovada natija |
|--------------------------|---------------------|
| Agent yaratish + login/parol berish | Agent login qiladi |
| `app_access = true` qo'yish | Ilovaga kirish mumkin |
| «Конfiguratsии» → GPS majburiy | Buyurtmada GPS so'raladi |
| Mahsulot kategoriyasi biriktirish (`product_rules`) | Agent faqat shu mahsulotlarni ko'radi |
| Narx turi tanlash (`price_types`) | Sync qilingan narxlar shu tur bo'yicha |
| Ekspeditor to'lov usullari tanlash | Yetkazishda faqat shu usullar |
| Supervayzer checklist yoqish | Vizitda checklist ko'rinadi |
| Work slot biriktirish | Profilda slot stikeri |
| Sessiya limiti (`max_sessions`) | Eski sessiya yopiladi |
| Agent deaktivatsiya | Login rad etiladi |
| Konfiguratsiya o'zgartirish | Keyingi sync da yangilanadi |

Veb panel yo'llari:
- Agentlar: `/users/agents`
- Ekspeditorlar: `/users/expeditors`
- Supervayzerlar: `/users/supervisors`

---

## 13. RIVOJLANTIRISH BOSQICHLARI (FAZA 9)

| Faza | Muddat | Ishlar | Loyiha bog'lanishi |
|------|--------|--------|-------------------|
| **9.1 — Asos** | 2–3 hafta | Flutter init, login, JWT, bootstrap, theme | auth.route.ts, mobile.route.ts |
| **9.2 — Agent MVP** | 3–4 hafta | Mijozlar, buyurtma, sync, oflayn queue | mobile.service.ts, field.route.ts |
| **9.3 — GPS + Foto** | 2 hafta | GPS tracking, kamera, config qoidalari | agent-mobile-config.types.ts |
| **9.4 — Expeditor** | 3 hafta | Yetkazish, to'lov, nakladnoy, qaytarish | expeditor-configurations-dialog.tsx |
| **9.5 — Supervisor** | 2–3 hafta | Dashboard, vizitlar, checklist, QR | dashboard.supervisor.* |
| **9.6 — Push + Release** | 1–2 hafta | FCM (`device_tokens`), push orqali yangilanish xabari | `device_tokens` jadvali |
| **9.7 — Server yangilanish** | 2 hafta | Versiya siyosati, login gate, APK/Store URL, admin UI | `app-release.service.ts`, `/settings/mobile-app` |
| **9.8 — Store release** | 2–3 hafta | Play Market + App Store, In-App Update (Android) | `store_url_*`, `in_app_update` (kelajak) |

Jami taxminiy muddat: **13–17 hafta**

---

## 14. TAYYOR VS QO'SHILISHI KERAK

### ✅ Tayyor (backend + veb + mobil)

| Komponent | Fayl / modul |
|-----------|-------------|
| Auth (login, refresh, logout, app_access) | `backend/src/modules/auth/` |
| Mobil API (sync, enqueue, config, FCM) | `backend/src/modules/mobile/` |
| **Server versiya siyosati (FAZA 9.7)** | `app-release.service.ts`, `GET /api/mobile/app-release` |
| **Admin: mobil versiya sozlamalari** | `frontend/app/(dashboard)/settings/mobile-app/` |
| mobile_config schema | `backend/src/modules/staff/agent-mobile-config.*` |
| Frontend config mirror | `frontend/components/staff/agent-mobile-config-types.ts` |
| Veb konfiguratsiya dialoglari | agent-configurations-dialog, expeditor-configurations-dialog |
| app_access, last_sync_at, apk_version | `users` jadvali (Prisma) |
| work_slot_code | work-slots moduli |
| Field API (GPS, vizit, marshrut) | `backend/src/modules/field/field.route.ts` |
| RBAC permissions | `backend/src/modules/access/` |
| Tenant xavfsizligi | `backend/src/plugins/tenant.plugin.ts` |
| **Flutter ilova (agent to‘liq)** | `mobile/lib/features/agent/` |
| **Bitta ilova — 3 rol shell** | `mobile/lib/routing/app_router.dart` |
| **Mobil yangilash dialogi** | `mobile/lib/core/update/` |
| **device_tokens (FAZA 9.6)** | Prisma `DeviceToken`, `POST .../fcm/register` |

### ⚠️ Backend ga qo'shilishi kerak (qisman)

| Vazifa | Holat |
|--------|-------|
| `sync/full` da agent/ekspeditor scope filtri | Qisman — agent kuchli |
| Ekspeditor mobil to‘lov API | MVP — UI stub |
| FCM push (production) | `FCM_SERVER_KEY` + Firebase mobil SDK kerak |

### 📱 Flutter

| Vazifa | Holat |
|--------|-------|
| Agent MVP (`mobile/lib/features/agent/`) | ✅ E2E checklist bo‘yicha |
| Ekspeditor / supervayzer | 🟡 API + config enforcement; to‘liq to‘lov workflow yo‘q |
| Android release APK | ✅ Telegram tarqatish |
| iOS / Play In-App Update | ❌ FAZA 9.8 |

---

## 15. API ENDPOINTLAR RO'YXATI

### 15.1 Auth (tenant talab qilmaydi)

| Method | Path | Body / Params | Javob |
|--------|------|---------------|-------|
| POST | `/api/auth/login` | `{ slug, login, password, device_name?, apk_version? }` | tokens + user + `app_update?` |
| POST | `/api/auth/refresh` | `{ refreshToken }` | tokens |
| POST | `/api/auth/logout` | `{ refreshToken }` | 204 |
| GET | `/api/auth/me` | Bearer JWT | user + work_slot |

### 15.2 Mobil (tenant + JWT + rol)

| Method | Path | Body | Javob |
|--------|------|------|-------|
| GET | `/api/{slug}/mobile/agent-config` | — | mobile_config, entitlements, `app_update?` |
| GET | `/api/mobile/app-release` | `?slug=&version=&platform=` | policy + update bloki |
| GET | `/api/{slug}/settings/mobile-app-release` | admin JWT | policy + eskirgan foydalanuvchilar |
| PATCH | `/api/{slug}/settings/mobile-app-release` | policy body | yangilangan policy |
| POST | `/api/{slug}/settings/mobile-app-release/notify` | — | FCM push eskirganlarga |
| POST | `/api/{slug}/mobile/sync/full` | `{ last_sync_at? }` | clients, products, prices, orders |
| POST | `/api/{slug}/mobile/sync/delta` | `{ last_sync_at?, entity_type? }` | partial data |
| POST | `/api/{slug}/mobile/orders/enqueue` | `{ client_id, items[], offline_created_at? }` | order |
| GET | `/api/{slug}/mobile/orders/pending` | — | `{ pending: N }` |
| POST | `/api/{slug}/mobile/fcm/register` | `{ token, device_type? }` | `{ ok: true }` |

### 15.3 Ruxsatlar

| Method | Path | Javob |
|--------|------|-------|
| GET | `/api/{slug}/access/me-permissions` | `{ data: { keys: [] } }` |

### 15.4 Field (GPS, vizit)

| Method | Path | Body | Rol |
|--------|------|------|-----|
| POST | `/api/{slug}/agent-locations` | `{ latitude, longitude, accuracy_meters? }` | agent, supervisor |
| GET | `/api/{slug}/agent-locations` | `?agent_id=&from=&to=` | read roles |
| POST | `/api/{slug}/agent-visits` | `{ client_id?, latitude?, longitude?, notes?, refusal_reason_ref? }` | agent, supervisor |
| GET | `/api/{slug}/agent-route-days` | `?agent_id=&from=&to=` | read roles |
| GET | `/api/{slug}/agent-route-days/one` | `?agent_id=&route_date=` | read roles |
| PUT | `/api/{slug}/agent-route-days` | `{ agent_id, route_date, stops[], notes? }` | agent, supervisor |

### 15.5 Staff (veb panel — config saqlash)

| Method | Path | Vazifa |
|--------|------|--------|
| PATCH | `/api/{slug}/agents/{id}` | Agent config + app_access |
| PATCH | `/api/{slug}/expeditors/{id}` | Expeditor config + app_access |
| PATCH | `/api/{slug}/supervisors/{id}` | Supervisor config + app_access |
| POST | `/api/{slug}/agents/bulk` | `{ action: "set_app_access", ... }` |

---

## 16. mobile_config TO'LIQ KALITLAR JADVALI

Schema versiya: `schema_version: 1`
Manba: `backend/src/modules/staff/agent-mobile-config.types.ts`

### client.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| can_edit | boolean | Mijoz tahrirlash |
| can_create | boolean | Yangi mijoz yaratish |
| require_new_client_approval | boolean | Yangi mijoz tasdiq talab |
| show_balance | boolean | Saldo ko'rsatish |
| show_photos | boolean | Mijoz fotolari |
| phone_prefix | string | Telefon prefiksi |
| fields_visible | object | Maydon ko'rinishi |
| fields_required | object | Majburiy maydonlar |
| can_change_client_location | boolean | Koordinata o'zgartirish (ekspeditor) |

### gps.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| min_battery_pct | number | Min baterya % |
| always_on | boolean | Doim yoqilgan |
| required_for_order | boolean | Buyurtma uchun majburiy |
| internet_required_for_order | boolean | Internet majburiy |
| internet_always_on | boolean | Doim internet |
| tracking_enabled | boolean | Tracking yoqilgan |
| tracking_interval_sec | number | Ping intervali |
| min_distance_m | number | Min masofa |
| max_accuracy_m | number | Max GPS aniqlik |

### outlet.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| show_plan_in_reports | boolean | Rejada ko'rsatish |
| plan_version | string | Reja versiyasi |

### product_list.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| show_out_of_stock | boolean | Tugagan mahsulotlar |
| allow_submit_for_new_client | boolean | Yangi mijozga buyurtma |

### photo.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| max_width_px | number | Max kenglik |
| max_height_px | number | Max balandlik |
| jpeg_quality | number | JPEG sifati |
| required_for_order | boolean | Buyurtma uchun majburiy |

### misc.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| visit_start_end_enabled | boolean | Vizit boshlash/tugatish |
| require_within_outlet_radius_m | number | Radius cheklovi |
| require_stock_snapshot_for_order | boolean | Ombor snapshot |
| require_shipment_date | boolean | Yetkazish sanasi |
| allow_exchange_request | boolean | Almashinuv so'rovi |
| disallowed_payment_method_codes | string[] | Taqiqlangan to'lov |
| qr_attach_visit_page | boolean | QR vizit sahifasi |
| qr_change_visit_page | boolean | QR vizit o'zgartirish |
| qr_attach_client_page | boolean | QR mijoz sahifasi |
| qr_change_client_page | boolean | QR mijoz o'zgartirish |

### sync.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| mandatory_sync_count | number | Majburiy sync soni |
| block_sync | boolean | Sync blok |
| allowed_window_from | string | Sync vaqti (dan) |
| allowed_window_to | string | Sync vaqti (gacha) |

### orders.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| consignment_payment_due_rule | string | Konsignatsiya muddati |
| bonus_fill_mode | string | Bonus rejimi |
| allow_return_from_shelf | boolean | Polkadan qaytarish |
| allow_partial_return_edit | boolean | Qisman qaytarish (ekspeditor) |
| allow_reload_from_vehicle | boolean | Avtomobildan yuklash |

### expeditor.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| accept_payment_for_order | boolean | Buyurtma uchun to'lov |
| accept_payment_on_delivery | boolean | Yetkazishda to'lov |
| accept_payment_from_debtors | boolean | Qarzdorlardan to'lov |
| currency_symbol | string | Valyuta belgisi |
| allowed_payment_method_ids | string[] | Ruxsat etilgan to'lov usullari |
| allowed_trade_direction_ids | number[] | Yo'nalish cheklovi |
| delivery_payment_method_strict | boolean | Qat'iy to'lov usuli |
| fingerprint_required_for_shipment_confirm | boolean | Barmoq izi majburiy |

### supervision.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| check_receipt_faces | boolean | Chek yuzlari |
| check_merchandising | boolean | Merchandising |
| check_default_price | boolean | Standart narx |
| check_motivation | boolean | Motivatsiya |
| check_stock | boolean | Ombor |
| check_sales | boolean | Sotuvlar |

### van_selling.*

| Kalit | Turi | Tavsif |
|-------|------|--------|
| payment_acceptance_method_ids | string[] | To'lov usullari |
| payment_required | boolean | To'lov majburiy |
| allow_order_while_moving | boolean | Harakatda buyurtma |
| allow_change_movement_status | boolean | Harakat holati |

---

## 17. XULOSA

| Savol | Javob |
|-------|-------|
| Bitta ilova? | **Ha** — bitta Flutter APK + IPA |
| Android + iOS? | **Ha** — Flutter aynan shu uchun tanlangan |
| Veb frontend Flutterda? | **Yo'q** — Next.js alohida qoladi |
| Konfiguratsiya qayerdan? | Veb panel → DB → mobil `agent-config` |
| Nechta mobil rol? | **3:** agent, expeditor, supervisor |
| Login? | `slug + login + parol` → JWT → bootstrap |
| Oflayn? | SQLite + `orders/enqueue` |
| Backend tayyormi? | **Ha** — asosiy API + versiya siyosati (9.7) + FCM jadvali (9.6) |
| Flutter tayyormi? | **Ha (agent to‘liq)** — `mobile/lib/` mavjud; expeditor/supervisor MVP |
| Serverdan avtomatik yangilanish? | **Ha (9.7)** — login/config gate + admin sozlama |
| Play / App Store? | **Rejada (9.8)** — `store_url_*` tayyor, In-App Update keyin |

---

## FAYLLAR MANBA RO'YXATI

| Fayl | Mazmun |
|------|--------|
| `mobile/README.md` | Qisqa mobil reja |
| `mobile/MOBILE_APP_TOLOQ_REJA_UZ.md` | Ushbu hujjat |
| `backend/src/modules/mobile/mobile.route.ts` | Mobil API marshrutlar |
| `backend/src/modules/mobile/mobile.service.ts` | Sync, enqueue, config |
| `backend/src/modules/mobile/mobile.schemas.ts` | Zod schemalar |
| `backend/src/modules/staff/agent-mobile-config.types.ts` | mobile_config schema |
| `backend/src/modules/auth/auth.service.ts` | Login, token |
| `backend/src/modules/auth/auth.route.ts` | Auth marshrutlar |
| `backend/src/modules/field/field.route.ts` | GPS, vizit |
| `backend/src/plugins/tenant.plugin.ts` | Tenant xavfsizligi |
| `frontend/components/staff/agent-configurations-dialog.tsx` | Agent config UI |
| `frontend/components/staff/expeditor-configurations-dialog.tsx` | Expeditor config UI |
| `frontend/components/staff/agent-mobile-config-types.ts` | Frontend schema mirror |
| `frontend/lib/app-theme.ts` | Dizayn ranglar |
| `frontend/lib/api.ts` | Veb API client |

---

*Hujjat oxirgi yangilanish: 2026-06-13*
