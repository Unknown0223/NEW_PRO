/**
 * Legacy «Dostuplar ro'yxati» (Text Document) → permission catalog metadata.
 * Generated keys live in `legacy-permissions.generated.ts` (regenerate: `node scripts/parse-legacy-permissions.mjs`).
 * Route-level `requirePermission` for each key is a separate phase; this module is catalog + labels only.
 */
export { LEGACY_PERMISSION_METADATA } from "./legacy-permissions.generated";

/** Reserved / future operations from the same legacy doc — not seeded as Permission rows. */
export const LEGACY_PLANNED_OPERATION_NOTES: string[] = [
  "Granular API guards for individual legacy keys are not wired yet; attach keys in UI, then map endpoints to requirePermission in a follow-up."
];
