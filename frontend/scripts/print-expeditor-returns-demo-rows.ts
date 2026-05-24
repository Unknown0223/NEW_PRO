/**
 * Konsolda demo qatorlarni JSON chiqaradi (ustunlarni tekshirish / diff uchun).
 * Ishga tushirish: npm run report:expeditor-demo-print
 */
import {
  DEMO_EXPEDITOR_CLIENT_ROWS,
  DEMO_EXPEDITOR_ORDER_ROWS,
  DEMO_EXPEDITOR_PRODUCT_ROWS
} from "../lib/reports/expeditor-returns-demo-rows";

console.log("=== orders (По заказам) ===");
console.log(JSON.stringify(DEMO_EXPEDITOR_ORDER_ROWS, null, 2));
console.log("\n=== products (По товарам) ===");
console.log(JSON.stringify(DEMO_EXPEDITOR_PRODUCT_ROWS, null, 2));
console.log("\n=== clients (По клиентам) ===");
console.log(JSON.stringify(DEMO_EXPEDITOR_CLIENT_ROWS, null, 2));
