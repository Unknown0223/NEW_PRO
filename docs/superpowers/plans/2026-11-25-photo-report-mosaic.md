# Photo report mosaic (#8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/photo` to FlatReport filter chrome parity plus mosaic/table photo viewing with auth thumbnails and lightbox.

**Architecture:** Dedicated `PhotoReportWorkspace` (not FlatReportPage alone). BE adds `thumb_url` on rows and `GET .../reports/photo/:photoId/content` (JWT + `reports.fotootchyoty.view`, reuse supervisor decode/shrink). FE: filter polish, view toggle Mosaic|Table, mosaic cards, table thumb column, lightbox via authenticated blob fetch.

**Tech Stack:** Next.js, Fastify/Prisma, sharp thumb helper, Vitest, existing `client_photo_reports`.

**Spec:** `docs/superpowers/specs/2026-11-25-photo-report-mosaic-design.md`

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`).
- Sifat: `npm run lint:errors --prefix frontend`; `cd backend && npx tsc -p tsconfig.json --noEmit`; `npm run audit:max-loc`.
- Picker labels: faqat nom.
- Ro‘yxat API da base64 `image_url` yo‘q — faqat `thumb_url` path.
- Commit/deploy faqat user so‘raganda.
- Доступ `reports.fotootchyoty` o‘zgartirilmaydi.

## Review Focus

- `content_purged=true` → mosaika/jadvalda placeholder, content 404/410, lightbox ochilmasin.
- User with only report view (not supervisor) can load `.../reports/photo/:id/content`.
- Mosaic default; toggle Table restores text columns + thumb.
- Filter search field absent; `clientTableSearch` / mosaic text filter still works.
- Seed idempotent enough for aksit (`total > 0` after run).

---

### Task 1: BE thumb_url + content route

**Files:**
- Modify: `backend/src/modules/reports/photo-report.types.ts`
- Modify: `backend/src/modules/reports/photo-report.report.ts`
- Create: `backend/src/modules/reports/photo-report.content.ts`
- Modify: `backend/src/modules/reports/reports.route.photo.ts`
- Modify: `backend/src/modules/reports/photo-report.service.ts` (re-export if needed)
- Test: `backend/tests/photo-report.pure.test.ts` (create if missing)

**Interfaces:**
- Consumes: tenant slug in route; `ClientPhotoReport` by id+tenant
- Produces:
  - `PhotoReportRow.thumb_url: string | null` — null when purged; else `/api/{slug}/reports/photo/{id}/content?thumb=1`
  - `buildPhotoReportThumbUrl(tenantSlug: string, photoId: number, purged: boolean): string | null`
  - `GET /api/:slug/reports/photo/:photoId/content` — query `thumb=1` optional; `reportViewPreHandler`; streams image bytes (reuse `readStoredClientPhoto` / `shrinkPhotoThumb` / decode from dashboard supervisor content helpers)

- [ ] **Step 1: Write the failing test**

```ts
import { buildPhotoReportThumbUrl } from "../src/modules/reports/photo-report.content";

it("buildPhotoReportThumbUrl returns null when purged", () => {
  expect(buildPhotoReportThumbUrl("aksit", 9, true)).toBeNull();
});

