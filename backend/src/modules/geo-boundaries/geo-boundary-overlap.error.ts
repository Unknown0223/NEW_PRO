import type { GeoBoundaryOverlapConflict } from "./geo-boundaries.types";

export class GeoBoundaryOverlapError extends Error {
  readonly conflicts: GeoBoundaryOverlapConflict[];

  constructor(conflicts: GeoBoundaryOverlapConflict[]) {
    super("Территория пересекается с существующими границами");
    this.name = "GeoBoundaryOverlapError";
    this.conflicts = conflicts;
  }
}
