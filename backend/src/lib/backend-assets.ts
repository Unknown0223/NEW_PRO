import { existsSync } from "fs";
import { dirname, join } from "path";

/**
 * `backend/assets/...` ni topadi.
 * tsx: `src/...` dan; tsc: `dist/src/...` dan; Docker: `/app/assets` (cwd).
 */
export function resolveBackendAssetFrom(starts: string[], ...parts: string[]): string {
  const seen = new Set<string>();
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const candidate = join(dir, "assets", ...parts);
      if (!seen.has(candidate)) {
        seen.add(candidate);
        if (existsSync(candidate)) return candidate;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return join(process.cwd(), "assets", ...parts);
}

export function resolveBackendAsset(...parts: string[]): string {
  return resolveBackendAssetFrom([__dirname, process.cwd()], ...parts);
}
