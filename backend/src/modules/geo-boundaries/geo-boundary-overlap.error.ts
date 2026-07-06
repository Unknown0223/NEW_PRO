import type { GeoBoundaryOverlapConflict } from "./geo-boundaries.types";

export class GeoBoundaryOverlapError extends Error {
  readonly conflicts: GeoBoundaryOverlapConflict[];

  constructor(conflicts: GeoBoundaryOverlapConflict[]) {
    super("Hudud mavjud chegaralar bilan kesishadi");
    this.name = "GeoBoundaryOverlapError";
    this.conflicts = conflicts;
  }
}
