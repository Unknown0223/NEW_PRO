import fs from "node:fs";
import path from "node:path";

const src = "src";

function linesOf(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/);
}
function w(p, c) {
  fs.writeFileSync(p, c.endsWith("\n") ? c : `${c}\n`);
}

function fixRoute(rel, hdrEnd, readRange, writeRange, registerFn, readFn, writeFn) {
  const backup = path.join(src, rel.replace(".ts", ".backup.ts"));
  const lines = linesOf(backup);
  const hdr = lines.slice(0, hdrEnd).join("\n");
  const dir = path.dirname(path.join(src, rel));
  const base = path.basename(rel, ".route.ts");
  w(
    path.join(dir, `${base}.route.read.ts`),
    `${hdr}
export async function ${readFn}(app: FastifyInstance) {
${lines.slice(readRange[0] - 1, readRange[1]).join("\n")}
}
`
  );
  w(
    path.join(dir, `${base}.route.write.ts`),
    `${hdr}
export async function ${writeFn}(app: FastifyInstance) {
${lines.slice(writeRange[0] - 1, writeRange[1]).join("\n")}
}
`
  );
  w(
    path.join(src, rel),
    `import type { FastifyInstance } from "fastify";
import { ${readFn} } from "./${base}.route.read";
import { ${writeFn} } from "./${base}.route.write";

export async function ${registerFn}(app: FastifyInstance) {
  await ${readFn}(app);
  await ${writeFn}(app);
}
`
  );
}

fixRoute(
  "modules/work-slots/work-slots.route.ts",
  75,
  [80, 217],
  [219, 403],
  "registerWorkSlotRoutes",
  "registerWorkSlotListRoutes",
  "registerWorkSlotDetailRoutes"
);
fixRoute(
  "modules/stock/suppliers.route.ts",
  86,
  [88, 228],
  [230, 404],
  "registerSupplierRoutes",
  "registerSupplierCrudRoutes",
  "registerSupplierPaymentRoutes"
);
fixRoute(
  "modules/returns/sales-returns.route.ts",
  125,
  [127, 240],
  [241, 416],
  "registerSalesReturnRoutes",
  "registerSalesReturnReadRoutes",
  "registerSalesReturnWriteRoutes"
);

// payments write extra brace
{
  const p = path.join(src, "modules/payments/payments.route.write.ts");
  let t = fs.readFileSync(p, "utf8");
  if (t.trimEnd().endsWith("}\n}")) {
    t = t.replace(/\n}\s*}\s*$/, "\n}\n");
    fs.writeFileSync(p, t);
  }
}

console.log("phase67-fix-routes done");
