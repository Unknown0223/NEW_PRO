# Excel export dedicated workspace (A)

> **For agentic workers:** TDD helpers; implement task-by-task.

**Goal:** SalesDoc `/report/export/version1` parity — filters + 6 status cards + detail table + Excel v1.

**Architecture:** Dedicated FE workspace (not thin FlatReport-only). BE report returns `status_summaries` (amount/qty/volume/akb per bucket). Card click applies status group filter.

**Spec:** Approach A (user 2026-11-25).

## Tasks

- [x] BE: status summary buckets + COALESCE dates (already) + volume
- [x] FE: workspace (filters chrome, cards, table, export)
- [x] Thin page.tsx → workspace; contract test update
- [x] Smoke + lint/max-loc
