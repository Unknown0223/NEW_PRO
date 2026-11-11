# SALEC — to‘liq tuzatish rejasi (AUDIT-2026-11 asosida)

**Manba:** `SALEC-NEW_PRO-audit.md` (commit `5e327d6` atrofida)  
**Tekshiruv sanasi:** 2026-11-11  
**Maqsad:** P0 → P1 → P2 → P3 tartibida, har bir topilma alohida branch/PR, regressiya testlari bilan.

> Qoida: bir chat/PR = bir topilma (yoki bir bog‘liq juftlik). P0-1/P0-2 tarix tozalash — qo‘lda, Cursor emas.

---

## 0. Kodda tasdiqlangan holat (2026-11-11)

| Topilma | Holat |
|---|---|
| `mobile/android/key.properties` + `salesdoc-ota.jks` | **Track qilingan** — P0-1 ochiq |
| `backend/scripts/data/*.xlsx` (3 ta xodim fayli) | **Track qilingan** — P0-2 ochiq |
| CI `npm audit` / TruffleHog | `\|\| true` + `continue-on-error` — P0-3 / P2-10 |
| `ACCESS_TOKEN_TTL = "24h"` | Tasdiqlandi — P1-2 |
| `trustProxy` | Topilmadi — P1-1 |
| `device-ingest` JWT’siz | Tasdiqlandi — P1-5 |
| Ombor `order.create-tx.stock.ts` | `findMany` + `increment`, **FOR UPDATE yo‘q** — P1-7 |
| Boshqa joylarda FOR UPDATE | Kassa/payroll/transferda bor — faqat order stock zaif |

---

## 1. Umumiy printsiplar

1. **Avval sızib chiqish, keyin kod.** Kalit/Excel tarixda qolsa — patch foydasiz.
2. **Bloklovchi gate.** Audit va secret-scan CI’da yiqilsin.
3. **Test bilan.** Har P1 uchun kamida 1 unit yoki integratsion test.
4. **Deploy tartibi.** Staging → smoke → prod; auth/TTL o‘zgarishida mobil/web birga.
5. **Repo:** tijorat mahsulot — `private` qilish P0 bilan birga qaror qilinsin.

---

## 2. Fazalar va taxminiy muddat

| Faza | Muddat | Natija |
|---|---|---|
| **F0** Favqulodda | 1–2 kun | Repo yopiq/cheklangan, kalit/Excel yo‘q, CI audit bloklaydi |
| **F1** Auth + chegara | 1–1.5 hafta | trustProxy, qisqa token, refresh oilasi, login, terminal, upload |
| **F2** Ma’lumot yaxlitligi | 1 hafta | Ombor lock, idempotentlik, cron → worker |
| **F3** Platforma | 1–2 hafta | Fastify 5, P2 xavfsizlik/headers, Node birlashtirish |
| **F4** Sifat | doimiy | Katta fayllar, RSC, i18n, RLS (keyingi kvartal) |

---

## 3. F0 — to‘xtatib bo‘lmaydigan (P0)

### F0-A. Repo kirishini cheklash
- [ ] GitHub’da `NEW_PRO` → **Private** (yoki Collaborators ni keskin qisqartirish)
- [ ] Ochiq fork/klon bo‘lganlarni hisobga olish: kalit baribir **compromised** deb hisoblansin

### F0-B. P0-1 Android imzolash kaliti
**Egasi:** mobil + DevOps (qo‘lda)

1. Yangi release keystore yaratish; **faqat** GitHub Secrets / parol menejeri
2. Debug va release kalitlarini ajratish
3. Key rotation (APK Signature Scheme v3 / `apksigner rotate`); Android 8 qurilmalar uchun qayta o‘rnatish rejasini yozish
4. Repodan olib tashlash:
   ```bash
   git rm --cached mobile/android/key.properties \
     mobile/android/keystore/salesdoc-ota.jks \
     mobile/android/keystore/README.txt
   ```
