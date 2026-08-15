# SALEC integratsiyasi — KECHIKTIRILGAN

**Status:** hozir qilinmaydi.

## Scope (kelajakda)

Faqat ikkita oqim:

1. **Employees** — `hr-hub.employees` ↔ SALEC `User` / staff (external id mapping)
2. **Tabel** — `attendance_logs` / `shifts` → SALEC `timesheet`

## Qilinmaydiganlar (shu adapterda)

- WorkSlot, orders, stock, payroll, RBAC Arena nav

## Taxminiy joylashuv (keyin)

```
packages/hr-hub/src/integrations/salec/
  employees.adapter.ts
  timesheet.adapter.ts
```

Hozir bu papka bo‘sh — stub sifatida ushbu hujjat.
