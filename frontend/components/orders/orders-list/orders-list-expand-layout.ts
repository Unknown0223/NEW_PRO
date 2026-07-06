/**
 * =============================================================================
 * CURSOR / AI AGENT — DO NOT MODIFY THIS FILE OR ITS CONSUMERS WITHOUT EXPLICIT
 * USER REQUEST.
 *
 * Заявки: ochiladigan mahsulot paneli layouti.
 *
 * Muammo: asosiy jadval `min-w-[3200px]` + `overflow-x-auto` ichida `colSpan`
 * qatori butun jadval kengligiga (3200px) cho‘ziladi. Panel `w-full` bo‘lsa,
 * foydalanuvchi zakazni ochganda sahifa gorizontal scroll rejimiga «silib»
 * ketadi (scrollLeft o‘zgaradi, panel chap chetdan ko‘rinmay qoladi).
 *
 * Yechim (qatiy):
 * 1. Scroll konteyner `clientWidth` → panelga aniq `width` / `maxWidth`.
 * 2. Panel `position: sticky; left: 0` — faqat ko‘rinadigan oyna kengligi.
 * 3. Expand/collapse paytida `scrollLeft` saqlanadi.
 * 4. `animate-orders-expand` faqat `translateY` (globals.css) — `translateX` taqiqlangan.
 *
 * O‘zgartirish kerak bo‘lsa — avval foydalanuvchidan tasdiq oling.
 * =============================================================================
 */

/** globals.css dagi `.orders-list-expanded-panel` bilan bir xil bo‘lishi shart. */
export const ORDERS_LIST_EXPANDED_PANEL_CLASS = "orders-list-expanded-panel";