5. Tarixdan tozalash: `git filter-repo` (P0-2 bilan **bitta** o‘tish)
6. `build.gradle.kts` — kalit faqat env/CI secret’dan
7. OTA: backend `app-release` ga `sha256`; Flutter o‘rnatishdan oldin tekshirsin
8. `usesCleartextTraffic="false"` + debug `network_security_config`

**DoD:** kalit repoda yo‘q; yangi APK yangi kalit bilan; OTA sha256 tekshiradi; cleartext o‘chirilgan.

### F0-C. P0-2 Xodimlar Excel
**Egasi:** backend/DevOps (qo‘lda)

1. `git rm --cached` uchta xlsx (+ kerak bo‘lsa `mahsulotlar.json` / test xlsx)
2. `.gitignore` allaqachon bor — trackdan chiqishi shart
3. P0-1 bilan birga `filter-repo`
4. Kelajakda: faqat shifrlangan object storage / ichki share

**DoD:** `git ls-files 'backend/scripts/data/*.xlsx'` bo‘sh; tarixda ham yo‘q (yoki private + rotate).

### F0-D. P0-3 npm audit + CI gate
**Egasi:** platforma | Branch: `fix/p0-npm-audit-ci`

1. `backend/`, `frontend/`, ildiz: `npm audit fix` (major bo‘lmagan)
2. Critical/high ro‘yxatini yozib qo‘yish; major kerak bo‘lsa F3 (Fastify 5)
3. `ci.yml`:
   - `npm audit --omit=dev --audit-level=high` — **bloklovchi** (`|| true` va `continue-on-error` olib tashlash)
   - TruffleHog: SHA pin + `continue-on-error` olib tashlash
   - Ixtiyoriy: `gitleaks`

**DoD:** CI high+ da yiqiladi; critical 0 (yoki documented exception faqat Fastify 5 ticket bilan).

### F0-E. Cursor qoidasi
- [ ] `.cursor/rules/security-checklist.mdc` (audit §9 dagi checklist)

---

## 4. F1 — Auth va chegara (P1-1 … P1-6)

Har biri **alohida PR**. Tartib muhim: P1-1 → P1-2/3 → P1-4 → P1-5 → P1-6.

### PR-1 · P1-1 trustProxy + rate-limit
**Fayllar:** `backend/src/app.ts`, `auth.route.ts`, `config/env.ts`, `docker-compose.prod.yml`

| Qadam | Ish |
|---|---|
| 1 | `TRUST_PROXY` env (hop soni yoki CIDR); productionda majburiy |
| 2 | `x-forwarded-for` qo‘lda o‘qishni olib tashlash → `request.ip` |
| 3 | `@fastify/rate-limit` + mavjud ioredis store |
| 4 | Login kaliti: `ip + slug + login` |
| 5 | Backend `4000:4000` host publish ni yopish (faqat reverse proxy) |
| 6 | Unit test |

**DoD:** cluster’da limit umumiy; soxta XFF auditga tushmaydi.

### PR-2 · P1-2 Access TTL + sessiya
**Fayllar:** `auth.service.ts`, `auth.prehandlers.ts`, frontend `auth-store`

| Qadam | Ish |
|---|---|
| 1 | `ACCESS_TOKEN_TTL` → `15m` |
| 2 | JWT `sid` = refresh session id |
| 3 | `jwtAccessVerify`: **barcha** rollar uchun `is_active` + sid bekor emas (Redis 30s kesh) |
| 4 | Deaktiv / logout da kesh invalidate |
| 5 | Web: access faqat memory; body’da refresh qaytarmaslik (cookie yetarli) |
| 6 | Integratsion: deaktiv admin, bekor sessiya |

**DoD:** bo‘shatilgan admin 15 daqiqadan keyin kira olmaydi; XSS oyna qisqa.

