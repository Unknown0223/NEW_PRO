# ✅ Frontend refaktoring — yakunlandi

**Sana:** 2026-06-26

## Maqsad (bajarildi — Sprint B asosiy)

Katta monolit komponentlarni modul arxitekturaga bo‘lish: **order-create** hook/view ajratish, auth/routes markazlashtirish, max-loc gate + legacy allowlist, CI sifat gate.

Reja: `.cursor/plans/refaktoring_davom_handoff_2026-05-17.md` · Solishtiruv: `.cursor/plans/refaktoring_solishtirish_1e3d116d.plan.md`

---

## Tekshiruv buyruqi

```powershell
cd frontend
npm run refaktoring:verify
```

| Qadam | Natija |
|-------|--------|
| `audit:max-loc` | ✅ ≤400 (125 legacy allowlist, 0 yangi) |
| `test:quality` (typecheck + lint + unit) | ✅ **86/86**, lint **0/0** |

**Jami:** **86/86** test + max-loc + lint ✅

---

## Bajarilgan ishlar (asosiy)

| Band | Holat | Fayl / izoh |
|------|--------|-------------|
| Order create split | ✅ | `order-create/` — shell (~23), `use-order-create.ts`, `order-create-view.tsx`, polki/standard params |
| Barrel import yo‘li | ✅ | `order-create-workspace.tsx` → `./order-create/` |
| Auth / routes | ✅ | `lib/auth-sync.ts`, `lib/routes.ts`, `middleware.ts` |
| WDR hook ajratish | ✅ | `wdr/use-report-builder-pivot-height.ts` |
| Frontend audit CI | ✅ | `npm run audit:max-loc`, legacy allowlist |
| ESLint | ✅ | 0 xato, 0 warning (2026-06-26 audit) |
| Split skriptlar | ✅ | `scripts/build-order-create-split-v2.mjs`, `restore-and-split-order-create.mjs`, … |

---

## Katta fayllar (legacy allowlist — keyingi inkrement)

125 ta fayl hali >400 qator; gate **yangi** fayllarni bloklaydi, mavjudlar allowlistda:

| Prioritet (keyingi sprint) | Taxminiy LOC |
|----------------------------|--------------|
| `access-workspace.tsx` | ~2870 |
| `wdr-report-builder.tsx` | ~2698 |
| `dashboard-sales-monitoring.tsx` | ~2643 |
| `access-user-detail-panel.tsx` | ~2522 |
| `agents-workspace.tsx` | ~2453 |

Order-create **view/hook** hali >400 — composition root sifatida allowlistda; keyingi bosqichda kichik komponentlarga bo‘linadi.

---

## Test to‘plamlari (`refaktoring:verify`)

| To‘plam | Testlar | Nima tekshiradi |
|---------|---------|-----------------|
| `refaktoring-barrels.pure.test.ts` | 4 | Barrel, protected routes, auth-sync |
| `exchange-order-create.test.ts` | 3 | Exchange order panel |
| `polki-bonus-balance.logic.test.ts` | 8 | Order-create polki mantiq |
| `test:quality` (qolgan) | 71 | lib, UI, report-builder, … |

---

## Qo‘shimcha gate (to‘liq frontend)

```powershell
npm run test:all          # quality + max-loc + e2e smoke
npm run test:e2e:smoke    # Playwright (backend+web kerak)
```

---

## Asosiy fayllar

| Maqsad | Yo‘l |
|--------|------|
| Handoff reja | `.cursor/plans/refaktoring_davom_handoff_2026-05-17.md` |
| Order create modul | `frontend/components/orders/order-create/` |
| Legacy allowlist | `scripts/legacy-max-loc-frontend.txt` |
| Barrel smoke | `frontend/tests/refaktoring-barrels.pure.test.ts` |

---

*Reja: `.cursor/plans/refaktoring_davom_handoff_2026-05-17.md`*
