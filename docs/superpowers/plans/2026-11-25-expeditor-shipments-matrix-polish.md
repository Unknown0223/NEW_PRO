# Expeditor shipments matrix polish (A)

> **For agentic workers:** implement task-by-task; TDD for pure helpers.

**Goal:** Dense, readable product×expeditor matrix without losing metrics, category tree, footer, or filters.

**Architecture:** Keep dedicated workspace/table. Add `filterEmptyExpeditorColumns` + UI toggle; denser thead/cells; metric short labels; toolbar expand-all / show-empty.

**Tech Stack:** Next.js, existing FlatReport filter chrome, Vitest.

**Spec:** Brainstorm approach A (user chose 2026-11-25).

## Tasks

- [x] Helper `filterEmptyExpeditorColumns` + tests
- [x] Table: short metric headers, denser layout, showEmpty prop, expand/collapse all
- [x] Workspace toolbar: show empty toggle + expand control wiring
- [x] Verify vitest + eslint + max-loc
