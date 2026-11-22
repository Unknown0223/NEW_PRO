# Taklifiy blok asos summalari + UI ixchamlashtirish

> **For agentic workers:** Use superpowers:executing-plans or implement inline with TDD. Checkbox tasks.

**Goal:** Supervayzer bloki KPI ustunida (Hammasiga / Butun blokka) Sof fakt yoki Eski reja asos jamini ko‘rsatish — faqat shu KPI×blok; sahifani ixchamlashtirish.

**Architecture:** Sof `sumBlockBasis` helper (`grouping` yonida). MatrixTable sarlavhasi va ColumnEditor preview shu helperdan. Backend o‘zgarmaydi (fakt/reja allaqachon KPI mahsulot kesimida).

**Tech Stack:** TypeScript, Vitest, React (taklifiy-reja)

**Spec:** Brainstorming tasdiqi (2026-11-23) + rasmdagi «Hammasiga» / «Butun blokka o‘rnatish»

## File Structure

- `frontend/components/plans/taklifiy-reja/lib/block-basis-totals.ts` — yangi pure helper
- `frontend/tests/block-basis-totals.test.ts` — TDD
- `frontend/components/plans/taklifiy-reja/components/matrix-table.tsx` — sarlavha jamlar
- `frontend/components/plans/taklifiy-reja/components/column-editor.tsx` — asos preview
- `frontend/components/plans/taklifiy-reja/taklifiy-reja-shell.tsx` / `blocks-view.tsx` — ixcham til/joylashuv

## Tasks

- [x] **Task 1:** `sumBlockBasis` / `basisAmountForCell` — RED test, GREEN implement
- [x] **Task 2:** MatrixTable KPI sarlavhasida Sof fakt + Eski reja jamlar (ready proposed o‘rniga asos)
- [x] **Task 3:** ColumnEditor da tanlangan asos uchun live jami
- [x] **Task 4:** UI polish — keraksiz matnlarni qisqartirish, bir xil o‘zbekcha amal yorliqlari
- [x] **Task 5:** Verify — vitest 4/4 + eslint (0 errors)
