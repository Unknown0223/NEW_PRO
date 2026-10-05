import * as XLSX from "xlsx";
import { listReportBuilderSaved, getReportBuilderSaved } from "../report-builder/report-builder.saved";
import { reportBuilderDataset, reportBuilderExportXlsx, reportBuilderPreview } from "../report-builder/report-builder.service";
import { REPORT_BUILDER_DATASET_ROW_CAP } from "../report-builder/report-builder.constants";
import { validateReportBuilderConfig, validateReportBuilderDatasetRequest } from "../report-builder/report-builder.validate";
import { tgChatAction, tgSendDocument } from "./tg-api";
import { hasPerm, type StaffIdentity } from "./tg-identity";
import { extractReportSpec, pivotAggregate, savedPeriod, withPeriod, type ReportSpec } from "./tg-report.pure";
import type { ChatCtx, View } from "./tg-screen";
import { L, t } from "./tg-text";
import { btn, cb, esc, fmtDate, grid, kb, num, pagerRow, periodRange } from "./tg-ui.pure";

const PAGE = 8;
const SUMMARY_ROWS = 12;

export const canViewReports = (id: StaffIdentity) => hasPerm(id, "reports.konstruktor.view");
export const canExportReports = (id: StaffIdentity) => hasPerm(id, "reports.konstruktor.export");

const actorOf = (id: StaffIdentity) => ({ userId: id.user.id, role: id.user.role });

export async function reportsList(ctx: ChatCtx, id: StaffIdentity, page: number): Promise<View> {
  const lang = ctx.lang;
  const all = await listReportBuilderSaved(id.tenantId, id.user.id);
  const home = [btn(t(lang, "home"), cb("m", "home"))];
  if (all.length === 0) {
    return {
      text: `📑 ${L(lang, "Saqlangan hisobotlar yo‘q. Ularni web-paneldagi «Конструктор отчетов» bo‘limida yarating.", "Сохранённых отчётов нет. Создайте их в «Конструкторе отчётов» веб-панели.")}`,
      kb: kb(home)
    };
  }
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const cur = Math.min(Math.max(1, page), pages);
  const slice = all.slice((cur - 1) * PAGE, cur * PAGE);
  return {
    text: `📑 <b>${L(lang, "Hisobotlar", "Отчёты")}</b> (${all.length})\n${L(lang, "Hisobotni tanlang:", "Выберите отчёт:")}`,
    kb: kb(...slice.map((r) => [btn(`📊 ${r.name.slice(0, 48)}`, cb("r", "o", r.id))]), pagerRow("r:list", cur, pages), home)
  };
}

async function loadSpec(id: StaffIdentity, reportId: number): Promise<{ name: string; spec: ReportSpec } | null> {
  const row = await getReportBuilderSaved(id.tenantId, id.user.id, reportId);
  if (!row) return null;
  const spec = extractReportSpec(row.config);
  return spec ? { name: row.name, spec } : null;
}

export async function reportPeriodView(ctx: ChatCtx, id: StaffIdentity, reportId: number): Promise<View> {
  const lang = ctx.lang;
  const r = await loadSpec(id, reportId);
  if (!r) return { text: t(lang, "noAccess"), kb: kb([btn(t(lang, "back"), cb("r", "list", 1))]) };
  const sv = savedPeriod(r.spec);
  const keys: Array<[string, string]> = [
    ["tm", t(lang, "pTm")],
    ["pm", t(lang, "pPm")],
    ["30", t(lang, "p30")],
    ["90", t(lang, "p90")],
    ["ty", t(lang, "pTy")]
  ];
  return {
    text: `📊 <b>${esc(r.name)}</b>\n\n${t(lang, "choosePeriod")}`,
    kb: kb(
      sv ? [btn(`💾 ${fmtDate(sv.from)} — ${fmtDate(sv.to)}`, cb("r", "v", reportId, "sv"), "primary")] : null,
      ...grid(keys.map(([k, label]) => btn(label, cb("r", "v", reportId, k))), 2),
      [btn(t(lang, "back"), cb("r", "list", 1))]
    )
  };
}

function resolvePeriod(spec: ReportSpec, key: string): { from: string; to: string } {
  if (key === "sv") return savedPeriod(spec) ?? periodRange("tm");
  return periodRange(key);
}

type Built = { header: string[]; rows: Array<Array<string | number>>; total: Array<string | number> | null; rowCount: number; truncated: boolean };

