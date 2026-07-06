# ✅ Dostup to‘liq RBAC — yakunlandi

**Sana:** 2026-06-26

## Tekshiruv

```powershell
cd backend
npm run dostup:verify
```

| Test to‘plami | Natija |
|---------------|--------|
| `route-permission-guard.pure.test.ts` | ✅ 7 |
| `route-permission-coverage.pure.test.ts` | ✅ **16** (yangi modullar) |
| `rbac.permissions.pure.test.ts` | ✅ 1 |
| `access-api.integration.test.ts` | ✅ 6 |
| `rbac-enforcement.integration.test.ts` | ✅ 4 |
| `contract-smoke.integration.rbac.test.ts` | ✅ 17 |

**Jami:** **51/51** ✅

## Qamrov kengaytmasi

`route-permission-guard.ts` ga qo‘shildi:

- Dashboard, Reports, Bonus-rules, Refusals, Audit
- Access workspace, Territory, Sales-directions, Reference
- Linkage, Field/GPS, Notifications
- Buyurtma tasdiqlash (`/orders/:id/approval`)

`access.upravlenie.update` kaliti permission katalogiga qo‘shildi.

## Production

`RBAC_ENFORCE_PERMISSIONS=1` — [PROD_DEPLOY_YAKUNLANDI.md](./PROD_DEPLOY_YAKUNLANDI.md)
