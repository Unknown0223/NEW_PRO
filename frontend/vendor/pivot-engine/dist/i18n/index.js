import { ru } from "./ru.js";
import { uz } from "./uz.js";
const LOCALES = { ru, uz };
let currentLocale = "ru";
/** Joriy pivot UI tili (default: ru). */
export function getPivotLocale() {
    return currentLocale;
}
export function setPivotLocale(locale) {
    currentLocale = locale;
}
/** Joriy til uchun barcha UI matnlari. */
export function getPivotStrings() {
    return LOCALES[currentLocale];
}
export function getAggregationLabel(aggregation) {
    return getPivotStrings().aggregations[aggregation];
}
