# Soft-void va audit — yakunlandi (bosqichlar 0–6)

Qisqa xulosa: hard delete o‘rniga soft-void/deactivate, audit qamrovi kengaytirildi, retention cron va arxiv UI qo‘shildi.

| Bosqich | Nima yetkazildi |
|---------|-----------------|
| **0** | Soft-void standarti, `soft-void.ts`, RBAC void/restore, `docs/SOFT_VOID_AND_AUDIT.md` |
| **1** | Audit teshiklari: order TenantAudit, status log `superseded_at`, payment ClientAudit, import/tags/photo/slot/geo/plans/access |
| **2** | Foto soft-void, payment allocation snapshot/restore, GR cancel stock, inventory snapshot, merge/access ogohlantirish |
| **3** | Katalog/ombor/slots/automation/FX/supplier/geo/saved-config: hard → soft yoki `is_active` |
| **4** | Audit retention cron, Excel export, ops truncate himoyasi |
| **5** | `SoftVoidConfirmDialog`, arxiv filter, deactivate UX, history labels |
| **6** | Integration/unit testlar, `SOFT_VOID_V1` flag, rollout checklist |

**Asosiy kod:** [`backend/src/lib/soft-void.ts`](../backend/src/lib/soft-void.ts)

**Test:** `backend/tests/soft-void.unit.test.ts`, `backend/tests/soft-void.integration.test.ts`

**Flag:** backend `SOFT_VOID_V1` (default `1`); frontend `NEXT_PUBLIC_SOFT_VOID_V1` — faqat UI; backend hard delete ni qayta yoqmaydi.

**Rollout:** [`SOFT_VOID_AND_AUDIT.md`](./SOFT_VOID_AND_AUDIT.md) → Rollout bo‘limi.
