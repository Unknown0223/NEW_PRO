/**
 * Интерфейс адаптеров 1C / банк API + локальный fake для демо/тестов.
 * Прод ingest пока: Excel/CSV/manual → POST .../ingest | /import.
 *
 * Real 1C/bank: skeleton adapters throw until env credentials are set
 * (tashqi blok — do NOT pretend live calls work).
 */
import type { BankTransferIngestItem } from "../../contracts/bank-transfer-inbox.schemas";
import { ingestBankTransfers } from "./bank-transfer-inbox.ingest";

export type BankTransferAdapterSource = "bank_api" | "one_c";

export type BankTransferSourceAdapter = {
  source: BankTransferAdapterSource;
  /**
   * Забрать «новые» строки из внешнего источника.
   * Реальный адаптер: HTTP/очередь → нормализация в BankTransferIngestItem[].
   */
  fetchPending(): Promise<BankTransferIngestItem[]>;
};

/** Error code when skeleton adapters lack credentials. */
export const BANK_TRANSFER_ADAPTER_NOT_CONFIGURED = "BANK_TRANSFER_ADAPTER_NOT_CONFIGURED";

export class BankTransferAdapterNotConfiguredError extends Error {
  readonly code = BANK_TRANSFER_ADAPTER_NOT_CONFIGURED;
  readonly missingEnv: string[];

  constructor(adapterName: string, missingEnv: string[]) {
    const envList = missingEnv.join(", ");
    super(
      `${adapterName} is not configured (tashqi blok). Set env: ${envList}. ` +
        `Until then use Excel/CSV import or FakeBankTransferAdapter for local demo only.`
    );
    this.name = "BankTransferAdapterNotConfiguredError";
    this.missingEnv = missingEnv;
  }
}

/** Пустой stub — пока нет credentials / API. Не делает live вызовов. */
export class StubBankTransferAdapter implements BankTransferSourceAdapter {
  constructor(public readonly source: BankTransferAdapterSource) {}

  async fetchPending(): Promise<BankTransferIngestItem[]> {
    return [];
  }
}

export type FakeAdapterOptions = {
  /** Префикс external_id, чтобы повторный запуск не дублировал без нужды. */
  runId?: string;
  /**
   * Подставить реальный ИНН из каталога — тогда строка может стать exact match.
   * Без него sample-строки unmatched / demo-идентификаторы.
   */
  sampleInn?: string | null;
  sampleBankAccount?: string | null;
  sampleClientCode?: string | null;
};

/**
 * Fake adapter: стабильный набор sample-строк для локального демо/теста
 * без внешнего 1C/bank.
 */
export class FakeBankTransferAdapter implements BankTransferSourceAdapter {
  constructor(
    public readonly source: BankTransferAdapterSource = "bank_api",
    private readonly opts: FakeAdapterOptions = {}
  ) {}

  async fetchPending(): Promise<BankTransferIngestItem[]> {
    const runId = this.opts.runId ?? `fake-${Date.now()}`;
    const inn = this.opts.sampleInn?.trim() || null;
    const account = this.opts.sampleBankAccount?.trim() || null;
    const code = this.opts.sampleClientCode?.trim() || null;

    const rows: BankTransferIngestItem[] = [
      {
        external_id: `${runId}-exact`,
        amount: 150_000,
        currency: "UZS",
        paid_at: new Date().toISOString().slice(0, 10),
        payer_name: "Fake Exact Payer",
        payer_inn: inn,
        payer_bank_account: account,
        payer_client_code: code,
        purpose: "fake adapter exact-match sample",
        raw: { demo: true, scenario: "exact_or_unmatched" }
      },
      {
        external_id: `${runId}-unmatched`,
        amount: 77_000,
        currency: "UZS",
        payer_name: "Unknown Counterparty LLC",
        payer_inn: "000000000",
        purpose: "fake adapter unmatched sample",
        raw: { demo: true, scenario: "unmatched" }
      },
      {
        external_id: `${runId}-no-ids`,
        amount: 12_500,
        currency: "UZS",
        payer_name: "Only Name No Ids",
        purpose: "fake adapter no identifiers",
        raw: { demo: true, scenario: "unmatched_by_name" }
      }
    ];

    return rows;
  }
}

