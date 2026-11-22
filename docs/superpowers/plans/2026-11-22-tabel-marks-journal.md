# Tabel Marks Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox syntax.

**Goal:** Finish `/tabel/marks` by porting hr-hub journal UX into SALEC `TabelMarksWorkspace`.

**Architecture:** Split types/thumb/card helpers; keep workspace as orchestrator. No new backend endpoints.

**Tech Stack:** Next.js client, React Query, existing `api` + shadcn Dialog/Button.

**Spec:** `docs/superpowers/specs/2026-11-22-tabel-marks-journal-design.md`

## Global Constraints

- Picker labels: name only (`staffPickerDisplayName`).
- New files ≤400 LOC; do not grow legacy workspace without split.
- No bulk delete/import APIs.

## Review Focus

- Error path does not look like empty list.
- Photo blob URLs revoked.
- Staff option labels never include code/login.
- Pagination resets on filter change.

## File map

- `frontend/components/tabel/tabel-marks-types.ts` — types + label maps
- `frontend/components/tabel/tabel-marks-photo-thumb.tsx` — front photo thumb
- `frontend/components/tabel/tabel-marks-card-dialog.tsx` — detail + media
- `frontend/components/tabel/tabel-marks-workspace.tsx` — filters, table, pager, error, review

## Tasks

### Task 1: Extract types + photo thumb

- [x] Create `tabel-marks-types.ts` with `TabelMarkRow`, `OpenDayRow`, role/source maps
- [x] Create `tabel-marks-photo-thumb.tsx` (blob load + revoke)
- [x] Re-export `TabelMarkRow` from workspace for existing importers

### Task 2: Card dialog + workspace polish

- [x] Extract card/media dialog
- [x] Error banner (`marksQ.isError`)
- [x] Employee `<select>` from `/timesheet/filters` (name-only)
- [x] Photo column; client pager 50
- [x] Review buttons on main journal when `!is_valid` or `review_status === "pending"`
- [x] Drop code from employee subtitle (branch + role only)

### Task 3: Verify

- [x] `npm run lint:errors --prefix frontend` (touched files)
- [x] `npm run typecheck --prefix frontend` (marks clean; unrelated pre-existing errors remain)
- [x] `npm run audit:max-loc`