### PR-3 · P1-3 Refresh reuse detection
| Qadam | Ish |
|---|---|
| 1 | `family_id` (yoki mavjud modelga) |
| 2 | Eskirgan refresh qayta kelsa — butun oilani revoke + alert |
| 3 | Rotate `$transaction` ichida |
| 4 | Ishlatilmaydigan `JWT_REFRESH_SECRET` ni tozalash |

### PR-4 · P1-4 Login himoyasi
| Qadam | Ish |
|---|---|
| 1 | Hisob bo‘yicha progressiv lockout / kechikish |
| 2 | `must_change_password` + staff import default parol majburiy almashtirish |
| 3 | Parol `min(8–10)` + oddiy murakkablik |
| 4 | User topilmasa ham dummy bcrypt |
| 5 | (Keyinroq) admin/moliya TOTP — alohida PR |

### PR-5 · P1-5 Davomat device-ingest
**Fayl:** `tabel.route.mobile.ts`

| Qadam | Ish |
|---|---|
| 1 | Ingest **faqat** device token |
| 2 | Pairing code: bir martalik, qisqa TTL, faqat token olish |
| 3 | Query string’dan `pairing_code` olib tashlash |
| 4 | Rate-limit |
| 5 | `body.user_id` ishonchsiz — terminal/face mapping orqali |

**DoD:** pairing bilgan odam ixtiyoriy user_id bilan punch yoza olmaydi.

### PR-6 · P1-6 Fayl yuklash
**Fayllar:** `app.ts`, `storage.service.ts`

| Qadam | Ish |
|---|---|
| 1 | Global multipart 10–32 MB; 512 MB faq migration route |
| 2 | Stream upload (S3 `Upload` / lokal pipeline), `Buffer.concat` yo‘q |
| 3 | `lib/file-signature.ts` magic-byte |
| 4 | Rasmlarni `sharp` re-encode (ixtiyoriy shu PR yoki keyingi) |

---

## 5. F2 — Ma’lumot yaxlitligi (P1-7 … P1-9)

### PR-7 · P1-7 Ombor overselli
**Fayl:** `order.create-tx.stock.ts`

1. `SELECT … FOR UPDATE` (`product_id` tartibida) yoki atomar `UPDATE … WHERE qty - reserved >= need`
2. `CHECK (reserved_qty >= 0)` migratsiya
3. Integratsion: qoldiq 10, parallel 2×10 → bittasi OK, ikkinchisi `INSUFFICIENT_STOCK`

### PR-8 · P1-9 Idempotentlik
1. Tekshirish: mobil `queue_id` backendda dublikatni rad etadimi
2. Yo‘q bo‘lsa: client UUID + `(tenant_id, client_uuid)` unique — order / payment / return
3. Frontend/mobil `Idempotency-Key` yoki `client_uuid` yuborish

### PR-9 · P1-8 Cron → worker
1. `index.ts` `setInterval` cron’larini BullMQ repeatable job qilish
2. Faqat worker jarayonida
3. `docker-compose.prod.yml` alohida worker; `docker-start.sh`dan parallel worker olib tashlash
4. O‘tishda har cron’ga Redis `SET NX PX` (agar hali API’da qolsa)

---

## 6. F3 — Platforma (P0-3 major + P2 tanlangan)

### PR-10 · Fastify 4 → 5
- Alohida branch; `@fastify/jwt@10` va plaginlar; 256 test yashil
- Shu bilan `fast-jwt` critical yopiladi

### PR-11 · P2 xavfsizlik to‘plami (kichik PR’lar)
| # | Ish |
|---|---|
| P2-1 | Production error’da ichki message yashirish |
| P2-2 | SSE `?access_token=` → ticket |
| P2-3 | Pino `redact` |
| P2-6 | Frontend security headers + CSP report-only |
| P2-12 | hr-hub `AUTH_SECRET` productionda majburiy |
| P2-15 | `/ready` token + `timingSafeEqual` |

### PR-12 · Node / Docker birxillik
- `.nvmrc` + `engines`; CI = Docker = 20 yoki 22 (bitta)
- Frontend Dockerfile: `USER node`, `output: "standalone"`

