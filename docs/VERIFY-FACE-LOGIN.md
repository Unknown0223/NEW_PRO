# Face ID web login — qo‘lda tekshirish

## Auth tanlovi

Parol muvaffaqiyatli bo‘lgach, agar `users.require_face_login` **yoki** tenant `faceAntifraud.requireFaceLogin` yoqilgan bo‘lsa, **access/refresh token berilmaydi**. Qisqa muddatli `face_challenge.token` yaratiladi; sessiya faqat Face ID approve dan keyin ochiladi (`/auth/face-login/verify` webcam yoki `/auth/face-login/complete` QR dan keyin).

> **Mobil APK:** `apk_version` yuboradigan loginlarda bu veb Face ID challenge **o‘tkazib yuboriladi** (mobil o‘z FaceGate `daily_login` ini ishlatadi). Faqat tenant-global `requireFaceLogin` yoqilgan, lekin xodimda etalon yo‘q bo‘lsa — qulflanmaydi; per-user toggle esa qat’iy (etalon shart).

## Lokal URL

| Xizmat | URL |
|--------|-----|
| Frontend | http://127.0.0.1:3000 |
| Login | http://127.0.0.1:3000/login |
| API | http://127.0.0.1:18080 |
| Face bridge (PC brauzer) | http://127.0.0.1:3000/face-bridge/{token} |
| Face bridge (**telefon QR**) | http://\<LAN-IP\>:3000/face-bridge/{token} |

Lokal DB hozir ko‘pincha `postgresql://postgres:0223@localhost:15432/savdo_db`. Tenant slug: `test1` / `demo` (bu mashinada `aksit` bo‘sh bo‘lishi mumkin — `SELECT slug FROM tenants`).

### QR URL qanday yig‘iladi

1. `NEXT_PUBLIC_FACE_BRIDGE_ORIGIN` yoki `NEXT_PUBLIC_APP_URL` (agar loopback emas) — eng ustuvor.
2. Aks holda brauzer `localhost`/`127.0.0.1` bo‘lsa: `GET /api/face-bridge-origin` → PC LAN IPv4 + frontend port (`http://192.168.x.x:3000`).
3. Production host (salesarena.sale) — `window.location.origin`.
4. QR va **«Скопировать ссылку»** bir xil `bridge_path` + shu origin.

Ixtiyoriy backend: `FACE_BRIDGE_PUBLIC_ORIGIN` / `PUBLIC_APP_URL` (challenge `bridge_url` uchun). Frontend baribir LAN/env bilan QR ni qayta yozadi.

## 1) Admin — etalon + toggle

1. Admin bilan kiring (**admin** o‘zi Face ID dan mustasno).
2. **Etalon rasm** — hodim bo‘limida tahrir dialogida (`StaffFaceReferencePanel`):
   Сотрудники / Агенты / SVR / Экспедиторы / Инкассаторы / Аудиторы / Складчик.
3. **«Требовать Face ID» Вкл/Выкл** — faqat **Рабочее место** (`/work-slots`) ustunida.
4. Agar Вкл va etalon yo‘q bo‘lsa — sariq «Нужен эталон Face ID»; avval hodim kartasiga rasm yuklang.
5. Tizim bo‘yicha non-admin `require_face_login=true` (admin doim `false`).

## 2) Webcam login

1. Chiqing, test user bilan login.
2. Paroldan keyin Face ID qadami: kamera + 4/8 yo‘nalish.
3. Muvaffaqiyat → dashboard (`from` saqlanadi).

## 3) QR telefon (lokal — haqiqiy telefon)

**Shart:** telefon va PC **bir xil Wi‑Fi** da; frontend `3000`, API `18080` ishlayapti.

1. PC da `http://127.0.0.1:3000/login` oching, Face ID kerak bo‘lgan user bilan parol kiriting.
2. **«QR на телефон»** (yoki kamerani rad eting).
3. QR ostidagi URL `http://192.168.…:3000/face-bridge/…` bo‘lishi kerak (**127.0.0.1 emas**). Tekshirish: `http://127.0.0.1:3000/api/face-bridge-origin` → `{"origin":"http://192.168.x.x:3000",...}`.
4. Telefonda QR ni skanerlang yoki **«Скопировать ссылку»** → telefonda oching.
5. Telefonda liveness + selfie → PC poll → kirish.
6. TTL ~2 daqiqa: muddat o‘tsa QR **avtomatik yangilanadi** (yoki **«Обновить QR»**); parolni qayta yozish shart emas (~30 daqiqa oynada). Oyna tugasa — qayta login.

### Windows firewall

Telefon `192.168.x.x:3000` ga ulanolmasa:

1. **Windows Defender Firewall** → Incoming rule: TCP **3000** (Private profile) ruxsat.
2. Yoki vaqtinchalik: PowerShell (Admin):

```powershell
New-NetFirewallRule -DisplayName "SALEC Next dev 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

3. Guest/izolatsiya Wi‑Fi da telefon PC ni ko‘rmaydi — oddiy LAN kerak.
4. LAN IP o‘zgarsa yoki aniqlanmasa: `frontend/.env.local` ga  
   `NEXT_PUBLIC_FACE_BRIDGE_ORIGIN=http://192.168.x.x:3000` qo‘ying va `next dev` ni qayta ishga tushiring.

## 4) API smoke

```bash
# Parol OK + Face ID ON → face_required, tokens yo‘q
curl -s -X POST http://127.0.0.1:18080/auth/login -H "Content-Type: application/json" -H "Origin: http://127.0.0.1:3000" -d "{\"slug\":\"aksit\",\"login\":\"LOGIN\",\"password\":\"PASS\"}"

# Challenge yangilash (muddati o‘tgach)
curl -s -X POST http://127.0.0.1:18080/auth/face-login/recreate -H "Content-Type: application/json" -d "{\"challenge_token\":\"TOKEN\"}"
```

## Migratsiya

```bash
cd backend && npx prisma migrate deploy
# yoki: npx prisma db execute --file prisma/migrations/20261112130000_face_login_challenge/migration.sql
```
