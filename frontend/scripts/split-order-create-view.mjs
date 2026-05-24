#!/usr/bin/env node
import fs, { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const viewDir = path.join(root, "components/orders/order-create/view");
const monolithPath = path.join(viewDir, "order-create-view.monolith.tsx");
const lines = readFileSync(monolithPath, "utf8").split(/\r?\n/);

const hooksDir = path.join(root, "components/orders/order-create/hooks");
const vmKeys = [];
for (const name of fs.readdirSync(hooksDir)) {
  if (!name.startsWith("use-order-create") || !name.endsWith(".ts")) continue;
  const src = readFileSync(path.join(hooksDir, name), "utf8");
  for (const m of src.matchAll(/^\s{4}(\w+),$/gm)) vmKeys.push(m[1]);
}
const vmKeysUnique = [...new Set(vmKeys)];
const importBlock = lines.slice(0, 44).join("\n");

const slices = [
  { file: "order-create-view-header.tsx", name: "OrderCreateViewHeader", start: 245, end: 337 },
  { file: "order-create-view-alerts.tsx", name: "OrderCreateViewAlerts", start: 345, end: 432, wrap: true },
  { file: "order-create-standard-params.a.tsx", name: "OrderCreateStandardParamsA", start: 441, end: 631, wrap: true },
  { file: "order-create-standard-params.b.tsx", name: "OrderCreateStandardParamsB", start: 632, end: 831, wrap: true },
  { file: "order-create-polki-params.a.tsx", name: "OrderCreatePolkiParamsA", start: 834, end: 1025, wrap: true },
  { file: "order-create-polki-params.b.tsx", name: "OrderCreatePolkiParamsB", start: 1026, end: 1203, wrap: true },
  { file: "order-create-order-refs.tsx", name: "OrderCreateOrderRefs", start: 1206, end: 1342, wrap: true },
  { file: "order-create-client-summary.tsx", name: "OrderCreateClientSummary", start: 1344, end: 1391, wrap: true },
  { file: "order-create-lines-intro.tsx", name: "OrderCreateLinesIntro", start: 1394, end: 1561, wrap: true },
  { file: "order-create-exchange-block.tsx", name: "OrderCreateExchangeBlock", start: 1563, end: 1585, wrap: true },
  { file: "order-create-catalog-chrome.tsx", name: "OrderCreateCatalogChrome", start: 1587, end: 1645, wrap: true },
  { file: "order-create-catalog-table.a.tsx", name: "OrderCreateCatalogTableA", start: 1647, end: 1835, wrap: true },
  { file: "order-create-catalog-table.b.tsx", name: "OrderCreateCatalogTableB", start: 1836, end: 2012, wrap: true },
  { file: "order-create-lines-footer-note.tsx", name: "OrderCreateLinesFooterNote", start: 2014, end: 2047, wrap: true },
  { file: "order-create-view-footer.tsx", name: "OrderCreateViewFooter", start: 2051, end: 2083, wrap: true }
];

function usedKeys(text) {
  return vmKeysUnique.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text));
}

function emitSection(s) {
  const body = lines.slice(s.start - 1, s.end).join("\n");
  const keys = usedKeys(body);
  const destructure = `  const {\n${keys.map((k) => `    ${k},`).join("\n")}\n  } = vm;\n\n`;
  const inner = s.wrap ? `  return (\n    <>\n${body}\n    </>\n  );` : `  return (\n${body}\n  );`;
  writeFileSync(
    path.join(viewDir, s.file),
    `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";

export function ${s.name}({ vm }: { vm: OrderCreateVm }) {
${destructure}${inner}
}
`
  );
  const n = readFileSync(path.join(viewDir, s.file), "utf8").split(/\n/).length;
  console.log(`${s.file}\t${n}\tkeys:${keys.length}`);
}

mkdirSync(viewDir, { recursive: true });
for (const s of slices) emitSection(s);

const barrel = (file, name, parts) => `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";
${parts.map((p) => `import { ${p.name} } from "./${p.file.replace(".tsx", "")}";`).join("\n")}

export function ${name}({ vm }: { vm: OrderCreateVm }) {
  return (
    <>
${parts.map((p) => `      <${p.name} vm={vm} />`).join("\n")}
    </>
  );
}
`;

