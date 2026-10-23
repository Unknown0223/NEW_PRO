# SALEC — Final cutover / test silkalari

**Yangilangan:** 2026-09-26  
**Rejim:** ikkala server parallel (eski Railway **ishlab turadi**, yangi Hetzner test uchun).

## Yangi server — HOZIR TEST

| Nima | Silka |
|------|--------|
| **Veb login** | https://salesarena.sale/login |
| **Veb** | https://salesarena.sale/ |
| **API health** | https://api.salesarena.sale/health |
| **API** | https://api.salesarena.sale |
| www | https://www.salesarena.sale/login |
| Coolify | http://157.180.116.50:8000 |

- Login yo‘li: **`/login`**. HTTPS (Let's Encrypt).
- Diler slug: **`aksit`** (eski `test1` emas).
- Brauzer API: same-origin (`PUBLIC_API_URL` bo‘sh) — Next `/auth` va `/api` ni backendga proxy qiladi.

## Eski Railway (kundalik ish — o‘chirilmaydi)

| Nima | Silka |
|------|--------|
| Veb | https://sales-arena.up.railway.app |
| API | https://backend-production-3cf2.up.railway.app |

**Qoida:** to‘liq cutover qilinmaguncha asosiy ish Railway’da qolishi mumkin. Hetzner faqat test / tayyorgarlik. Ikkala joyga bir xil yangi zakaz yozmang — kechki sync Hetzner’ni Railway dump bilan qayta yozadi.

## Tekshirilgan / tuzatilgan xatolar (Hetzner)

1. **CSP `connect-src 'self'`** + `api.salesarena.sale` → brauzer “Нет связи”. Yechim: `PUBLIC_API_URL=` (bo‘sh), same-origin proxy.
2. **Coolify DNS to‘qnashuvi:** backend `coolify` tarmog‘ida `postgres`/`redis` → `coolify-db` / `coolify-redis`. Yechim: `DATABASE_URL`/`REDIS_URL` da `salec-postgres-1` / `salec-redis-1`.
3. **Traefik ulanishi:** frontend/backend `coolify` external network (compose) — recreate dan keyin qo‘lda `docker network connect` shart emas.

## Kechki sync / to‘liq o‘tish

Batafsil: [YANGI_SERVER_TEST_VA_KECHKI_SYNC.md](./YANGI_SERVER_TEST_VA_KECHKI_SYNC.md)

```powershell
powershell -File .\scripts\hetzner\tonight-final-sync.ps1
```

To‘liq cutover (DNS / foydalanuvchilarni faqat yangi domenга) — **keyinroq**, siz aytganingizda.
