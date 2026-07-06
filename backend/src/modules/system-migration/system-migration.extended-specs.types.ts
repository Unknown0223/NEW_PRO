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
};
