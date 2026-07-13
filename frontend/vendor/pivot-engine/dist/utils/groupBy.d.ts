declare const GROUP_KEY_SEPARATOR = " | ";
declare const ALL_GROUP_KEY = "__all__";
export type GroupByOptions = {
    /** Bo'sh qiymatlar uchun ko'rsatiladigan matn */
    nullLabel?: string;
};
/**
 * Ma'lumotlarni berilgan maydonlar bo'yicha guruhlaydi.
 * Bir nechta maydon bo'lsa, kalit `field1 | field2` formatida.
 */
export declare function groupBy<T extends Record<string, unknown>>(data: T[], fields: string[], options?: GroupByOptions): Map<string, T[]>;
/**
 * Guruh kalitini alohida qismlarga ajratadi.
 */
export declare function splitGroupKey(key: string): string[];
/**
 * Guruh kalitining oxirgi qismini qaytaradi (ko'pincha qator nomi).
 */
export declare function lastGroupKeyPart(key: string): string;
export { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR };
//# sourceMappingURL=groupBy.d.ts.map