writeFileSync(
  path.join(viewDir, "order-create-standard-params.tsx"),
  barrel("order-create-standard-params.tsx", "OrderCreateStandardParams", [
    { file: "order-create-standard-params.a.tsx", name: "OrderCreateStandardParamsA" },
    { file: "order-create-standard-params.b.tsx", name: "OrderCreateStandardParamsB" }
  ])
);
writeFileSync(
  path.join(viewDir, "order-create-polki-params.tsx"),
  barrel("order-create-polki-params.tsx", "OrderCreatePolkiParams", [
    { file: "order-create-polki-params.a.tsx", name: "OrderCreatePolkiParamsA" },
    { file: "order-create-polki-params.b.tsx", name: "OrderCreatePolkiParamsB" }
  ])
);
writeFileSync(
  path.join(viewDir, "order-create-catalog-table.tsx"),
  barrel("order-create-catalog-table.tsx", "OrderCreateCatalogTable", [
    { file: "order-create-catalog-table.a.tsx", name: "OrderCreateCatalogTableA" },
    { file: "order-create-catalog-table.b.tsx", name: "OrderCreateCatalogTableB" }
  ])
);

writeFileSync(
  path.join(viewDir, "order-create-lines-section.tsx"),
  `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";
import { OrderCreateLinesIntro } from "./order-create-lines-intro";
import { OrderCreateExchangeBlock } from "./order-create-exchange-block";
import { OrderCreateCatalogChrome } from "./order-create-catalog-chrome";
import { OrderCreateCatalogTable } from "./order-create-catalog-table";
import { OrderCreateLinesFooterNote } from "./order-create-lines-footer-note";

export function OrderCreateLinesSection({ vm }: { vm: OrderCreateVm }) {
  return (
    <>
      <OrderCreateLinesIntro vm={vm} />
      <OrderCreateExchangeBlock vm={vm} />
      <OrderCreateCatalogChrome vm={vm} />
      <OrderCreateCatalogTable vm={vm} />
      <OrderCreateLinesFooterNote vm={vm} />
    </>
  );
}
`
);

writeFileSync(
  path.join(viewDir, "order-create-view.tsx"),
  `${importBlock}
import type { OrderCreateVm } from "../hooks/use-order-create";
import { OrderCreateViewHeader } from "./order-create-view-header";
import { OrderCreateViewAlerts } from "./order-create-view-alerts";
import { OrderCreateStandardParams } from "./order-create-standard-params";
import { OrderCreatePolkiParams } from "./order-create-polki-params";
import { OrderCreateOrderRefs } from "./order-create-order-refs";
import { OrderCreateClientSummary } from "./order-create-client-summary";
import { OrderCreateLinesSection } from "./order-create-lines-section";
import { OrderCreateViewFooter } from "./order-create-view-footer";

export function OrderCreateView({ vm }: { vm: OrderCreateVm }) {
  const {
    isPolkiSheet,
    isPolkiFree,
    polkiRangeOpen,
    setPolkiRangeOpen,
    polkiRangeAnchorRef,
    polkiDateFrom,
    polkiDateTo,
    setPolkiDateFrom,
    setPolkiDateTo
  } = vm;

  return (
    <PageShell>
      <OrderCreateViewHeader vm={vm} />

      <div
        className={cn(
          "flex w-full min-w-0 flex-col",
          isPolkiSheet ? "gap-4 pb-24" : "gap-6 pb-32"
        )}
      >
        <OrderCreateViewAlerts vm={vm} />

        <section
          className={cn(
            "rounded-xl border bg-card p-4 shadow-sm sm:p-5 lg:p-6",
            isPolkiSheet && "border-teal-800/20 dark:border-teal-800/35"
          )}
        >
          {!isPolkiSheet ? <OrderCreateStandardParams vm={vm} /> : <OrderCreatePolkiParams vm={vm} />}
          <OrderCreateOrderRefs vm={vm} />
          <OrderCreateClientSummary vm={vm} />
        </section>

        <OrderCreateLinesSection vm={vm} />
      </div>

      <OrderCreateViewFooter vm={vm} />

      {isPolkiFree ? (
        <DateRangePopover
          open={polkiRangeOpen}
          onOpenChange={setPolkiRangeOpen}
          anchorRef={polkiRangeAnchorRef}
          dateFrom={polkiDateFrom}
          dateTo={polkiDateTo}
          onApply={({ dateFrom, dateTo }) => {
            setPolkiDateFrom(dateFrom);
            setPolkiDateTo(dateTo);
          }}
        />
      ) : null}
    </PageShell>
  );
}
`
);

console.log("done");

