# ✅ Buyurtma tasdiqlash zanjiri — yakunlandi

**Sana:** 2026-06-26

Plan approvers konfiguratsiyasini buyurtma oqimiga ulash.

## Tekshiruv

```powershell
cd backend
npm run plans:verify   # 7 + 4 order-approval pure = 11
```

## Oqim

1. `new` → `confirmed` urinishida agent supervayzeri + yo‘nalish bo‘yicha zanjir yig‘iladi
2. Zanjir bo‘lsa — `approval_status=pending`, status `new` da qoladi (409 `ApprovalPending`)
3. Joriy tasdiqlovchi `POST .../approval/advance` — oxirgi bosqichdan keyin avto `confirmed`
4. `POST .../approval/reject` — rad etish

## API

| Method | Path |
|--------|------|
| GET | `/api/:slug/orders/:id/approval` |
| POST | `/api/:slug/orders/:id/approval/advance` |
| POST | `/api/:slug/orders/:id/approval/reject` |

## Migratsiya

`20260626120000_order_approval_workflow` — `approval_status`, `approval_step`, `approval_chain`

## Frontend

`OrderApprovalPanel` — zakaz kartasida (`order-detail-view.tsx`)

## Asosiy fayllar

| Fayl | Vazifa |
|------|--------|
| `backend/src/modules/orders/order-approval.service.ts` | Zanjir + bosqichlar |
| `backend/src/modules/orders/orders.route.approval.ts` | API |
| `frontend/components/orders/order-detail/order-approval-panel.tsx` | UI |
