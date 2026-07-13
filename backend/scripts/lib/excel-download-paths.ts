/**
 * Downloads va Telegram Desktop ichidan Excel fayllarni qidirish.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { findInDir } from "./excel-bundle-paths";

export function downloadsDirs(): string[] {
  const profile = process.env.USERPROFILE || process.env.HOME || "";
  if (!profile) return [];
  const downloads = path.join(profile, "Downloads");
  const dirs = [downloads];
  const telegram = path.join(downloads, "Telegram Desktop");
  if (fs.existsSync(telegram)) dirs.push(telegram);
  return dirs;
}

/** Aniq fayl nomlari, keyin kalit so‘z bo‘yicha qidiruv (har bir papkada). */
export function findExcelInDownloads(exactNames: string[], keywords: string[] = []): string | null {
  for (const dir of downloadsDirs()) {
    if (!fs.existsSync(dir)) continue;
    for (const name of exactNames) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
    if (keywords.length > 0) {
      const found = findInDir(dir, keywords);
      if (found) return found;
    }
  }
  return null;
}