it("buildPhotoReportThumbUrl points at reports content with thumb=1", () => {
  expect(buildPhotoReportThumbUrl("aksit", 9, false)).toBe(
    "/api/aksit/reports/photo/9/content?thumb=1"
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/photo-report.pure.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement URL helper + wire report rows + content route**

`photo-report.content.ts`: `buildPhotoReportThumbUrl` + `getPhotoReportContent(tenantId, photoId, thumb: boolean)` returning `{ buffer, contentType }` or not-found.  
Report map: set `thumb_url` via helper (needs `tenantSlug` — pass into `getPhotoReport` from route).  
Route: register content GET before list route if path conflict; use `reportViewPreHandler`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/photo-report.pure.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** — skip unless user asks

---

### Task 2: FE PhotoReportWorkspace (filters + mosaic + table + lightbox)

**Files:**
- Create: `frontend/components/reports/photo/photo-report-workspace.tsx`
- Create: `frontend/components/reports/photo/photo-report-mosaic.tsx`
- Create: `frontend/components/reports/photo/photo-report-thumb.tsx` (auth blob img)
- Create: `frontend/components/reports/photo/photo-report-lightbox.tsx` (minimal; may adapt supervisor patterns without importing Pro theme as requirement)
- Modify: `frontend/app/(dashboard)/reports/photo/page.tsx` → thin workspace
- Test: `frontend/tests/photo-report-workspace.contract.test.ts`

**Interfaces:**
- Consumes: `GET reports/photo` rows with `thumb_url`, `content_purged`; filter-options same as today; export same permission
- Produces: page source uses `PhotoReportWorkspace` not bare `FlatReportPage`; mosaic default; `tablePrefsId: "report.photo.v1"`; `filterGridCols: 6`; no filter `kind: "search"`

- [ ] **Step 1: Write the failing contract test**

```ts
it("photo page uses workspace with mosaic toggle", () => {
  const page = readFileSync("app/(dashboard)/reports/photo/page.tsx", "utf8");
  expect(page).toMatch(/PhotoReportWorkspace/);
  expect(page).not.toMatch(/FlatReportPage/);
  const ws = readFileSync("components/reports/photo/photo-report-workspace.tsx", "utf8");
  expect(ws).toMatch(/Mosaika|Мозаика/);
  expect(ws).toMatch(/thumb_url/);
  expect(ws).toMatch(/filterGridCols:\s*6|filterGridCols=\{6\}/);
});
```

(Adjust assertion to match actual Russian/Uzbek UI labels chosen: use `Мозаика` / `Таблица`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/photo-report-workspace.contract.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement workspace**

Reuse FlatReport filter field config pattern (copy inventory-style field list without search). Fetch report/filter-options/export like FlatReportPage. View state `mosaic` | `table`. Mosaic grid of cards; table with leading thumb column; lightbox on click when `thumb_url` set. Split files to stay ≤400 LOC.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/photo-report-workspace.contract.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** — skip unless user asks

---

### Task 3: Seed + smoke + parity checklist

**Files:**
- Modify or run: `backend/scripts/seed-photo-reports-test-once.ts` (ensure `IMPORT_TENANT_SLUG=aksit` works; tiny SVG/data URLs OK)
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` (#8 done)
- Optional: update `scripts/salesdoc/report-family-inventory.md` note for photo → dedicated workspace / mosaika

**Interfaces:**
- Consumes: Task1 API shape
- Produces: smoke `total > 0`; content endpoint 200 for a non-purged id; export 200

- [ ] **Step 1: Run/adapt seed for aksit**

Run: `cd backend && IMPORT_TENANT_SLUG=aksit npx tsx scripts/seed-photo-reports-test-once.ts`  
Expected: photos created (log count ≥ 1)

- [ ] **Step 2: API smoke**

Login aksit admin; filter-options 200; report `total > 0` and `rows[0].thumb_url` matches `/reports/photo/.../content`; `GET` that URL with Bearer → 200; export 200.

- [ ] **Step 3: Quality gates**

```bash
npm run lint:errors --prefix frontend
cd backend && npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
```

Expected: exit 0

- [ ] **Step 4: Mark #8 done in otchot parity plan**

Row 8 + Task 7 checkbox → done 2026-11-25; next **#9 tasks**.

- [ ] **Step 5: Commit** — skip unless user asks

---

## Spec coverage (self-review)

| Spec goal | Task |
|-----------|------|
| Filter chrome prefs/grid/no dup search | 2 |
| Mosaic + Table views | 2 |
| thumb in table + mosaic | 2 |
| thumb_url / no base64 list | 1 |
| content JWT proxy | 1 |
| seed + smoke | 3 |
| #8 done marker | 3 |
