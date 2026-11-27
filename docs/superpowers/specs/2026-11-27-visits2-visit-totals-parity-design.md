# #4 visits-2 / visit-totals parity gaps (A)

**Date:** 2026-11-27  
**Status:** approved (user «A» — 3 deferred; 4+5 now)  
**Scope:** `visits-2` territory cascade; `visit-totals` BAD_RANGE Card banner  
**Non-goals:** CustomReport adapters (#3); full SD sort UI

## Goals

- `visits-2`: Зона → Область → Город options cascade (`regions_by_zone` / `cities_by_zone_region`); invalid child selections pruned.
- `visit-totals`: API `400 BAD_RANGE` (≤93 kun) → visible Card banner (not empty table silence).
- Shared FlatReport chrome flags; ≤400 LOC.
- Then commit (otchot-related) + deploy (#5).

## Approach

- `FlatReportConfig.territoryCascade?: boolean` + helper filters multiItems from filter-options maps.
- FlatReportPage shows `reportQ.isError` message via existing API error body.
- Commit: outlet-class + #4 + parity docs; exclude `tmp-*`, face-vcam WIP unless already staged for ship.
