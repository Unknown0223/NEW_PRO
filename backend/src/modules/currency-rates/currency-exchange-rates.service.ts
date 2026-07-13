import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { normalizeCurrencyCode, resolveCurrencyEntries } from "../tenant-settings/finance-refs";

function asRecord(v: unknown): Record<string, unknown> {
  if (v != null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function parseYmdUtcDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

async function allowedCurrencyCodes(tenantId: number): Promise<Set<string>> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const ref = asRecord(asRecord(row?.settings).references);
  const entries = resolveCurrencyEntries(ref);
  return new Set(entries.filter((e) => e.active !== false).map((e) => e.code));
}

function mapRow(r: {
  id: number;
  rate_date: Date;
  base_currency: string;
  quote_currency: string;
  rate: Prisma.Decimal;
  source: string | null;
  note: string | null;
  created_by_user_id: number | null;
  created_at: Date;
  updated_at: Date;
}) {
  const rd = r.rate_date;
  const y = rd.getUTCFullYear();
  const mo = String(rd.getUTCMonth() + 1).padStart(2, "0");
  const da = String(rd.getUTCDate()).padStart(2, "0");
  return {
    id: r.id,
    rate_date: `${y}-${mo}-${da}`,
    base_currency: r.base_currency,
    quote_currency: r.quote_currency,
    rate: r.rate.toString(),
    source: r.source,
    note: r.note,
    created_by_user_id: r.created_by_user_id,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString()
  };
}

export type ListCurrencyRatesQuery = {
  page: number;
  limit: number;
  from?: string;
  to?: string;
  base?: string;
  quote?: string;
};

export async function listCurrencyExchangeRates(tenantId: number, q: ListCurrencyRatesQuery) {
  const page = Math.max(1, q.page);
  const limit = Math.min(200, Math.max(1, q.limit));
  const where: Prisma.CurrencyExchangeRateWhereInput = { tenant_id: tenantId };
  if (q.from?.trim() || q.to?.trim()) {
    const gte = q.from?.trim() ? parseYmdUtcDate(q.from.trim()) : null;
    const lte = q.to?.trim() ? parseYmdUtcDate(q.to.trim()) : null;
    if (q.from?.trim() && !gte) throw new Error("BAD_FROM_DATE");
    if (q.to?.trim() && !lte) throw new Error("BAD_TO_DATE");
    where.rate_date = {};
    if (gte) where.rate_date.gte = gte;
    if (lte) where.rate_date.lte = lte;
  }
  if (q.base?.trim()) {
    const c = normalizeCurrencyCode(q.base);
    if (!c) throw new Error("BAD_BASE");
    where.base_currency = c;
  }
  if (q.quote?.trim()) {
    const c = normalizeCurrencyCode(q.quote);
    if (!c) throw new Error("BAD_QUOTE");
    where.quote_currency = c;
  }

  const [total, rows] = await Promise.all([
    prisma.currencyExchangeRate.count({ where }),
    prisma.currencyExchangeRate.findMany({
      where,
      orderBy: [{ rate_date: "desc" }, { base_currency: "asc" }, { quote_currency: "asc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  return {
    page,
    limit,
    total,
    data: rows.map(mapRow)
  };
}

export type CreateCurrencyRateInput = {
  rate_date: string;
  base_currency: string;
  quote_currency: string;
  rate: string | number;
  source?: string | null;
  note?: string | null;
};

export async function createCurrencyExchangeRate(
  tenantId: number,
  input: CreateCurrencyRateInput,
  actorUserId: number | null
) {
  const base = normalizeCurrencyCode(input.base_currency);
  const quote = normalizeCurrencyCode(input.quote_currency);
  if (!base || !quote) throw new Error("BAD_CURRENCY_CODE");
  if (base === quote) throw new Error("SAME_CURRENCY");
  const rd = parseYmdUtcDate(input.rate_date.trim());
  if (!rd) throw new Error("BAD_RATE_DATE");
  const rateDec = new Prisma.Decimal(String(input.rate).trim());
  if (!rateDec.isFinite() || rateDec.lte(0)) throw new Error("BAD_RATE");

  const allowed = await allowedCurrencyCodes(tenantId);
  if (!allowed.has(base) || !allowed.has(quote)) throw new Error("CURRENCY_NOT_IN_DIRECTORY");

  const src = input.source?.trim().slice(0, 64) || null;
  const note = input.note?.trim().slice(0, 500) || null;
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  try {
    const row = await prisma.currencyExchangeRate.create({
      data: {
        tenant_id: tenantId,
        rate_date: rd,
        base_currency: base,
        quote_currency: quote,
        rate: rateDec,
        source: src,
        note,
        created_by_user_id: uid
      }
    });
    return mapRow(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("DUPLICATE_RATE");
    }
    throw e;
  }
}

export type PatchCurrencyRateInput = {
  rate_date?: string;
  base_currency?: string;
  quote_currency?: string;
  rate?: string | number;
  source?: string | null;
  note?: string | null;
};

export async function patchCurrencyExchangeRate(
  tenantId: number,
  id: number,
  input: PatchCurrencyRateInput,
  _actorUserId: number | null
) {
  const existing = await prisma.currencyExchangeRate.findFirst({
    where: { id, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");

  const data: Prisma.CurrencyExchangeRateUpdateInput = {};
  if (input.rate_date !== undefined) {
    const rd = parseYmdUtcDate(String(input.rate_date).trim());
    if (!rd) throw new Error("BAD_RATE_DATE");
    data.rate_date = rd;
  }
  if (input.base_currency !== undefined) {
    const c = normalizeCurrencyCode(input.base_currency);
    if (!c) throw new Error("BAD_CURRENCY_CODE");
    data.base_currency = c;
  }
  if (input.quote_currency !== undefined) {
    const c = normalizeCurrencyCode(input.quote_currency);
    if (!c) throw new Error("BAD_CURRENCY_CODE");
    data.quote_currency = c;
  }
  if (input.rate !== undefined) {
    const rateDec = new Prisma.Decimal(String(input.rate).trim());
    if (!rateDec.isFinite() || rateDec.lte(0)) throw new Error("BAD_RATE");
    data.rate = rateDec;
  }
  if (input.source !== undefined) {
    data.source = input.source?.trim().slice(0, 64) || null;
  }
  if (input.note !== undefined) {
    data.note = input.note?.trim().slice(0, 500) || null;
  }

  if (Object.keys(data).length === 0) {
    return mapRow(existing);
  }

  const nextBase = (data.base_currency as string | undefined) ?? existing.base_currency;
  const nextQuote = (data.quote_currency as string | undefined) ?? existing.quote_currency;
  if (nextBase === nextQuote) throw new Error("SAME_CURRENCY");

  const allowed = await allowedCurrencyCodes(tenantId);
  if (!allowed.has(nextBase) || !allowed.has(nextQuote)) throw new Error("CURRENCY_NOT_IN_DIRECTORY");

  try {
    const row = await prisma.currencyExchangeRate.update({
      where: { id: existing.id },
      data
    });
    return mapRow(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new Error("DUPLICATE_RATE");
    }
    throw e;
  }
}

export async function deleteCurrencyExchangeRate(tenantId: number, id: number): Promise<void> {
  const r = await prisma.currencyExchangeRate.deleteMany({
    where: { id, tenant_id: tenantId }
  });
  if (r.count === 0) throw new Error("NOT_FOUND");
}

/**
 * Berilgan sana uchun eng yaqin kurs (≤ rate_date). Boshqa modullar keyinroq ulashi mumkin.
 */
export async function getLatestExchangeRate(
  tenantId: number,
  baseCurrency: string,
  quoteCurrency: string,
  asOfDate: Date
): Promise<{ rate: string; rate_date: string } | null> {
  const base = normalizeCurrencyCode(baseCurrency);
  const quote = normalizeCurrencyCode(quoteCurrency);
  if (!base || !quote || base === quote) return null;
  const row = await prisma.currencyExchangeRate.findFirst({
    where: {
      tenant_id: tenantId,
      base_currency: base,
      quote_currency: quote,
      rate_date: { lte: asOfDate }
    },
    orderBy: { rate_date: "desc" }
  });
  if (!row) return null;
  const m = mapRow(row);
  return { rate: m.rate, rate_date: m.rate_date };
}