### PR-13 · CI secret scan qattiqlashtirish
- TruffleHog SHA; gitleaks; blocking

---

## 7. F4 — Sifat va o‘sish (P2 qolganlari + P3 + §7)

**Navbat (prioritet):**

1. Backend ESLint (`no-floating-promises`) — P2-4  
2. `ignoreBuildErrors` olib tashlash — P2-5  
3. Global tenant hook — P2-7  
4. Pulda `Decimal` — P2-8 (modulma-modul)  
5. N+1 hotspots — P2-9  
6. Ulkan fayllarni bo‘lish (`use-order-create.ts` va boshqalar)  
7. RSC + `error.tsx` / `loading.tsx`  
8. i18n, RLS, partitsiya — alohida kvartal reja  
9. Repo gigiyena: `salec-link` binariylarni Releases’ga; `lint-report.json` untrack; `.gitattributes` BOM; pivot vendor → workspace  

**Mahsulot (§7):** 2FA UI, sessiya ro‘yxati, Payme/Click, i18n — product backlog, shu xavfsizlik fazasidan keyin.

---

## 8. PR / branch nomlash

```
fix/p0-npm-audit-ci
fix/p1-trust-proxy-rate-limit
fix/p1-access-ttl-session
fix/p1-refresh-reuse
fix/p1-login-hardening
fix/p1-attendance-ingest-auth
fix/p1-upload-stream-limits
fix/p1-stock-for-update
fix/p1-idempotency
fix/p1-cron-to-worker
chore/fastify-5
fix/p2-security-headers-errors
```

Har PR tavsifida: audit ID (`P1-7`), DoD, test buyruqlari.

---

## 9. Har PR dan keyin gate

```bash
# Backend
npm run test:ci --prefix backend
cd backend && npx tsc -p tsconfig.json --noEmit

# Frontend (o‘zgarganda)
npm run lint:errors --prefix frontend
npm run typecheck --prefix frontend
npm run test --prefix frontend

# Hajm
npm run audit:max-loc
```

Auth/TTL o‘zgaganda: mobil login + web refresh smoke (staging).

---

## 10. Darhol boshlash (bugun / ertaga)

| # | Kim | Nima |
|---|---|---|
| 1 | Repo egasi | `NEW_PRO` → Private |
| 2 | Mobil + DevOps | Yangi keystore + Secrets; eski compromised |
| 3 | DevOps | `git rm --cached` kalit + xlsx; `filter-repo` rejasini yozish |
| 4 | Agent/dev | Branch `fix/p0-npm-audit-ci` — audit fix + CI blocking |
| 5 | Agent/dev | `.cursor/rules/security-checklist.mdc` |
| 6 | Keyingi | `fix/p1-trust-proxy-rate-limit` |

---

## 11. Risklar va bog‘liqliklar

- **Key rotation** eski OTA foydalanuvchilarini sindirishi mumkin — kommunikatsiya + majburiy yangilanish oynasi.
- **Access 24h → 15m** mobil oflayn/qisqa tarmoqda ko‘proq refresh — refresh oilasi (P1-3) bilan birga chiqarish yaxshi.
- **Fastify 5** katta; audit critical’ni F0’da exception ticket bilan qoldirish mumkin, lekin F3 muddati qat’iy.
- **filter-repo** force-push talab qiladi — barcha klonlar qayta clone.

---

## 12. Muvaffaqiyat mezonlari (1 oy)

- [ ] Repoda kalit/xlsx yo‘q; repo private
- [ ] CI high audit + secret scan bloklaydi
- [ ] Access ≤15m; deaktiv user darhol (kesh TTL ichida) yopiladi
- [ ] device-ingest faqat token
- [ ] Parallel stock test yashil; overselli yo‘q
- [ ] Cron faqat worker’da
- [ ] Upload OOM vektori yopilgan (limit + stream)
