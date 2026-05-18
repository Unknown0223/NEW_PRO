# Mobile

Reserved for FAZA 9 implementation (Flutter agent and delivery apps).

## Work slot (`work_slot_code`) — API tayyor

Agent ilovasi quyidagi manbalardan ishchi o‘rni kodini oladi:

| Endpoint | Maydonlar |
|----------|-----------|
| `GET /auth/me` | `user.work_slot_id`, `user.work_slot_code` |
| `GET /api/{tenant}/mobile/agent-config` | `work_slot_id`, `work_slot_code` |

Flutter UI da profil yoki bosh ekranda `work_slot_code` ni ko‘rsating (masalan stiker `T-12`).

Veb panelda vaqtinchalik ko‘rsatkich: sidebar pastida `WorkSlotProfileBadge` (`/auth/me`).

## 1C integratsiya (reja)

Tashqi tizimlar bilan sinxronlashda **asosiy kalit** — `WorkSlot.slot_code` (tenant ichida unique).

- Eksport/import: `GET /api/{tenant}/work-slots/export.xlsx`, `POST /api/{tenant}/work-slots/import.xlsx`
- 1C dan kelgan `slot_code` bo‘yicha upsert; `assign_login` ustuni orqali xodim biriktirish

Qoida Q-01: mavjud `slot_code` PATCH orqali o‘zgartirilmaydi — faqat label, filial, aktivlik.
