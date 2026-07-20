import type { MigrationIdMaps } from "./system-migration.id-maps";

export type MapKey = keyof MigrationIdMaps;

export type ExtendedExportScope =
  | "tenant"
  | "territory"
  | "warehouse"
  | "cash_desk"
  | "group"
  | "role"
  | "user"
  | "stock_take"
  | "correction"
  | "block"
  | "client_balance";

export type ExtendedTableSpec = {
  file: string;
  delegate: string;
  idMap?: MapKey;
  fk?: Partial<Record<string, MapKey>>;
  intArrayFk?: Partial<Record<string, MapKey>>;
  decimals?: string[];
  dates?: string[];
  noId?: boolean;
  scope?: ExtendedExportScope;
  hasTenantId?: boolean;
  /** Dublikat skip paytida mavjud qatorni topish (tenant_id + bu maydonlar). */
  naturalKey?: string[];
  /**
   * Majburiy FK maydonlari — remap null bo‘lsa create qilinmasin (Prisma 500 o‘rniga ogohlantirish).
   * `noId` jadvallarda default: barcha `fk` kalitlari.
   */
  requiredFk?: string[];
};
