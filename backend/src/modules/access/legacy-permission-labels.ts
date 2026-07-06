/**
 * Legacy «Dostuplar ro'yxati» (Text Document) → permission catalog metadata.
 * Generated keys live in `legacy-permissions.generated.ts` (regenerate: `node scripts/parse-legacy-permissions.mjs`).
 * Route-level `requirePermission` for each key is a separate phase; this module is catalog + labels only.
 */
export { LEGACY_PERMISSION_METADATA } from "./legacy-permissions.generated";

/** Reserved / future operations from the same legacy doc — not seeded as Permission rows. */
export const LEGACY_PLANNED_OPERATION_NOTES: string[] = [
  "Route-level guards for major API prefixes are wired in route-permission-guard.ts (RBAC_ENFORCE_PERMISSIONS=1)."
];
