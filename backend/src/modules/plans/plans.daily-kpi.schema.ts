import { z } from "zod";

/** Bo‘sh string / null → undefined (querystring uchun). */
function emptyToUndef(v: unknown): unknown {
  if (v == null) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  if (Array.isArray(v)) return emptyToUndef(v[0]);
  return v;
}

const ymd = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "DAY_FORMAT");

const optionalPositiveId = z.preprocess(
  emptyToUndef,
  z.coerce.number().int().positive().optional()
);

export const dailyKpiDayMatrixQuerySchema = z.object({
  day: z.preprocess(emptyToUndef, ymd),
  direction_id: optionalPositiveId
});

export type DailyKpiDayMatrixQuery = z.infer<typeof dailyKpiDayMatrixQuerySchema>;

/** Eski overview (filtrlar) — saqlab qolindi. */
const csvIds = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v == null) return [] as number[];
    const raw = Array.isArray(v) ? v.join(",") : v;
    const uniq = new Set<number>();
    for (const part of raw.split(",")) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isFinite(n) && n > 0) uniq.add(n);
    }
    return Array.from(uniq).sort((a, b) => a - b);
  });

const csvStrings = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) => {
    if (v == null) return [] as string[];
    const raw = Array.isArray(v) ? v.join(",") : v;
    const uniq = new Set<string>();
    for (const part of raw.split(",")) {
      const t = part.trim();
      if (t) uniq.add(t);
    }
    return Array.from(uniq);
  });

export const dailyKpiOverviewQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  direction_id: optionalPositiveId,
  search: z.string().trim().max(120).optional(),
  supervisor_ids: csvIds,
  agent_ids: csvIds,
  branches: csvStrings,
  branch_codes: csvStrings,
  territory_1: csvStrings,
  territory_2: csvStrings,
  territory_3: csvStrings,
  territory1: csvStrings.optional(),
  territory2: csvStrings.optional(),
  territory3: csvStrings.optional()
});

export const dailyKpiDetailQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100)
});

export type DailyKpiOverviewQuery = z.infer<typeof dailyKpiOverviewQuerySchema>;
export type DailyKpiDetailQuery = z.infer<typeof dailyKpiDetailQuerySchema>;
