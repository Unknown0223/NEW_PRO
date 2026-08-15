# @salec/pivot-engine

SavdoDesk **Virtual Pivot Engine** — WebDataRocks Premium o'rniga o'z pivot hisoblash yadrosi.

## Tez boshlash

```bash
cd packages/pivot-engine
npm install
npm run build
npm test
```

## SALEC bilan ishlash

1. Root repoda `npm install` (workspaces orqali bog'lanadi)
2. `packages/pivot-engine` da `npm run dev` — TypeScript watch
3. Frontend: `NEXT_PUBLIC_PIVOT_ENGINE=1` va `/reports/builder/dev` sahifasini oching

Batafsil: [INTEGRATION.md](./INTEGRATION.md), [SYNC.md](./SYNC.md), [PLAN.md](./PLAN.md)

## Hozirgi holat (Phase A)

- `pivot.types.ts` — barcha asosiy tiplar
- `formatters.ts` — UZS, foiz, sana (uz-UZ)
- `groupBy.ts` — ma'lumotlarni guruhlash
- `Aggregator.ts` — SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT
- `FilterEngine.ts` — include/exclude/range/date_range
- `salec-field-adapter.ts` — SALEC metadata stub

## Import

```typescript
import {
  Aggregator,
  FilterEngine,
  groupBy,
  formatCurrency,
  salecFieldsToPivotFields,
  type PivotConfig,
  type PivotField
} from "@salec/pivot-engine";
```

## Arxitektura

To'liq arxitektura: `../../_extracted_files3/PIVOT_ENGINE_ARCHITECTURE.md`
