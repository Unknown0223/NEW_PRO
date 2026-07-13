const GROUP_KEY_SEPARATOR = " | ";
const ALL_GROUP_KEY = "__all__";
/**
 * Ma'lumotlarni berilgan maydonlar bo'yicha guruhlaydi.
 * Bir nechta maydon bo'lsa, kalit `field1 | field2` formatida.
 */
export function groupBy(data, fields, options = {}) {
    const nullLabel = options.nullLabel ?? "N/A";
    const groups = new Map();
    if (fields.length === 0) {
        groups.set(ALL_GROUP_KEY, [...data]);
        return groups;
    }
    for (const row of data) {
        const key = fields.map((field) => String(row[field] ?? nullLabel)).join(GROUP_KEY_SEPARATOR);
        const bucket = groups.get(key);
        if (bucket) {
            bucket.push(row);
        }
        else {
            groups.set(key, [row]);
        }
    }
    return groups;
}
/**
 * Guruh kalitini alohida qismlarga ajratadi.
 */
export function splitGroupKey(key) {
    return key.split(GROUP_KEY_SEPARATOR);
}
/**
 * Guruh kalitining oxirgi qismini qaytaradi (ko'pincha qator nomi).
 */
export function lastGroupKeyPart(key) {
    const parts = splitGroupKey(key);
    return parts[parts.length - 1] ?? key;
}
export { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR };
