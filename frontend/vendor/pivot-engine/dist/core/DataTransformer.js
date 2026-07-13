import { groupBy, ALL_GROUP_KEY } from "../utils/groupBy.js";
export class DataTransformer {
    /**
     * Ma'lumotlarni berilgan maydonlar bo'yicha guruhlaydi.
     */
    groupData(data, fields) {
        return groupBy(data, fields);
    }
    /**
     * Ustun guruhlarini aniqlaydi.
     */
    getColumnGroups(data, fields) {
        return this.groupData(data, fields);
    }
    /**
     * Flat data → pivot uchun qulay format (sana maydonlarini yil/oy/chorak ga ajratish).
     */
    normalize(data, dateFields) {
        return data.map((row) => {
            const normalized = { ...row };
            for (const field of dateFields) {
                if (row[field]) {
                    const d = new Date(row[field]);
                    if (!Number.isNaN(d.getTime())) {
                        normalized[`${field}_year`] = d.getFullYear();
                        normalized[`${field}_month`] = d.getMonth() + 1;
                        normalized[`${field}_quarter`] = Math.ceil((d.getMonth() + 1) / 3);
                        normalized[`${field}_week`] = this.getWeekNumber(d);
                    }
                }
            }
            return normalized;
        });
    }
    getWeekNumber(date) {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    }
}
export { ALL_GROUP_KEY };
