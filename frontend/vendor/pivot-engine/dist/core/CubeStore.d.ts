import type { PivotConfig } from "../types/pivot.types.js";
import { CubeBuilder } from "./CubeBuilder.js";
export type CubeCacheEntry = {
    cube: CubeBuilder;
    filteredData: Record<string, unknown>[];
    dataHash: string;
    configHash: string;
};
/** Ma'lumot va agregatsiya konfiguratsiyasi bo'yicha cube keshi. */
export declare class CubeStore {
    private cache;
    private maxEntries;
    get(dataHash: string, configHash: string): CubeCacheEntry | undefined;
    set(entry: CubeCacheEntry): void;
    clear(): void;
    get size(): number;
}
/** Ma'lumot massivi uchun oddiy kontent xeshi. */
export declare function hashPivotData(data: Record<string, unknown>[]): string;
/** Agregatsiya uchun konfig xeshi (sort va ko'rinish opsiyalari tashqari). */
export declare function hashAggregationConfig(config: PivotConfig): string;
/** To'liq konfig (tartiblash bilan) — natija keshi kaliti. */
export declare function hashFullConfig(config: PivotConfig): string;
/**
 * Yangi ma'lumot eskisining faqat qo'shimcha qatorlari ekanini tekshiradi.
 * Prefix xeshi mos kelsa append-only deb hisoblanadi.
 */
export declare function isAppendOnlyDataUpdate(prev: Record<string, unknown>[], next: Record<string, unknown>[]): boolean;
/** Faqat tartiblash o'zgarganini aniqlash. */
export declare function isSortOnlyChange(prev: PivotConfig, next: PivotConfig): boolean;
//# sourceMappingURL=CubeStore.d.ts.map