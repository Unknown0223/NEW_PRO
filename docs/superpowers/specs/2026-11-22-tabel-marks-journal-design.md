# Журнал отметок — design (short)

**Intent:** SALEC `/tabel/marks` ni hr-hub `attendance/marks` jurnalidagi ishlatiladigan holatga yetkazish (boshqa loyihadan UX), SALEC API va UI stackida.

**Why:** Sahifa bor, lekin xato UI yo‘q, xodim tanlovi yo‘q, foto ustuni yo‘q, sahifalash yo‘q; review faqat problems da.

## Approaches

1. **Wholesale CSS copy** — hr-hub `page.module.css` + FilterPanel. SALEC design system bilan urushadi. Rad.
2. **Adapt hr-hub UX into TabelMarksWorkspace** (tanlangan) — xato banner, xodim select, foto thumb, 50/page pager, asosiy jurnaldа review; mavjud API.
3. **Yangi detail route** — `/tabel/marks/[id]`. Keyinroq; kartochka dialog yetarli.

## Goals

- API/render xatosi sahifa ichida ko‘rinsin (dashboard 500 emas).
- Filtr: sana, filial, manba, **xodim select** (faqat nom).
- Jadvalda foto thumb (`photo_front`).
- Pagination 50.
- Review (одобрить/отклонить) asosiy jurnaldа ham, pending/invalid uchun.

## Non-goals

- Bulk delete/import/copy (SALEC API yo‘q).
- hr-hub CSS/TablePrefs ko‘chirish.
- Backend pagination total (client page yetarli; take=300).

## Constraints

- Picker labels: faqat nom (`staffPickerDisplayName`).
- Fayl ≤400 (yangi split); legacy workspace allowlist bor.
- Format/lint: repo rules.

## Builder calls

- Photo thumb = visits `TerminalPhoto` pattern.
- Employees = `/timesheet/filters`.
- Review = mavjud `POST .../marks/:id/review`.
