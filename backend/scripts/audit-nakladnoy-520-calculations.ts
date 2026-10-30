/**
 * Nakladnoy 5.2.0 hisob-kitob invariantlari (mock + merge mantiq).
 * Ishga tushirish: cd backend && npx tsx scripts/audit-nakladnoy-520-calculations.ts
 */
import {
  buildExpeditorLoading520Document,
  type ExpeditorLoading520Document
} from "../src/modules/orders/warehouse-templates/expeditor-loading-520-document";
import { buildWarehouseAggregateContext } from "../src/modules/orders/warehouse-templates/warehouse-template-shared";
import { getExpeditorLoadingLayoutDef } from "../src/modules/orders/warehouse-templates/expeditor-loading-template-ids";
import {
  buildMergedLoadingPayload,
  mergeLoadingLines
} from "../src/modules/orders/order-nakladnoy-xlsx.format";
import {
  DEFAULT_NAKLADNOY_BUILD_OPTIONS,
  type NakladnoyLine,
  type NakladnoyOrderPayload
} from "../src/modules/orders/order-nakladnoy-xlsx.types";

function assert(cond: boolean, msg: string, issues: string[]) {
  if (!cond) issues.push(msg);
}

function sumFromDoc(doc: ExpeditorLoading520Document) {
  let qty = 0;
  let bonus = 0;
  let sum = 0;
  for (const g of doc.groups) {
    for (const ln of g.lines) {
      qty += ln.qty ?? 0;
      bonus += ln.bonus ?? 0;
    }
    let gSum = 0;
    for (const ln of g.lines) {
      const n = Number(ln.sum.replace(/\s/g, "").replace(/,/g, ""));
      if (Number.isFinite(n)) gSum += n;
    }
    sum += gSum;
  }
  return { qty, bonus, sum };
}

function parseMoney(s: string): number {
  return Number(s.replace(/\s/g, "").replace(/,/g, ".")) || 0;
}

function auditDoc(doc: ExpeditorLoading520Document, label: string, issues: string[]) {
  const fromLines = sumFromDoc(doc);
  assert(doc.totals.qty === fromLines.qty, `${label}: totals.qty ${doc.totals.qty} !== lines ${fromLines.qty}`, issues);
  assert(
    doc.totals.bonus === fromLines.bonus,
    `${label}: totals.bonus ${doc.totals.bonus} !== lines ${fromLines.bonus}`,
    issues
  );

  let grandSum = 0;
  for (const g of doc.groups) {
    let gQty = 0;
    let gBonus = 0;
    let gSum = 0;
    for (const ln of g.lines) {
      gQty += ln.qty ?? 0;
      gBonus += ln.bonus ?? 0;
      gSum += parseMoney(ln.sum);
    }
    assert(g.qty === gQty, `${label} group "${g.name}" qty`, issues);
    assert(g.bonus === gBonus, `${label} group "${g.name}" bonus`, issues);
    assert(
      parseMoney(g.sum) === gSum,
      `${label} group "${g.name}" sum ${g.sum} vs ${gSum}`,
      issues
    );
    grandSum += gSum;
  }
  assert(
    parseMoney(doc.totals.sum) === grandSum,
    `${label}: totals.sum ${doc.totals.sum} vs groups ${grandSum}`,
    issues
  );
}

function makeOrder(
  id: number,
  lines: NakladnoyLine[],
  extra?: Partial<NakladnoyOrderPayload>
): NakladnoyOrderPayload {
  return {
    id,
    number: `ORD-${id}`,
    createdAt: new Date(`2026-05-${String(20 + id).padStart(2, "0")}`),
    tenantName: "T",
    tenantPhone: null,
    clientName: `Client ${id}`,
    clientPhone: null,
    clientBalanceNum: null,
    clientAddress: "—",
    clientLandmark: null,
    orderComment: null,
    discountSum: 0,
    currencyLabel: "So'm (UZS)",
    agentLine: `A${id} - [Agent] 20/05/26`,
    invoiceAgentLine: `A${id} [Agent] TOSHKENT 20.05.2026 (99890100000)`,
    agentName: "Agent",
    agentPhone: "99890100000",
    expeditorLine: id % 2 === 0 ? "[T1] Exp One" : "[T2] Exp Two",
    expeditorName: id % 2 === 0 ? "Exp One" : "Exp Two",
    expeditorPhone: null,
    territory: id % 2 === 0 ? "TOSHKENT" : "SAMARQAND",
    invoiceTerritory: id % 2 === 0 ? "TOSHKENT" : "SAMARQAND",
    warehouseName: "Склад",
    agentId: id,
    expeditorUserId: id % 2 === 0 ? 1 : 2,
    isConsignment: false,
    paymentMethodRef: "cash",
    orderType: "order",
    lines,
    paidLines: [],
    bonusLines: [],
    ...extra
  };
}

