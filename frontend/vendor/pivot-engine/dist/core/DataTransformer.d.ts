import { ALL_GROUP_KEY } from "../utils/groupBy.js";
export declare class DataTransformer {
    /**
     * Ma'lumotlarni berilgan maydonlar bo'yicha guruhlaydi.
     */
    groupData(data: Record<string, unknown>[], fields: string[]): Map<string, Record<string, unknown>[]>;
    /**
     * Ustun guruhlarini aniqlaydi.
     */
    getColumnGroups(data: Record<string, unknown>[], fields: string[]): Map<string, Record<string, unknown>[]>;
    /**
     * Flat data → pivot uchun qulay format (sana maydonlarini yil/oy/chorak ga ajratish).
     */
    normalize(data: Record<string, unknown>[], dateFields: string[]): Record<string, unknown>[];
    private getWeekNumber;
}
export { ALL_GROUP_KEY };
//# sourceMappingURL=DataTransformer.d.ts.map