/** Required env for live 1C bank-transfer pull (none set → not configured). */
export const ONEC_BANK_TRANSFER_REQUIRED_ENV = [
  "ONEC_BASE_URL",
  "ONEC_USER",
  "ONEC_PASSWORD",
  "ONEC_BANK_TRANSFER_PATH"
] as const;

/**
 * Skeleton 1C adapter — throws until credentials are provided.
 * Does NOT call any remote host when misconfigured.
 */
export class OneCBankTransferAdapter implements BankTransferSourceAdapter {
  readonly source: BankTransferAdapterSource = "one_c";

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  missingEnvVars(): string[] {
    return ONEC_BANK_TRANSFER_REQUIRED_ENV.filter((k) => !String(this.env[k] ?? "").trim());
  }

  isConfigured(): boolean {
    return this.missingEnvVars().length === 0;
  }

  async fetchPending(): Promise<BankTransferIngestItem[]> {
    const missing = this.missingEnvVars();
    if (missing.length > 0) {
      throw new BankTransferAdapterNotConfiguredError("OneCBankTransferAdapter", missing);
    }
    // Live HTTP mapping is intentionally not implemented without verified credentials.
    throw new BankTransferAdapterNotConfiguredError("OneCBankTransferAdapter", [
      "ONEC_LIVE_IMPLEMENTATION_PENDING — credentials present but HTTP client not wired; " +
        "implement fetch against ONEC_BASE_URL + ONEC_BANK_TRANSFER_PATH"
    ]);
  }
}

/** Required env for live bank API pull. */
export const BANK_API_TRANSFER_REQUIRED_ENV = [
  "BANK_API_BASE_URL",
  "BANK_API_TOKEN",
  "BANK_API_TRANSFERS_PATH"
] as const;

/**
 * Skeleton bank API adapter — throws until credentials are provided.
 * Does NOT call any remote host when misconfigured.
 */
export class BankApiBankTransferAdapter implements BankTransferSourceAdapter {
  readonly source: BankTransferAdapterSource = "bank_api";

  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  missingEnvVars(): string[] {
    return BANK_API_TRANSFER_REQUIRED_ENV.filter((k) => !String(this.env[k] ?? "").trim());
  }

  isConfigured(): boolean {
    return this.missingEnvVars().length === 0;
  }

  async fetchPending(): Promise<BankTransferIngestItem[]> {
    const missing = this.missingEnvVars();
    if (missing.length > 0) {
      throw new BankTransferAdapterNotConfiguredError("BankApiBankTransferAdapter", missing);
    }
    throw new BankTransferAdapterNotConfiguredError("BankApiBankTransferAdapter", [
      "BANK_API_LIVE_IMPLEMENTATION_PENDING — credentials present but HTTP client not wired; " +
        "implement fetch against BANK_API_BASE_URL + BANK_API_TRANSFERS_PATH"
    ]);
  }
}

export type ResolvePollAdapterMode = "fake" | "stub" | "one_c" | "bank_api";

/**
 * Poll/worker adapter selection (no live calls unless mode + credentials + wired HTTP).
 * Default for poll script: fake (local demo) or stub (empty).
 */
export function resolveBankTransferPollAdapter(
  mode: ResolvePollAdapterMode,
  opts?: FakeAdapterOptions
): BankTransferSourceAdapter {
  switch (mode) {
    case "fake":
      return new FakeBankTransferAdapter("bank_api", opts);
    case "stub":
      return new StubBankTransferAdapter("bank_api");
    case "one_c":
      return new OneCBankTransferAdapter();
    case "bank_api":
      return new BankApiBankTransferAdapter();
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/**
 * Adapter → domain ingest (dedupe by external_id уже внутри ingestBankTransfers).
 */
export async function ingestFromAdapter(
  tenantId: number,
  adapter: BankTransferSourceAdapter,
  actorUserId: number | null = null
): Promise<{
  results: Awaited<ReturnType<typeof ingestBankTransfers>>["results"];
  created: number;
  skipped: number;
}> {
  const items = await adapter.fetchPending();
  if (items.length === 0) {
    return { results: [], created: 0, skipped: 0 };
  }
  return ingestBankTransfers(tenantId, { source: adapter.source, items }, actorUserId);
}