async function build(id: StaffIdentity, spec: ReportSpec): Promise<Built> {
  if (spec.kind === "legacy") {
    const v = validateReportBuilderConfig(spec.config);
    if (!v.ok) throw new Error(v.error);
    const res = await reportBuilderPreview(id.tenantId, v.config, actorOf(id));
    const header = res.columns;
    return {
      header,
      rows: res.rows.map((r) => header.map((c) => (typeof r[c] === "number" ? (r[c] as number) : String(r[c] ?? "")))),
      total: null,
      rowCount: res.totalRowCount,
      truncated: res.truncated
    };
  }
  const v = validateReportBuilderDatasetRequest({ ...spec.filters, pageLimit: REPORT_BUILDER_DATASET_ROW_CAP, pageOffset: 0 });
  if (!v.ok) throw new Error(v.error);
  const ds = await reportBuilderDataset(id.tenantId, v.filters, actorOf(id));
  const caption = new Map(ds.fields.map((f) => [f.uniqueName, f.caption]));
  const values = spec.values.length > 0 ? spec.values : ds.fields.filter((f) => f.uniqueName === "amount").map((f) => ({ field: f.uniqueName, agg: "SUM" as const }));
  const p = pivotAggregate(ds.rows, spec.rows, values);
  const valueHeaders = values.length > 0 ? values.map((x) => `${caption.get(x.field) ?? x.field}${x.agg !== "SUM" ? ` (${x.agg})` : ""}`) : ["Count"];
  return {
    header: [...spec.rows.map((f) => caption.get(f) ?? f), ...valueHeaders],
    rows: p.groups.map((g) => [...g.keys, ...g.values]),
    total: [...spec.rows.map((_, i) => (i === 0 ? "Итого" : "")), ...p.totals],
    rowCount: p.rowCount,
    truncated: ds.truncated
  };
}

const fmtCell = (v: string | number) => (typeof v === "number" ? num(v, Number.isInteger(v) ? 0 : 2) : esc(v));

export async function reportSummary(ctx: ChatCtx, id: StaffIdentity, reportId: number, periodKey: string): Promise<View> {
  const lang = ctx.lang;
  const back = [btn(t(lang, "back"), cb("r", "o", reportId)), btn(t(lang, "home"), cb("m", "home"))];
  const r = await loadSpec(id, reportId);
  if (!r) return { text: t(lang, "noAccess"), kb: kb(back) };
  const per = resolvePeriod(r.spec, periodKey);
  let b: Built;
  try {
    b = await build(id, withPeriod(r.spec, per.from, per.to));
  } catch {
    return { text: `⚠️ ${L(lang, "Hisobotni botda ochib bo‘lmadi. Web-paneldan foydalaning.", "Отчёт нельзя открыть в боте. Используйте веб-панель.")}`, kb: kb(back) };
  }
  const lines = [`📊 <b>${esc(r.name)}</b>`, `📅 ${fmtDate(per.from)} — ${fmtDate(per.to)}`, ""];
  if (b.rows.length === 0) lines.push(t(lang, "empty"));
  for (const row of b.rows.slice(0, SUMMARY_ROWS)) lines.push(`• ${row.map(fmtCell).join(" · ")}`);
  if (b.rows.length > SUMMARY_ROWS) lines.push(`… +${b.rows.length - SUMMARY_ROWS}`);
  if (b.total) lines.push("", `<b>${b.total.filter((x) => x !== "").map(fmtCell).join(" · ")}</b>`);
  if (b.truncated) lines.push("", `⚠️ ${L(lang, "Ma’lumot cheklovga yetdi — to‘liq natija web-panelda.", "Достигнут лимит строк — полный результат в веб-панели.")}`);
  return {
    text: lines.join("\n"),
    kb: kb(
      canExportReports(id) ? [btn(t(lang, "xlsx"), cb("r", "x", reportId, periodKey), "success")] : null,
      [btn(`📅 ${L(lang, "Davr", "Период")}`, cb("r", "o", reportId)), btn(t(lang, "refresh"), cb("r", "v", reportId, periodKey))],
      back
    )
  };
}

export async function sendReportXlsx(ctx: ChatCtx, id: StaffIdentity, reportId: number, periodKey: string): Promise<boolean> {
  if (!canExportReports(id)) return false;
  const r = await loadSpec(id, reportId);
  if (!r) return false;
  const per = resolvePeriod(r.spec, periodKey);
  const spec = withPeriod(r.spec, per.from, per.to);
  await tgChatAction(ctx.chatId, "upload_document");
  let buffer: Buffer;
  if (spec.kind === "legacy") {
    const v = validateReportBuilderConfig(spec.config, { exportMode: true });
    if (!v.ok) return false;
    buffer = (await reportBuilderExportXlsx(id.tenantId, v.config, actorOf(id))).buffer;
  } else {
    const b = await build(id, spec);
    const aoa = [b.header, ...b.rows, ...(b.total ? [b.total] : [])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "report");
    buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
  const safe = r.name.replace(/[^\p{L}\p{N}_\- ]+/gu, "").trim().slice(0, 60) || "report";
  await tgSendDocument(ctx.chatId, buffer, `${safe} ${per.from}_${per.to}.xlsx`, `📊 ${esc(r.name)}\n📅 ${fmtDate(per.from)} — ${fmtDate(per.to)}`);
  return true;
}
