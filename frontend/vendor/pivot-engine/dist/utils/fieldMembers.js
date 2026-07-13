/** Maydon uchun noyob qiymatlar ro'yxati (filtr UI uchun). */
export function getFieldMembers(data, fieldId) {
    const seen = new Set();
    const members = [];
    for (const row of data) {
        const raw = row[fieldId];
        if (raw == null || raw === "")
            continue;
        const key = String(raw);
        if (seen.has(key))
            continue;
        seen.add(key);
        members.push(typeof raw === "number" ? raw : key);
    }
    return members.sort((a, b) => String(a).localeCompare(String(b), "uz"));
}
/** Pivot jadvalidagi yoyiladigan qator kalitlari. */
export function collectExpandableRowKeys(rows) {
    const keys = [];
    for (const row of rows) {
        if (row.children?.length) {
            keys.push(row.key);
            keys.push(...collectExpandableRowKeys(row.children));
        }
    }
    return keys;
}
