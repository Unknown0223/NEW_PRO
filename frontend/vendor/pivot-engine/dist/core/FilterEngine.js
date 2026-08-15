export class FilterEngine {
    apply(data, filters, fields) {
        if (!filters.length)
            return data;
        const rankFilters = filters.filter((filter) => filter.type === "top_n" || filter.type === "bottom_n");
        const rowFilters = filters.filter((filter) => filter.type !== "top_n" && filter.type !== "bottom_n");
        let result = data.filter((row) => rowFilters.every((filter) => this.matchesFilter(row, filter, fields)));
        for (const filter of rankFilters) {
            result = this.applyRankFilter(result, filter);
        }
        return result;
    }
    applyRankFilter(data, filter) {
        const limit = filter.topN;
        if (!limit || limit <= 0 || !data.length)
            return data;
        const scores = new Map();
        for (const row of data) {
            const key = row[filter.fieldId];
            if (key == null)
                continue;
            const score = this.rankScore(row, filter);
            scores.set(key, (scores.get(key) ?? 0) + score);
        }
        const ranked = [...scores.entries()].sort((a, b) => filter.type === "bottom_n" ? a[1] - b[1] : b[1] - a[1]);
        const allowed = new Set(ranked.slice(0, limit).map(([key]) => key));
        return data.filter((row) => {
            const key = row[filter.fieldId];
            return key != null && allowed.has(key);
        });
    }
    rankScore(row, filter) {
        if (filter.measureFieldId) {
            const value = Number(row[filter.measureFieldId]);
            return Number.isFinite(value) ? value : 0;
        }
        return 1;
    }
    matchesFilter(row, filter, fields) {
        const value = row[filter.fieldId];
        const field = fields.find((f) => f.id === filter.fieldId);
        switch (filter.type) {
            case "include":
                return filter.values?.includes(value) ?? true;
            case "exclude":
                return !(filter.values?.includes(value) ?? false);
            case "range": {
                const num = Number(value);
                if (!Number.isFinite(num))
                    return false;
                const { min, max } = filter.range ?? {};
                if (min !== undefined && num < min)
                    return false;
                if (max !== undefined && num > max)
                    return false;
                return true;
            }
            case "date_range": {
                const date = this.toDate(value, field);
                if (!date)
                    return false;
                const { from, to } = filter.dateRange ?? {};
                if (from && date < from)
                    return false;
                if (to && date > to)
                    return false;
                return true;
            }
            case "top_n":
            case "bottom_n":
                return true;
            default:
                return true;
        }
    }
    toDate(value, field) {
        if (value instanceof Date)
            return value;
        if (typeof value === "string" || typeof value === "number") {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? null : date;
        }
        if (field?.dataType === "date" && value != null) {
            const date = new Date(String(value));
            return Number.isNaN(date.getTime()) ? null : date;
        }
        return null;
    }
}
