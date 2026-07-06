import { EXTENDED_IMPORT_PHASES_0_2 } from "./system-migration.extended-specs.phases-0-2";
import { EXTENDED_IMPORT_PHASES_3_4 } from "./system-migration.extended-specs.phases-3-4";

export type { ExtendedExportScope, ExtendedTableSpec, MapKey } from "./system-migration.extended-specs.types";

export const EXTENDED_IMPORT_PHASES = [...EXTENDED_IMPORT_PHASES_0_2, ...EXTENDED_IMPORT_PHASES_3_4];

export const ALL_EXTENDED_FILES = EXTENDED_IMPORT_PHASES.flat().map((s) => s.file);
