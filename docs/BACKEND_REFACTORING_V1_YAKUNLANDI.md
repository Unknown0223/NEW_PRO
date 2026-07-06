# ✅ Backend refaktoring v1 — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi)

Katta monolit servislarni domain-driven modullarga bo‘lish: **bir fayl ≤400 qator**, barrel re-export orqali **backward-compatible** import yo‘llari, rollback backup fayllar.

Manba: `SALEC_Refaktoring_Reja_v1.docx` · Konventsiya: [`backend/docs/domain-boundary.md`](../backend/docs/domain-boundary.md)

---

## Tekshiruv buyruqi

```powershell
cd backend
npm run refaktoring:verify
```

| Qadam | Natija |
|-------|--------|
| `audit:max-loc` | ✅ barcha `src/**/*.ts` ≤400 (48 legacy allowlist) |
| `test:contracts` | ✅ 24/24 |
| Barrel smoke | ✅ 6/6 (orders, staff, payments, dashboard, clients, stock) |
| Orders pure | ✅ 53/53 (`order-bonus-apply` + `bonus-and-discount`) |
| Orders integration | ✅ 14/14 (create, patch, rules, RBAC) |

**Jami:** **98/98** test + max-loc gate ✅

---

## Bo‘lingan modullar (asosiy)

| Modul | Barrel | Holat |
|-------|--------|-------|
| Orders | `orders.service.ts` → `domain/*` | ✅ v1 + route split (v2) |
| Dashboard | `dashboard.service.ts` | ✅ cache, sales, finance, monitoring |
| Payments | `payments.service.ts` | ✅ create, balance, query, consignment |
| Staff | `staff.service.ts` | ✅ shared, crud, patches, kind re-export |
| Clients | `clients.service.ts` | ✅ v3 (list, write, import, merge) |
| Stock | `stock.service.ts` | ✅ v3 |
| Products | `products.service.ts` | ✅ v3 |
| Returns | `returns-enhanced.service.ts` | ✅ v3 |
| Bonus rules | `bonus-rules.service.ts` | ✅ v3 |
| Reference, linkage, expenses, … | barrel + domain fayllar | ✅ v3 |

**Tegmaslik zonasi** (faqat import yo‘li saqlangan): `work-slots`, `access`, `report-builder`.

---

## Rollback

Har katta split uchun `*.service.backup.ts` / `*.route.backup.ts` saqlangan. Masalan:

- `orders.service.backup.ts`
- `dashboard.service.backup.ts`
- `staff.route.backup.ts`

---

## Qo‘shimcha gate (to‘liq foundation)

```powershell
npm run foundation:verify:fast   # contracts + route-tenant + max-loc + openapi
npm run test:ci                  # 421/421 (to‘liq CI)
npm run test:coverage:orders     # orders domain coverage (ixtiyoriy)
```

---

## Asosiy fayllar

| Maqsad | Yo‘l |
|--------|------|
| Reja (to‘liq checklist) | `.cursor/plans/salec_refaktoring_reja_v1.plan.md` |
| Domain boundary | `backend/docs/domain-boundary.md` |
| Barrel smoke test | `backend/tests/refaktoring-barrels.pure.test.ts` |
| Orders integration | `backend/tests/orders.integration.*.test.ts` |
| Max LOC audit | `scripts/audit-max-file-lines.mjs` |

---

*Reja: `.cursor/plans/salec_refaktoring_reja_v1.plan.md`*
