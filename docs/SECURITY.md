# SALEC — Security policy

## Parol xeshlash

- Kutubxona: **bcryptjs** (`backend/src/modules/auth/auth.service.ts`, `backend/src/modules/staff/staff.crud.create.web.ts` va boshqa staff CRUD).
- Cost factor: **12** (`bcrypt.hash(password, 12)`).
- Parollar hech qachon log yoki API javobida qaytarilmaydi.

## Cookie va sessiya

- Refresh token: `HttpOnly` cookie (`salec_rt`), `SameSite=Strict`, `Path=/`. TTL 30 kun. Brauzer `localStorage` ga **yozilmaydi**.
- Production (`NODE_ENV=production`): `Secure` flag majburiy (`auth-cookies.ts`).
- Access token: JWT 24 soat; Zustand persist (XSS da refresh o‘g‘irlanmasin). Sahifa yangilanganda cookie `salec_rt` orqali tiklanadi.

## PII va ma'lumot saqlash (draft)

> **TODO / policy draft** — rasmiy retention hujjati tayyorlanmoqda.

| Ma'lumot | Joylashuv | Hozirgi retention |
|----------|-----------|-------------------|
| Foydalanuvchi telefon, ism | `clients`, `access_users` | Tenant o'chirilguncha |
| Activity events | `user_activity_events` | `ACTIVITY_RETENTION_DAYS` (default 90 kun) |
| Audit events | `tenant_audit_events` | `npm run audit:retention` cron |
| To'lov / zakaz tarixi | `payments`, `orders` | Biznes talab — arxiv (`deleted_at`) |

Kelajak: GDPR-style export/delete API va aniq retention jadvali (`docs/DATA_RETENTION.md`).

## Xavfsizlik tekshiruvlari

```bash
cd backend && npm run prod:verify
cd backend && npm audit --audit-level=high
```

CI: `secret-scan` (TruffleHog), `npm audit`, RBAC enforcement testlari.

Batafsil PR checklist: `.cursor/rules/security-checklist.mdc`.
