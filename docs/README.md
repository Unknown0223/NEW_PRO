# SalesDoc — texnik hujjatlar indeksi

Bu katalog mavjud hujjatlarga havolalar. Eski reja fayllari (`API-reference.md`, `ORDER_STATUS.md` va hokazo) hozir repoda yo‘q — quyidagi ro‘yxat **haqiqiy** fayllarga mos.

## Deploy va infratuzilma

| Hujjat | Mazmun |
|--------|--------|
| [RAILWAY-DEPLOY.md](./RAILWAY-DEPLOY.md) | Railway deploy yo‘riqnomasi |
| [grafana/IMPORT.md](./grafana/IMPORT.md) | Grafana dashboard import |
| [DASHBOARD_PERF_COMPLETION_REPORT.md](./DASHBOARD_PERF_COMPLETION_REPORT.md) | Dashboard performance hisobot |
| [../infrastructure/README.md](../infrastructure/README.md) | Docker Compose (Postgres, Redis) |

## Backend

| Hujjat | Mazmun |
|--------|--------|
| [../backend/API_ERROR_CODES.md](../backend/API_ERROR_CODES.md) | API xato kodlari |
| [../backend/tests/contract-smoke.md](../backend/tests/contract-smoke.md) | Contract smoke spetsifikatsiya |
| [../backend/openapi/README.md](../backend/openapi/README.md) | OpenAPI bundle va lint |
| [../backend/docs/rbac-route-pattern.md](../backend/docs/rbac-route-pattern.md) | RBAC route pattern |
| [../backend/docs/domain-boundary.md](../backend/docs/domain-boundary.md) | Domain chegaralari |
| [../backend/docs/openapi-strategy.md](../backend/docs/openapi-strategy.md) | OpenAPI strategiyasi |
| [../backend/docs/observability-grafana.md](../backend/docs/observability-grafana.md) | Observability / Grafana |
| [../backend/docs/performance-release-checklist.md](../backend/docs/performance-release-checklist.md) | Reliz performance checklist |
| [../backend/docs/route-audit-clients-reports.md](../backend/docs/route-audit-clients-reports.md) | Route audit: clients/reports |
| [../backend/docs/route-audit-core-modules.md](../backend/docs/route-audit-core-modules.md) | Route audit: core modullar |
| [../backend/docs/work-slots-qilingan-ishlar-va-test.md](../backend/docs/work-slots-qilingan-ishlar-va-test.md) | Work slots va testlar |

## Perf va skriptlar

| Hujjat | Mazmun |
|--------|--------|
| [../backend/scripts/perf/README.md](../backend/scripts/perf/README.md) | Performance skriptlar |
| [../backend/scripts/perf/p95-from-logs.md](../backend/scripts/perf/p95-from-logs.md) | P95 log tahlili |
| [../scripts/dashboard-perf-baseline.md](../scripts/dashboard-perf-baseline.md) | Dashboard perf baseline |
| [../scripts/dashboard-perf-capture.md](../scripts/dashboard-perf-capture.md) | Dashboard perf capture |

## Frontend va mobile

| Hujjat | Mazmun |
|--------|--------|
| [../frontend/README.md](../frontend/README.md) | Frontend loyiha |
| [../mobile/README.md](../mobile/README.md) | Flutter mobile ilova |
| [../mobile/E2E_CHECKLIST.md](../mobile/E2E_CHECKLIST.md) | E2E checklist |
| [../mobile/MOBILE_APP_TOLOQ_REJA_UZ.md](../mobile/MOBILE_APP_TOLOQ_REJA_UZ.md) | Mobile to‘liq reja |
| [../mobile/STORE_RELEASE_PLAN.md](../mobile/STORE_RELEASE_PLAN.md) | Store release reja |

## Audit / refaktoring handoff

| Hujjat | Mazmun |
|--------|--------|
| [../.cursor/plans/YAKUNLANDI_REJALAR_BILDIRISHNOMA_2026-06-26.md](../.cursor/plans/YAKUNLANDI_REJALAR_BILDIRISHNOMA_2026-06-26.md) | **✅ Audit rejalar yakunlandi (2026-06-26)** |
| [DOSTUP_CRUD_YAKUNLANDI.md](./DOSTUP_CRUD_YAKUNLANDI.md) | **✅ Dostup CRUD rejasi yakunlandi** |
| [POLKI_AVTO_BONUS_YAKUNLANDI.md](./POLKI_AVTO_BONUS_YAKUNLANDI.md) | **✅ Polki avto bonus rejasi yakunlandi** |
| [WORK_SLOTS_YAKUNLANDI.md](./WORK_SLOTS_YAKUNLANDI.md) | **✅ Ishchi o‘rni (WorkSlot) rejasi yakunlandi** |
| [BACKEND_REFACTORING_V1_YAKUNLANDI.md](./BACKEND_REFACTORING_V1_YAKUNLANDI.md) | **✅ Backend refaktoring v1 rejasi yakunlandi** |
| [BITTA_ILOVA_YAKUNLANDI.md](./BITTA_ILOVA_YAKUNLANDI.md) | **✅ Mobile (bitta ilova) rejasi yakunlandi** |
| [FRONTEND_REFACTORING_YAKUNLANDI.md](./FRONTEND_REFACTORING_YAKUNLANDI.md) | **✅ Frontend refaktoring rejasi yakunlandi** |
| [PLAN_APPROVERS_YAKUNLANDI.md](./PLAN_APPROVERS_YAKUNLANDI.md) | **✅ Tasdiqlovchilar (Планы) rejasi yakunlandi** |
| [PROD_DEPLOY_YAKUNLANDI.md](./PROD_DEPLOY_YAKUNLANDI.md) | **✅ Prod deploy pack** |
| [DOSTUP_RBAC_FULL_YAKUNLANDI.md](./DOSTUP_RBAC_FULL_YAKUNLANDI.md) | **✅ Dostup to‘liq RBAC** |
| [WORK_SLOTS_V2_FE_YAKUNLANDI.md](./WORK_SLOTS_V2_FE_YAKUNLANDI.md) | **✅ WorkSlot v2 FE** |
| [ORDER_APPROVAL_WORKFLOW_YAKUNLANDI.md](./ORDER_APPROVAL_WORKFLOW_YAKUNLANDI.md) | **✅ Buyurtma tasdiqlash zanjiri** |
| [ACCESS_WORKSPACE_SPLIT_YAKUNLANDI.md](./ACCESS_WORKSPACE_SPLIT_YAKUNLANDI.md) | **✅ Access workspace split (to‘liq, ≤400 LOC)** |
| [MOBILE_CONFIG_CLEANUP_YAKUNLANDI.md](./MOBILE_CONFIG_CLEANUP_YAKUNLANDI.md) | **✅ Mobile config Faza 1–4 + cleanup** |
| [YAKUNLANDI_AUDIT_REJA.md](./YAKUNLANDI_AUDIT_REJA.md) | Qisqa yakun bildirishnomasi |
| [../.cursor/plans/salec_refaktoring_reja_v1.plan.md](../.cursor/plans/salec_refaktoring_reja_v1.plan.md) | Backend refaktoring v1 |
| [../.cursor/plans/refaktoring_davom_handoff_2026-05-17.md](../.cursor/plans/refaktoring_davom_handoff_2026-05-17.md) | Frontend refaktoring handoff |

## Migration duplicate timestamps (faqat yangi DB clone)

Mavjud DB da **qayta nomlamang** — `_prisma_migrations` buziladi. Yangi clone uchun juft timestamplar:

- `20260613120000` — ikki migration
- `20260613140000` — ikki migration
