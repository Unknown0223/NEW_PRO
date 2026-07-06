# SALEC — Auth Token Strategy

## Joriy holat (Phase 1 — bajarildi)

| Token | Web (Next.js) | Mobile (Flutter) |
|-------|---------------|------------------|
| Access JWT (15m) | `localStorage` (`savdo-auth`) | Secure storage / memory |
| Refresh token (30 kun) | **HttpOnly cookie** `salec_rt` + JSON body (mobil moslik) | JSON body (`refreshToken`) |
| Middleware flag | `sd_auth=1` cookie (HttpOnly emas, faqat yo‘naltirish) | — |

### Backend

- Login/refresh: `Set-Cookie: salec_rt=...; HttpOnly; SameSite=Strict; Secure` (production)
- Refresh/logout: cookie **yoki** body `refreshToken` qabul qilinadi (`auth-cookies.ts`)
- Mobil: cookie ishlatmaydi — faqat JSON body

### Frontend

- Axios/fetch: `withCredentials: true` / `credentials: "include"`
- Refresh: avval HttpOnly cookie; body fallback (localStorage refresh)

## Phase 2 (ixtiyoriy — keyingi sprint)

- Access token ham HttpOnly cookie ga ko‘chirish (katta breaking change)
- Web localStorage dan refresh olib tashlash (faqat cookie)
- CSRF token refresh POST uchun

## Migratsiya yo‘riqnomasi

1. **Hozir:** hech narsa o‘zgartirish shart emas — web cookie avtomatik o‘rnatiladi
2. **Mobil:** o‘zgarishsiz — body refresh ishlashda davom etadi
3. **Production:** `CORS_ALLOWED_ORIGINS` aniq ro‘yxat + `credentials: true` (backend `app.ts`)

## Tekshiruv

```bash
cd backend && vitest run tests/auth.integration.test.ts
curl -c cookies.txt -X POST http://127.0.0.1:18080/auth/login -H 'Content-Type: application/json' \
  -d '{"slug":"test1","login":"admin","password":"secret123"}'
grep salec_rt cookies.txt
```

## Bog‘liq fayllar

- `backend/src/modules/auth/auth-cookies.ts`
- `backend/src/modules/auth/auth.route.ts`
- `frontend/lib/auth-sync.ts`
- `frontend/middleware.ts`