function line(
  productId: number,
  sku: string,
  name: string,
  qty: number,
  bonusQty: number,
  price: number,
  sum: number,
  groupTitle: string
): NakladnoyLine {
  return {
    productId,
    sku,
    barcode: null,
    name,
    qty,
    bonusQty,
    price,
    sum,
    groupTitle,
    qtyPerBlock: null
  };
}

function main() {
  const issues: string[] = [];
  const opts = DEFAULT_NAKLADNOY_BUILD_OPTIONS;
  const def = getExpeditorLoadingLayoutDef("ex-5.2.0");

  // 1) Bitta zakaz — bonus paid qatorga biriktirilgan
  const o1 = makeOrder(1, [
    line(1, "SKU-1", "Cola", 10, 2, 1000, 10000, "Ichimliklar"),
    line(2, "SKU-2", "Water", 5, 0, 500, 2500, "Ichimliklar")
  ]);
  const ctx1 = buildWarehouseAggregateContext([o1], opts);
  const doc1 = buildExpeditorLoading520Document(ctx1, opts, def.versionLabel);
  auditDoc(doc1, "single-order", issues);
  assert(doc1.totals.qty === 15, "single qty=15", issues);
  assert(doc1.totals.bonus === 2, "single bonus=2", issues);
  assert(parseMoney(doc1.totals.sum) === 12500, "single sum=12500", issues);

  // 2) Ikki zakaz — mergeLoadingLines bir xil mahsulotni yig‘adi
  const o2a = makeOrder(2, [line(1, "SKU-1", "Cola", 10, 0, 1000, 10000, "Ichimliklar")]);
  const o2b = makeOrder(3, [line(1, "SKU-1", "Cola", 5, 1, 1200, 6000, "Ichimliklar")]);
  const merged = buildMergedLoadingPayload([o2a, o2b], "Все_2");
  const mergedLines = mergeLoadingLines(merged.lines);
  assert(mergedLines.length === 1, "merge one sku", issues);
  assert(mergedLines[0]!.qty === 15, "merged qty 15", issues);
  assert(mergedLines[0]!.bonusQty === 1, "merged bonus 1", issues);
  assert(mergedLines[0]!.sum === 16000, "merged sum 16000", issues);
  assert(mergedLines[0]!.price === Math.round(16000 / 15), "merged avg price", issues);

  const ctx2 = buildWarehouseAggregateContext([o2a, o2b], opts);
  const doc2 = buildExpeditorLoading520Document(ctx2, opts, def.versionLabel);
  auditDoc(doc2, "two-orders", issues);
  assert(doc2.meta.dateShip !== null, "multi-order dateShip set", issues);

  // 3) Faqat bonus qatori (qty=0, bonus>0)
  const o3 = makeOrder(4, [line(9, "SKU-B", "Gift", 0, 3, 0, 0, "Bonus")]);
  const doc3 = buildExpeditorLoading520Document(
    buildWarehouseAggregateContext([o3], opts),
    opts,
    def.versionLabel
  );
  assert(doc3.totals.bonus === 3, "bonus-only bonus total", issues);
  assert(parseMoney(doc3.totals.sum) === 0, "bonus-only sum 0", issues);
  assert(doc3.groups[0]!.lines[0]!.qty === 0, "bonus-only qty empty in doc", issues);

  // 4) Возврат с полки — alohida guruh, tovar guruhlaridan keyin
  const sale = makeOrder(5, [line(1, "T-0108", "Monno N3", 10, 0, 72000, 720000, "Monno trusik mini")]);
  const ret = makeOrder(6, [line(1, "T-0108", "Monno N3", 4, 4, 72000, 288000, "Возврат с полки")], {
    orderType: "return"
  });
  const doc4 = buildExpeditorLoading520Document(
    buildWarehouseAggregateContext([sale, ret], opts),
    opts,
    def.versionLabel
  );
  const names = doc4.groups.map((g) => g.name);
  assert(names.includes("Возврат с полки"), "shelf-return group present", issues);
  assert(names[names.length - 1] === "Возврат с полки", "shelf-return group last", issues);
  const retGroup = doc4.groups.find((g) => g.name === "Возврат с полки");
  assert(retGroup?.qty === 4, "shelf-return qty", issues);
  assert(retGroup?.bonus === 4, "shelf-return bonus", issues);
  assert(doc4.shelfReturnOnly === false, "mixed sheet is not return-only", issues);

  const docRetOnly = buildExpeditorLoading520Document(
    buildWarehouseAggregateContext([ret], opts),
    opts,
    def.versionLabel
  );
  assert(docRetOnly.shelfReturnOnly === true, "return-only sheet", issues);
  assert(docRetOnly.groups.length === 1, "return-only one group", issues);
  assert(docRetOnly.groups[0]!.name === "Возврат с полки", "return-only group name", issues);

  const ok = issues.length === 0;
  console.log(JSON.stringify({ ok, issueCount: issues.length, issues }, null, 2));
  if (!ok) process.exit(1);
}

main();
