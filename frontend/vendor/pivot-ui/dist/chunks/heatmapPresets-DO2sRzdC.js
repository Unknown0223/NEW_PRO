import { jsxs as g, jsx as e } from "react/jsx-runtime";
import { useState as I, useMemo as j, useEffect as oe, useRef as se, forwardRef as Ke, useCallback as _ } from "react";
import { getPivotStrings as z, getCalculatedMeasurePresets as Be, getFieldMembers as Ue, pivotChartDataToRechartsRows as je, exportRawRecordsToExcel as Ge, flattenPivotDisplayRows as Xe, getConditionalFormatStyle as me, PivotEngine as Ze, DEFAULT_PIVOT_CONFIG as Ie, createPivotWorkerClient as qe, DEFAULT_WORKER_THRESHOLD as Qe, isEmptyPivotConfig as Ye, createDefaultPivotConfig as Je, collectExpandableRowKeys as et, calculatedMeasuresToFields as tt, CALCULATED_MEASURE_PRESETS as rt, formatExportProgressLabel as nt, exportPivotToExcel as lt, exportPivotToPdf as ot, exportPivotToHtml as st, exportChartElementToPng as at, exportPivotToCsv as it, setPivotLocale as ct, pivotToChartData as dt, hasChartableData as ut, shouldConfirmLargeExport as mt, countPivotExportRows as ht, getExportWarnings as pt, getChartWarnings as bt } from "@salec/pivot-engine";
import { pointerWithin as ft, rectIntersection as gt, closestCenter as xt, useSensors as vt, useSensor as wt, PointerSensor as yt, DndContext as Nt, DragOverlay as Ct, useDraggable as kt, useDroppable as Tt } from "@dnd-kit/core";
import { SortableContext as he, verticalListSortingStrategy as pe, arrayMove as _e, useSortable as Me } from "@dnd-kit/sortable";
import { CSS as Ae } from "@dnd-kit/utilities";
import { GripVertical as ke, Filter as It, X as Te, FileSpreadsheet as $e, ChevronDown as _t, ChevronRight as Et, FileText as Ee, FileCode as Ft, FileImage as St, Minimize2 as zt, Maximize2 as Rt, ChevronsUpDown as Pt, ChevronsDownUp as Dt, RotateCcw as Lt, Loader2 as Ot } from "lucide-react";
import { clsx as Mt } from "clsx";
import { twMerge as At } from "tailwind-merge";
import { ResponsiveContainer as $t, PieChart as Vt, Tooltip as xe, Legend as ve, Pie as Ht, Cell as Wt, LineChart as Kt, CartesianGrid as Fe, XAxis as Se, YAxis as ze, Line as Bt, BarChart as Ut, Bar as jt } from "recharts";
import { useVirtualizer as Gt } from "@tanstack/react-virtual";
function Xt({ fieldLabel: t, members: r, filter: n, onApply: o, onClose: l, onTopN: i }) {
  const c = z().filters, [m, h] = I(
    (n == null ? void 0 : n.type) === "exclude" ? "exclude" : "include"
  ), [v, u] = I(""), [x, d] = I(
    () => {
      var s;
      return new Set(((s = n == null ? void 0 : n.values) == null ? void 0 : s.map(String)) ?? []);
    }
  ), p = j(() => {
    const s = v.trim().toLowerCase();
    return s ? r.filter((y) => String(y).toLowerCase().includes(s)) : r;
  }, [r, v]);
  return /* @__PURE__ */ g("div", { className: "w-64 space-y-2 rounded-md border bg-white p-3 shadow-lg", children: [
    /* @__PURE__ */ e("div", { className: "text-xs font-semibold", children: t }),
    /* @__PURE__ */ g("div", { className: "flex gap-1", children: [
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `h-7 flex-1 rounded text-[10px] ${m === "include" ? "bg-zinc-900 text-white" : "border"}`,
          onClick: () => h("include"),
          children: c.selected
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `h-7 flex-1 rounded text-[10px] ${m === "exclude" ? "bg-zinc-900 text-white" : "border"}`,
          onClick: () => h("exclude"),
          children: c.exclude
        }
      )
    ] }),
    /* @__PURE__ */ e(
      "input",
      {
        value: v,
        onChange: (s) => u(s.target.value),
        placeholder: c.search,
        className: "h-8 w-full rounded border px-2 text-xs"
      }
    ),
    /* @__PURE__ */ e("div", { className: "max-h-40 overflow-y-auto text-xs", children: p.map((s) => {
      const y = String(s), E = x.has(y);
      return /* @__PURE__ */ g("label", { className: "flex cursor-pointer items-center gap-2 py-0.5", children: [
        /* @__PURE__ */ e(
          "input",
          {
            type: "checkbox",
            checked: E,
            onChange: () => d((D) => {
              const N = new Set(D);
              return N.has(y) ? N.delete(y) : N.add(y), N;
            })
          }
        ),
        y
      ] }, y);
    }) }),
    /* @__PURE__ */ g("div", { className: "flex justify-between gap-1 border-t pt-2", children: [
      i && /* @__PURE__ */ e("button", { type: "button", className: "rounded border px-2 py-1 text-xs", onClick: i, children: c.topN }),
      /* @__PURE__ */ g("div", { className: "ml-auto flex gap-1", children: [
        /* @__PURE__ */ e("button", { type: "button", className: "rounded px-2 py-1 text-xs", onClick: l, children: c.cancel }),
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: "rounded bg-zinc-900 px-2 py-1 text-xs text-white",
            onClick: () => {
              if (x.size === 0) o(null);
              else {
                const s = r.filter((y) => x.has(String(y)));
                o({ fieldId: (n == null ? void 0 : n.fieldId) ?? "", type: m, values: s });
              }
              l();
            },
            children: c.apply
          }
        )
      ] })
    ] })
  ] });
}
function Zt({ fieldLabel: t, fieldId: r, filter: n, onApply: o, onClose: l }) {
  var u, x, d, p;
  const i = z().filters, [c, m] = I(((x = (u = n == null ? void 0 : n.dateRange) == null ? void 0 : u.from) == null ? void 0 : x.toISOString().slice(0, 10)) ?? ""), [h, v] = I(((p = (d = n == null ? void 0 : n.dateRange) == null ? void 0 : d.to) == null ? void 0 : p.toISOString().slice(0, 10)) ?? "");
  return /* @__PURE__ */ g("div", { className: "w-56 space-y-2 rounded-md border bg-white p-3 shadow-lg", children: [
    /* @__PURE__ */ e("div", { className: "text-xs font-semibold", children: t }),
    /* @__PURE__ */ g("label", { className: "block text-xs", children: [
      i.from,
      /* @__PURE__ */ e("input", { type: "date", value: c, onChange: (s) => m(s.target.value), className: "mt-1 h-8 w-full rounded border px-2" })
    ] }),
    /* @__PURE__ */ g("label", { className: "block text-xs", children: [
      i.to,
      /* @__PURE__ */ e("input", { type: "date", value: h, onChange: (s) => v(s.target.value), className: "mt-1 h-8 w-full rounded border px-2" })
    ] }),
    /* @__PURE__ */ g("div", { className: "flex justify-end gap-1 border-t pt-2", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "text-xs", onClick: l, children: i.cancel }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: "rounded bg-zinc-900 px-2 py-1 text-xs text-white",
          onClick: () => {
            o(!c && !h ? null : {
              fieldId: r,
              type: "date_range",
              dateRange: {
                from: c ? /* @__PURE__ */ new Date(`${c}T00:00:00`) : void 0,
                to: h ? /* @__PURE__ */ new Date(`${h}T23:59:59`) : void 0
              }
            }), l();
          },
          children: i.apply
        }
      )
    ] })
  ] });
}
function qt({ fieldLabel: t, fieldId: r, filter: n, onApply: o, onClose: l }) {
  var u, x, d, p;
  const i = z().filters, [c, m] = I(((x = (u = n == null ? void 0 : n.range) == null ? void 0 : u.min) == null ? void 0 : x.toString()) ?? ""), [h, v] = I(((p = (d = n == null ? void 0 : n.range) == null ? void 0 : d.max) == null ? void 0 : p.toString()) ?? "");
  return /* @__PURE__ */ g("div", { className: "w-52 space-y-2 rounded-md border bg-white p-3 shadow-lg", children: [
    /* @__PURE__ */ e("div", { className: "text-xs font-semibold", children: t }),
    /* @__PURE__ */ g("label", { className: "block text-xs", children: [
      i.min,
      /* @__PURE__ */ e("input", { type: "number", value: c, onChange: (s) => m(s.target.value), className: "mt-1 h-8 w-full rounded border px-2" })
    ] }),
    /* @__PURE__ */ g("label", { className: "block text-xs", children: [
      i.max,
      /* @__PURE__ */ e("input", { type: "number", value: h, onChange: (s) => v(s.target.value), className: "mt-1 h-8 w-full rounded border px-2" })
    ] }),
    /* @__PURE__ */ g("div", { className: "flex justify-end gap-1 border-t pt-2", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "text-xs", onClick: l, children: i.cancel }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: "rounded bg-zinc-900 px-2 py-1 text-xs text-white",
          onClick: () => {
            o(!c && !h ? null : {
              fieldId: r,
              type: "range",
              range: {
                min: c ? Number(c) : void 0,
                max: h ? Number(h) : void 0
              }
            }), l();
          },
          children: i.apply
        }
      )
    ] })
  ] });
}
function Qt({ field: t, measureFields: r, filter: n, onApply: o, onClose: l }) {
  const i = z().filters, [c, m] = I(
    (n == null ? void 0 : n.type) === "bottom_n" ? "bottom_n" : "top_n"
  ), [h, v] = I(String((n == null ? void 0 : n.topN) ?? 5)), [u, x] = I((n == null ? void 0 : n.measureFieldId) ?? ""), d = (s) => `h-7 flex-1 rounded-md border px-2 text-[10px] ${s ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"}`;
  function p() {
    const s = Number(h);
    if (!Number.isFinite(s) || s <= 0) {
      o(null), l();
      return;
    }
    o({
      fieldId: t.id,
      type: c,
      topN: Math.floor(s),
      ...u ? { measureFieldId: u } : {}
    }), l();
  }
  return /* @__PURE__ */ g("div", { className: "w-64 space-y-2 rounded-md border border-zinc-200 bg-white p-3 shadow-md", children: [
    /* @__PURE__ */ g("div", { className: "text-xs font-semibold", children: [
      t.label,
      " — ",
      i.topN
    ] }),
    /* @__PURE__ */ g("div", { className: "flex gap-1", children: [
      /* @__PURE__ */ e("button", { type: "button", className: d(c === "top_n"), onClick: () => m("top_n"), children: i.topHighest }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: d(c === "bottom_n"),
          onClick: () => m("bottom_n"),
          children: i.topLowest
        }
      )
    ] }),
    /* @__PURE__ */ g("div", { className: "space-y-1", children: [
      /* @__PURE__ */ e("label", { className: "text-[10px] text-zinc-500", children: i.nValue }),
      /* @__PURE__ */ e(
        "input",
        {
          type: "number",
          min: 1,
          value: h,
          onChange: (s) => v(s.target.value),
          className: "h-8 w-full rounded-md border border-zinc-300 px-2 text-xs"
        }
      )
    ] }),
    r.length > 0 && /* @__PURE__ */ g("div", { className: "space-y-1", children: [
      /* @__PURE__ */ e("label", { className: "text-[10px] text-zinc-500", children: i.metricOptional }),
      /* @__PURE__ */ g(
        "select",
        {
          value: u,
          onChange: (s) => x(s.target.value),
          className: "h-8 w-full rounded-md border border-zinc-300 px-2 text-xs",
          children: [
            /* @__PURE__ */ e("option", { value: "", children: i.rowCount }),
            r.map((s) => /* @__PURE__ */ e("option", { value: s.id, children: s.label }, s.id))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ g("div", { className: "flex justify-end gap-1 border-t border-zinc-200 pt-2", children: [
      /* @__PURE__ */ e("button", { type: "button", className: "h-7 px-2 text-xs text-zinc-600", onClick: l, children: i.cancel }),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: "h-7 rounded-md bg-zinc-900 px-2 text-xs text-white",
          onClick: p,
          children: i.apply
        }
      )
    ] })
  ] });
}
function Yt({ field: t, members: r, allFields: n, filter: o, onApply: l, onClose: i }) {
  const [c, m] = I(
    (o == null ? void 0 : o.type) === "top_n" || (o == null ? void 0 : o.type) === "bottom_n" ? "topn" : "default"
  );
  return c === "topn" ? /* @__PURE__ */ e(
    Qt,
    {
      field: t,
      measureFields: n.filter(
        (h) => h.dataType === "number" || h.dataType === "currency"
      ),
      filter: o,
      onApply: l,
      onClose: () => {
        (o == null ? void 0 : o.type) === "top_n" || (o == null ? void 0 : o.type) === "bottom_n" ? i() : m("default");
      }
    }
  ) : t.dataType === "date" ? /* @__PURE__ */ e(
    Zt,
    {
      fieldLabel: t.label,
      fieldId: t.id,
      filter: o,
      onApply: l,
      onClose: i
    }
  ) : t.dataType === "number" || t.dataType === "currency" ? /* @__PURE__ */ e(
    qt,
    {
      fieldLabel: t.label,
      fieldId: t.id,
      filter: o,
      onApply: l,
      onClose: i
    }
  ) : /* @__PURE__ */ e(
    Xt,
    {
      fieldLabel: t.label,
      members: r,
      filter: o ? { ...o, fieldId: t.id } : { fieldId: t.id, type: "include", values: [] },
      onApply: (h) => l(h ? { ...h, fieldId: t.id } : null),
      onClose: i,
      onTopN: () => m("topn")
    }
  );
}
const Jt = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
function er(t, r) {
  oe(() => {
    if (!t) return;
    const n = r.current;
    if (!n) return;
    const o = document.activeElement, l = () => Array.from(n.querySelectorAll(Jt)).filter(
      (m) => !m.hasAttribute("disabled") && m.tabIndex !== -1 && m.offsetParent !== null
    ), i = l()[0];
    i == null || i.focus();
    const c = (m) => {
      if (m.key !== "Tab") return;
      const h = l();
      if (h.length === 0) {
        m.preventDefault();
        return;
      }
      const v = h[0], u = h[h.length - 1];
      m.shiftKey ? (document.activeElement === v || !n.contains(document.activeElement)) && (m.preventDefault(), u.focus()) : document.activeElement === u && (m.preventDefault(), v.focus());
    };
    return document.addEventListener("keydown", c), () => {
      var m;
      document.removeEventListener("keydown", c), (m = o == null ? void 0 : o.focus) == null || m.call(o);
    };
  }, [t, r]);
}
function q(...t) {
  return At(Mt(t));
}
const Re = [
  "rows",
  "columns",
  "values",
  "reportFilters"
], ye = "palette:", Ne = "sort:", Ce = "valsort:";
function ne(t, r) {
  return `${Ne}${t}:${r}`;
}
function Pe(t) {
  return `${Ce}${t}`;
}
function De(t) {
  return t.startsWith(ye) && t.slice(ye.length) || null;
}
function fe(t) {
  if (!t.startsWith(Ne)) return null;
  const r = t.slice(Ne.length), n = r.indexOf(":");
  if (n < 0) return null;
  const o = r.slice(0, n), l = r.slice(n + 1);
  return o !== "rows" && o !== "columns" && o !== "reportFilters" || !l ? null : { zone: o, fieldId: l };
}
function ge(t) {
  return t.startsWith(Ce) && t.slice(Ce.length) || null;
}
function Le(t) {
  if (t == null) return null;
  const r = String(t);
  if (Re.includes(r))
    return r;
  if (r.endsWith("-zone")) {
    const o = r.slice(0, -5);
    return Re.includes(o) ? o : null;
  }
  const n = fe(r);
  return n ? n.zone : ge(r) ? "values" : null;
}
const tr = (t) => {
  const r = ft(t);
  if (r.length > 0) return r;
  const n = gt(t);
  return n.length > 0 ? n : xt(t);
};
function rr() {
  const t = z().zones;
  return {
    reportFilters: t.reportFilters,
    columns: t.columns,
    rows: t.rows,
    values: t.values
  };
}
const nr = {
  reportFilters: "border-amber-300 bg-amber-50",
  columns: "border-green-300 bg-green-50",
  rows: "border-blue-300 bg-blue-50",
  values: "border-purple-300 bg-purple-50"
};
function lr(t) {
  return /* @__PURE__ */ new Set([
    ...t.rows,
    ...t.columns,
    ...t.reportFilters,
    ...t.values.map((r) => r.fieldId)
  ]);
}
function be({ zone: t, children: r }) {
  const { setNodeRef: n, isOver: o } = Tt({ id: `${t}-zone`, data: { zone: t } });
  return /* @__PURE__ */ g(
    "div",
    {
      ref: n,
      className: q(
        "min-h-[72px] rounded-md border-2 border-dashed p-2",
        nr[t],
        o && "ring-2 ring-zinc-400"
      ),
      children: [
        /* @__PURE__ */ e("div", { className: "mb-1 text-xs font-semibold", children: rr()[t] }),
        r
      ]
    }
  );
}
function or({ id: t, label: r, disabled: n }) {
  const { attributes: o, listeners: l, setNodeRef: i, isDragging: c } = kt({
    id: `${ye}${t}`,
    disabled: n
  });
  return /* @__PURE__ */ g(
    "button",
    {
      ref: i,
      type: "button",
      disabled: n,
      className: q(
        "inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs",
        n && "opacity-40",
        c && "opacity-60"
      ),
      ...l,
      ...o,
      children: [
        /* @__PURE__ */ e(ke, { className: "h-3 w-3 text-zinc-400" }),
        r
      ]
    }
  );
}
function we({
  sortableId: t,
  label: r,
  filter: n,
  onConfigure: o,
  onRemove: l
}) {
  const { attributes: i, listeners: c, setNodeRef: m, transform: h, transition: v, isDragging: u } = Me({
    id: t
  });
  return /* @__PURE__ */ g(
    "div",
    {
      ref: m,
      style: {
        transform: Ae.Transform.toString(h),
        transition: v,
        opacity: u ? 0.6 : 1
      },
      className: "mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs",
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: "cursor-grab rounded p-0.5 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing",
            "aria-label": z().filters.reorder,
            ...i,
            ...c,
            children: /* @__PURE__ */ e(ke, { className: "h-3 w-3" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "flex-1 truncate", children: r }),
        o && /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            onClick: o,
            className: q("rounded p-0.5 hover:bg-zinc-100", n && "bg-amber-50 text-amber-700"),
            "aria-label": z().filters.filter,
            children: /* @__PURE__ */ e(It, { className: "h-3 w-3" })
          }
        ),
        /* @__PURE__ */ e("button", { type: "button", onClick: l, children: /* @__PURE__ */ e(Te, { className: "h-3 w-3" }) })
      ]
    }
  );
}
function sr({
  sortableId: t,
  label: r,
  aggregation: n,
  aggregations: o,
  onUpdateAggregation: l,
  onRemove: i
}) {
  const { attributes: c, listeners: m, setNodeRef: h, transform: v, transition: u, isDragging: x } = Me({
    id: t
  }), d = z();
  return /* @__PURE__ */ g(
    "div",
    {
      ref: h,
      style: {
        transform: Ae.Transform.toString(v),
        transition: u,
        opacity: x ? 0.6 : 1
      },
      className: "mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs",
      children: [
        /* @__PURE__ */ e(
          "button",
          {
            type: "button",
            className: "cursor-grab rounded p-0.5 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing",
            "aria-label": d.filters.reorder,
            ...c,
            ...m,
            children: /* @__PURE__ */ e(ke, { className: "h-3 w-3" })
          }
        ),
        /* @__PURE__ */ e("span", { className: "truncate", children: r }),
        /* @__PURE__ */ e(
          "select",
          {
            value: n,
            onChange: (p) => l == null ? void 0 : l(p.target.value),
            className: "h-5 rounded border text-[10px]",
            children: o.map((p) => /* @__PURE__ */ e("option", { value: p, children: d.aggregations[p] }, p))
          }
        ),
        /* @__PURE__ */ e("button", { type: "button", onClick: i, children: /* @__PURE__ */ e(Te, { className: "h-3 w-3" }) })
      ]
    }
  );
}
const ar = [
  "SUM",
  "COUNT",
  "AVG",
  "MIN",
  "MAX",
  "COUNT_DISTINCT",
  "PERCENT_OF_ROW",
  "PERCENT_OF_COLUMN",
  "PERCENT_OF_TOTAL",
  "RUNNING_TOTAL"
];
function ir({
  fields: t,
  config: r,
  rawData: n,
  onAddField: o,
  onRemoveField: l,
  onUpdateAggregation: i,
  onSetFilter: c,
  onAddCalculatedPreset: m,
  onRemoveCalculatedMeasure: h,
  onReorderFields: v,
  onReorderValueFields: u
}) {
  const x = z(), [d, p] = I(null), [s, y] = I(null), E = se(null);
  er(!!(s && c), E);
  const D = vt(wt(yt, { activationConstraint: { distance: 6 } })), N = new Map(t.map((a) => [a.id, a])), M = j(() => new Map(r.filters.map((a) => [a.fieldId, a])), [r.filters]), T = lr(r);
  function A(a) {
    r.reportFilters.includes(a) && l("reportFilters", a), r.rows.includes(a) && l("rows", a), r.columns.includes(a) && l("columns", a), r.values.some((k) => k.fieldId === a) && (h == null || h(a), l("values", a));
  }
  function S(a) {
    var J;
    p(null);
    const { active: k, over: F } = a;
    if (!F) return;
    const W = String(k.id), H = String(F.id), P = Le(H) ?? Le((J = F.data.current) == null ? void 0 : J.zone), $ = fe(W);
    if ($) {
      if (P && P !== $.zone) {
        A($.fieldId), o(P, $.fieldId);
        return;
      }
      if (!v) return;
      const Z = fe(H);
      if (Z && Z.zone === $.zone) {
        const G = [...r[$.zone]], X = G.indexOf($.fieldId), U = G.indexOf(Z.fieldId);
        X >= 0 && U >= 0 && X !== U && v($.zone, _e(G, X, U));
      }
      return;
    }
    const B = ge(W);
    if (B) {
      if (P && P !== "values") {
        A(B), o(P, B);
        return;
      }
      if (!u) return;
      const Z = ge(H);
      if (Z) {
        const G = r.values.map((ee) => ee.fieldId), X = G.indexOf(B), U = G.indexOf(Z);
        X >= 0 && U >= 0 && X !== U && u(_e(G, X, U));
      }
      return;
    }
    const K = De(W);
    if (!K || !P) return;
    const V = N.get(K);
    if (V) {
      if (P === "values") {
        (V.dataType === "number" || V.dataType === "currency") && o(P, K);
        return;
      }
      if (P === "reportFilters") {
        o(P, K);
        return;
      }
      (V.dataType === "string" || V.dataType === "date") && o(P, K);
    }
  }
  const L = s ? N.get(s) : void 0, R = (() => {
    var W, H, P, $;
    if (!d) return null;
    const a = De(d);
    if (a) return ((W = N.get(a)) == null ? void 0 : W.label) ?? a;
    const k = fe(d);
    if (k) return ((H = N.get(k.fieldId)) == null ? void 0 : H.label) ?? k.fieldId;
    const F = ge(d);
    if (F) {
      const B = (P = r.calculatedMeasures) == null ? void 0 : P.find((K) => K.id === F);
      return (B == null ? void 0 : B.label) ?? (($ = N.get(F)) == null ? void 0 : $.label) ?? F;
    }
    return null;
  })();
  return /* @__PURE__ */ g(
    Nt,
    {
      sensors: D,
      collisionDetection: tr,
      onDragStart: (a) => p(String(a.active.id)),
      onDragEnd: S,
      onDragCancel: () => p(null),
      children: [
        /* @__PURE__ */ g("div", { className: "flex gap-3 pivot-builder-root", children: [
          /* @__PURE__ */ g("aside", { className: "pivot-field-list w-52 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 p-2", children: [
            /* @__PURE__ */ e("div", { className: "mb-1 text-xs font-medium text-zinc-500", children: x.zones.fields }),
            /* @__PURE__ */ e("div", { className: "flex max-h-64 flex-wrap gap-1 overflow-y-auto sm:max-h-none", children: t.map((a) => /* @__PURE__ */ e(or, { id: a.id, label: a.label, disabled: T.has(a.id) }, a.id)) })
          ] }),
          /* @__PURE__ */ g("div", { className: "grid min-w-0 flex-1 gap-2 sm:grid-cols-2", children: [
            /* @__PURE__ */ e(be, { zone: "reportFilters", children: /* @__PURE__ */ e(
              he,
              {
                items: r.reportFilters.map((a) => ne("reportFilters", a)),
                strategy: pe,
                children: r.reportFilters.map((a) => {
                  var k;
                  return /* @__PURE__ */ e(
                    we,
                    {
                      sortableId: ne("reportFilters", a),
                      label: ((k = N.get(a)) == null ? void 0 : k.label) ?? a,
                      filter: M.get(a),
                      onConfigure: c ? () => y(a) : void 0,
                      onRemove: () => l("reportFilters", a)
                    },
                    a
                  );
                })
              }
            ) }),
            /* @__PURE__ */ e(be, { zone: "columns", children: /* @__PURE__ */ e(
              he,
              {
                items: r.columns.map((a) => ne("columns", a)),
                strategy: pe,
                children: r.columns.map((a) => {
                  var k;
                  return /* @__PURE__ */ e(
                    we,
                    {
                      sortableId: ne("columns", a),
                      label: ((k = N.get(a)) == null ? void 0 : k.label) ?? a,
                      filter: M.get(a),
                      onConfigure: c ? () => y(a) : void 0,
                      onRemove: () => l("columns", a)
                    },
                    a
                  );
                })
              }
            ) }),
            /* @__PURE__ */ e(be, { zone: "rows", children: /* @__PURE__ */ e(
              he,
              {
                items: r.rows.map((a) => ne("rows", a)),
                strategy: pe,
                children: r.rows.map((a) => {
                  var k;
                  return /* @__PURE__ */ e(
                    we,
                    {
                      sortableId: ne("rows", a),
                      label: ((k = N.get(a)) == null ? void 0 : k.label) ?? a,
                      filter: M.get(a),
                      onConfigure: c ? () => y(a) : void 0,
                      onRemove: () => l("rows", a)
                    },
                    a
                  );
                })
              }
            ) }),
            /* @__PURE__ */ g(be, { zone: "values", children: [
              /* @__PURE__ */ e(
                he,
                {
                  items: r.values.map((a) => Pe(a.fieldId)),
                  strategy: pe,
                  children: r.values.map((a) => {
                    var F, W;
                    const k = (F = r.calculatedMeasures) == null ? void 0 : F.find((H) => H.id === a.fieldId);
                    return /* @__PURE__ */ e(
                      sr,
                      {
                        sortableId: Pe(a.fieldId),
                        label: (k == null ? void 0 : k.label) ?? ((W = N.get(a.fieldId)) == null ? void 0 : W.label) ?? a.fieldId,
                        aggregation: a.aggregation,
                        aggregations: ar,
                        onUpdateAggregation: (H) => i == null ? void 0 : i(a.fieldId, H),
                        onRemove: () => {
                          k && h && h(a.fieldId), l("values", a.fieldId);
                        }
                      },
                      a.fieldId
                    );
                  })
                }
              ),
              m && /* @__PURE__ */ e("div", { className: "mt-1 flex flex-wrap gap-1 border-t border-dashed border-purple-200 pt-1", children: Be().map((a) => /* @__PURE__ */ g(
                "button",
                {
                  type: "button",
                  title: a.description,
                  onClick: () => m(a.id),
                  className: "rounded border border-purple-200 bg-white px-1.5 py-0.5 text-[10px] hover:bg-purple-50",
                  children: [
                    "+ ",
                    a.label
                  ]
                },
                a.id
              )) })
            ] })
          ] })
        ] }),
        L && c && /* @__PURE__ */ e("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4", children: /* @__PURE__ */ e(
          "div",
          {
            ref: E,
            role: "dialog",
            "aria-modal": "true",
            "aria-label": x.filters.filter,
            className: "max-h-[90vh] overflow-auto",
            children: /* @__PURE__ */ e(
              Yt,
              {
                field: L,
                members: Ue(n, L.id),
                allFields: t,
                filter: M.get(L.id),
                onApply: (a) => {
                  c(a, L.id), y(null);
                },
                onClose: () => y(null)
              }
            )
          }
        ) }),
        /* @__PURE__ */ e(Ct, { children: R ? /* @__PURE__ */ e("div", { className: "rounded border bg-white px-2 py-1 text-xs shadow", children: R }) : null })
      ]
    }
  );
}
const le = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#7c3aed", "#0891b2"], cr = Ke(function({ data: r, className: n, chartType: o = "bar", onChartTypeChange: l, warnings: i = [] }, c) {
  const m = z(), h = je(r), v = j(() => {
    var x;
    return ((x = r.series[0]) == null ? void 0 : x.id) ? r.categories.map((d, p) => {
      var s;
      return {
        name: d,
        value: ((s = r.series[0]) == null ? void 0 : s.data[p]) ?? 0
      };
    }) : [];
  }, [r]);
  return /* @__PURE__ */ g("div", { ref: c, className: n, children: [
    /* @__PURE__ */ e("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2", children: l && /* @__PURE__ */ e("div", { className: "inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs", children: ["bar", "line", "pie"].map((u) => /* @__PURE__ */ e(
      "button",
      {
        type: "button",
        className: `rounded px-2 py-1 ${o === u ? "bg-zinc-100 font-medium" : ""}`,
        onClick: () => l(u),
        children: m.chart[u]
      },
      u
    )) }) }),
    i.length > 0 && /* @__PURE__ */ e("div", { className: "mb-2 space-y-1", children: i.map((u) => /* @__PURE__ */ e("p", { className: "text-xs text-amber-700", children: u }, u)) }),
    /* @__PURE__ */ e($t, { width: "100%", height: 360, children: o === "pie" ? /* @__PURE__ */ g(Vt, { children: [
      /* @__PURE__ */ e(xe, {}),
      /* @__PURE__ */ e(ve, {}),
      /* @__PURE__ */ e(Ht, { data: v, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 120, label: !0, children: v.map((u, x) => /* @__PURE__ */ e(Wt, { fill: le[x % le.length] }, `cell-${x}`)) })
    ] }) : o === "line" ? /* @__PURE__ */ g(Kt, { data: h, margin: { top: 8, right: 16, left: 8, bottom: 8 }, children: [
      /* @__PURE__ */ e(Fe, { strokeDasharray: "3 3", stroke: "#e4e4e7" }),
      /* @__PURE__ */ e(Se, { dataKey: "category", tick: { fontSize: 11 } }),
      /* @__PURE__ */ e(ze, { tick: { fontSize: 11 } }),
      /* @__PURE__ */ e(xe, {}),
      /* @__PURE__ */ e(ve, {}),
      r.series.map((u, x) => /* @__PURE__ */ e(
        Bt,
        {
          type: "monotone",
          dataKey: u.id,
          name: u.label,
          stroke: le[x % le.length],
          strokeWidth: 2,
          dot: { r: 3 },
          connectNulls: !0
        },
        u.id
      ))
    ] }) : /* @__PURE__ */ g(Ut, { data: h, margin: { top: 8, right: 16, left: 8, bottom: 8 }, children: [
      /* @__PURE__ */ e(Fe, { strokeDasharray: "3 3", stroke: "#e4e4e7" }),
      /* @__PURE__ */ e(Se, { dataKey: "category", tick: { fontSize: 11 } }),
      /* @__PURE__ */ e(ze, { tick: { fontSize: 11 } }),
      /* @__PURE__ */ e(xe, {}),
      /* @__PURE__ */ e(ve, {}),
      r.series.map((u, x) => /* @__PURE__ */ e(
        jt,
        {
          dataKey: u.id,
          name: u.label,
          fill: le[x % le.length],
          radius: [4, 4, 0, 0]
        },
        u.id
      ))
    ] }) })
  ] });
});
function dr({ open: t, records: r, fields: n, cellContext: o, onClose: l, className: i }) {
  const c = z().drillThrough, m = j(() => {
    const u = /* @__PURE__ */ new Set();
    for (const d of r.slice(0, 50))
      for (const p of Object.keys(d)) u.add(p);
    const x = n.filter((d) => u.has(d.id)).map((d) => d.id);
    for (const d of u)
      x.includes(d) || x.push(d);
    return x.slice(0, 12);
  }, [r, n]), h = j(
    () => m.map((u) => {
      var x;
      return {
        id: u,
        label: ((x = n.find((d) => d.id === u)) == null ? void 0 : x.label) ?? u
      };
    }),
    [m, n]
  ), v = () => {
    r.length && Ge(r, h, {
      filename: `drill-through-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.xlsx`,
      sheetName: c.sheetName
    });
  };
  return t ? /* @__PURE__ */ e("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center", children: /* @__PURE__ */ g(
    "div",
    {
      className: q(
        "flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg",
        i
      ),
      role: "dialog",
      "aria-labelledby": "drill-through-title",
      children: [
        /* @__PURE__ */ g("div", { className: "flex items-center justify-between border-b px-4 py-3", children: [
          /* @__PURE__ */ g("div", { children: [
            /* @__PURE__ */ e("h2", { id: "drill-through-title", className: "text-sm font-semibold", children: c.title }),
            /* @__PURE__ */ g("p", { className: "text-xs text-zinc-500", children: [
              c.rowCount(r.length.toLocaleString("ru-RU")),
              (o == null ? void 0 : o.valueFieldId) && ` · ${o.valueFieldId}`
            ] })
          ] }),
          /* @__PURE__ */ g("div", { className: "flex items-center gap-2", children: [
            r.length > 0 && /* @__PURE__ */ g(
              "button",
              {
                type: "button",
                onClick: v,
                className: "inline-flex items-center gap-1 rounded border border-zinc-300 bg-white px-2 py-1 text-xs hover:bg-zinc-50",
                children: [
                  /* @__PURE__ */ e($e, { className: "h-3.5 w-3.5" }),
                  "Excel"
                ]
              }
            ),
            /* @__PURE__ */ e(
              "button",
              {
                type: "button",
                onClick: l,
                className: "rounded p-1 hover:bg-zinc-100",
                "aria-label": c.close,
                children: /* @__PURE__ */ e(Te, { className: "h-4 w-4" })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ e("div", { className: "overflow-auto p-2", children: r.length === 0 ? /* @__PURE__ */ e("p", { className: "p-4 text-sm text-zinc-500", children: c.noRows }) : /* @__PURE__ */ g("table", { className: "w-full min-w-max border-collapse text-xs", children: [
          /* @__PURE__ */ e("thead", { className: "sticky top-0 bg-zinc-100", children: /* @__PURE__ */ e("tr", { children: m.map((u) => {
            var x;
            return /* @__PURE__ */ e("th", { className: "border-b px-2 py-1.5 text-left font-semibold", children: ((x = n.find((d) => d.id === u)) == null ? void 0 : x.label) ?? u }, u);
          }) }) }),
          /* @__PURE__ */ e("tbody", { children: r.slice(0, 500).map((u, x) => /* @__PURE__ */ e("tr", { className: "hover:bg-zinc-50", children: m.map((d) => /* @__PURE__ */ e("td", { className: "border-b px-2 py-1 tabular-nums", children: ur(u[d]) }, d)) }, x)) })
        ] }) })
      ]
    }
  ) }) : null;
}
function ur(t) {
  return t == null ? "—" : typeof t == "number" ? t.toLocaleString("ru-RU") : String(t);
}
const mr = 80, hr = 34;
function pr({ data: t, config: r, expandedRows: n, onToggleRow: o, onSort: l, onCellDoubleClick: i, className: c }) {
  var M, T, A, S, L;
  const m = z(), h = se(null), v = (M = t.rows[0]) == null ? void 0 : M.cells.some((R) => R.columnKey === "__row_label__"), u = j(
    () => Xe(t.rows, n, t.grandTotal, t.columnTotals),
    [t.rows, t.grandTotal, t.columnTotals, n]
  ), x = u.length > mr, d = Gt({
    count: u.length,
    getScrollElement: () => h.current,
    estimateSize: () => hr,
    overscan: 12,
    enabled: x
  }), p = x ? d.getVirtualItems() : [], s = x ? ((T = p[0]) == null ? void 0 : T.start) ?? 0 : 0, y = x ? d.getTotalSize() - (((A = p[p.length - 1]) == null ? void 0 : A.end) ?? 0) : 0, E = x ? p.map((R) => R.index) : u.map((R, a) => a), D = (S = r.options.sortBy) == null ? void 0 : S.fieldId, N = (L = r.options.sortBy) == null ? void 0 : L.direction;
  return /* @__PURE__ */ g("div", { className: q("overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm", c), children: [
    /* @__PURE__ */ e("div", { ref: h, className: "max-h-[inherit] overflow-auto", children: /* @__PURE__ */ g("table", { className: "w-full min-w-max border-collapse text-sm", children: [
      /* @__PURE__ */ e("thead", { className: "sticky top-0 z-10 bg-zinc-100", children: t.headers.map((R, a) => /* @__PURE__ */ g("tr", { children: [
        a === 0 && v && /* @__PURE__ */ g(
          "th",
          {
            rowSpan: t.headers.length,
            className: "cursor-pointer border-b px-3 py-2 text-left text-xs font-semibold hover:bg-zinc-200",
            onClick: () => r.rows[0] && (l == null ? void 0 : l(r.rows[0])),
            children: [
              m.table.group,
              D === r.rows[0] && /* @__PURE__ */ e("span", { className: "ml-1 text-[10px]", children: N === "asc" ? "▲" : "▼" })
            ]
          }
        ),
        R.filter((k) => k.key !== "__row_label__").map((k) => {
          const F = br(k, r, a);
          return /* @__PURE__ */ g(
            "th",
            {
              colSpan: k.colspan,
              rowSpan: k.rowspan,
              className: q(
                "border-b px-3 py-2 text-center text-xs font-semibold",
                F && l && "cursor-pointer hover:bg-zinc-200"
              ),
              onClick: () => F && (l == null ? void 0 : l(F)),
              children: [
                k.label,
                F && D === F && /* @__PURE__ */ e("span", { className: "ml-1 text-[10px]", children: N === "asc" ? "▲" : "▼" })
              ]
            },
            k.key
          );
        })
      ] }, `h-${a}`)) }),
      /* @__PURE__ */ g("tbody", { children: [
        x && s > 0 && /* @__PURE__ */ e("tr", { "aria-hidden": !0, style: { height: s }, children: /* @__PURE__ */ e("td", { colSpan: 99, className: "border-none p-0" }) }),
        E.map((R) => {
          var a;
          return /* @__PURE__ */ e(
            fr,
            {
              item: u[R],
              config: r,
              onToggleRow: o,
              onSort: l,
              onCellDoubleClick: i
            },
            `${(a = u[R]) == null ? void 0 : a.type}-${R}`
          );
        }),
        x && y > 0 && /* @__PURE__ */ e("tr", { "aria-hidden": !0, style: { height: y }, children: /* @__PURE__ */ e("td", { colSpan: 99, className: "border-none p-0" }) })
      ] })
    ] }) }),
    /* @__PURE__ */ e("div", { className: "border-t px-3 py-1.5 text-[10px] text-zinc-500", children: m.table.rowsMeta(
      t.metadata.processedRows.toLocaleString("ru-RU"),
      t.metadata.executionTime.toFixed(1),
      {
        virtual: x ? String(u.length) : void 0,
        fromCache: t.metadata.fromCache,
        incremental: t.metadata.incremental
      }
    ) })
  ] });
}
function br(t, r, n) {
  var o;
  if (t.isValue) {
    const l = r.values.find((i) => (i.label ?? i.fieldId) === t.label);
    return (l == null ? void 0 : l.fieldId) ?? ((o = r.values[0]) == null ? void 0 : o.fieldId);
  }
  return r.columns[n];
}
function fr({
  item: t,
  config: r,
  onToggleRow: n,
  onSort: o,
  onCellDoubleClick: l
}) {
  const i = r.options.conditionalFormats;
  if (t.type === "columnTotal")
    return /* @__PURE__ */ e("tr", { className: "bg-zinc-100 font-semibold", children: t.total.cells.map((d) => {
      const p = me(d, i), s = !!(l && d.drillContext && !d.isEmpty);
      return /* @__PURE__ */ e(
        "td",
        {
          className: q(
            "border-t px-3 py-2 tabular-nums",
            d.columnKey === "__row_label__" ? "text-left" : "text-right",
            s && "cursor-pointer hover:bg-zinc-200"
          ),
          style: { backgroundColor: p == null ? void 0 : p.backgroundColor, color: p == null ? void 0 : p.textColor },
          onDoubleClick: s ? () => l(d) : void 0,
          title: s ? z().table.drillThroughHint : void 0,
          children: d.formatted
        },
        d.columnKey
      );
    }) });
  if (t.type === "grandTotal")
    return /* @__PURE__ */ e("tr", { className: "bg-zinc-100 font-semibold", children: t.total.cells.map((d) => {
      const p = me(d, i), s = !!(l && d.drillContext && !d.isEmpty);
      return /* @__PURE__ */ e(
        "td",
        {
          className: q(
            "border-t-2 px-3 py-2 tabular-nums",
            d.columnKey === "__row_label__" ? "text-left" : "text-right",
            s && "cursor-pointer hover:bg-zinc-200"
          ),
          style: {
            backgroundColor: p == null ? void 0 : p.backgroundColor,
            color: p == null ? void 0 : p.textColor
          },
          onDoubleClick: s ? () => l(d) : void 0,
          title: s ? z().table.drillThroughHint : void 0,
          children: d.formatted
        },
        d.columnKey
      );
    }) });
  if (t.type === "subtotal")
    return /* @__PURE__ */ e("tr", { className: "bg-zinc-50 font-semibold italic", children: t.subtotal.cells.map((d) => {
      const p = me(d, i);
      return /* @__PURE__ */ e(
        "td",
        {
          className: "border-b px-3 py-1.5 tabular-nums",
          style: {
            paddingLeft: d.columnKey === "__row_label__" ? `${12 + t.depth * 16}px` : void 0,
            backgroundColor: p == null ? void 0 : p.backgroundColor,
            color: p == null ? void 0 : p.textColor
          },
          children: d.formatted
        },
        d.columnKey
      );
    }) });
  const { row: c, depth: m, expanded: h, hasChildren: v } = t, u = c.cells[0], x = c.cells.slice(1);
  return /* @__PURE__ */ g("tr", { className: "hover:bg-zinc-50", children: [
    u && /* @__PURE__ */ e(
      "td",
      {
        className: "cursor-pointer border-b px-3 py-1.5 font-medium",
        style: { paddingLeft: `${12 + m * 16}px` },
        onClick: () => r.rows[m] && (o == null ? void 0 : o(r.rows[m])),
        children: /* @__PURE__ */ g("div", { className: "flex items-center gap-1", children: [
          v ? /* @__PURE__ */ e(
            "button",
            {
              type: "button",
              onClick: (d) => {
                d.stopPropagation(), n(t.rowKey);
              },
              className: "rounded p-0.5 hover:bg-zinc-200",
              children: h ? /* @__PURE__ */ e(_t, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ e(Et, { className: "h-3.5 w-3.5" })
            }
          ) : /* @__PURE__ */ e("span", { className: "w-5" }),
          /* @__PURE__ */ e("span", { children: u.formatted || c.key })
        ] })
      }
    ),
    x.map((d) => {
      const p = me(d, i), s = typeof d.rawValue == "number" && d.rawValue < 0, y = !!(l && d.drillContext && !d.isEmpty);
      return /* @__PURE__ */ e(
        "td",
        {
          className: q(
            "border-b px-3 py-1.5 text-right tabular-nums",
            s && !(p != null && p.textColor) && "text-red-600",
            y && "cursor-pointer hover:bg-zinc-100 hover:underline"
          ),
          style: { backgroundColor: p == null ? void 0 : p.backgroundColor, color: p == null ? void 0 : p.textColor },
          onDoubleClick: y ? () => l(d) : void 0,
          title: y ? z().table.drillThroughHint : void 0,
          children: d.formatted
        },
        d.columnKey
      );
    })
  ] });
}
function gr({
  onExpandAll: t,
  onCollapseAll: r,
  onReset: n,
  onExportExcel: o,
  onExportPdf: l,
  onExportHtml: i,
  onExportChartPng: c,
  onExportCsv: m,
  exportDisabled: h = !1,
  chartExportDisabled: v = !1,
  isExporting: u = !1,
  exportingFormat: x = null,
  viewMode: d = "table",
  onViewModeChange: p,
  activeFilterCount: s = 0,
  onClearFilters: y,
  showColumnTotals: E,
  onToggleColumnTotals: D,
  isFullscreen: N,
  onToggleFullscreen: M
}) {
  const T = z().toolbar, A = h || u, S = "inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 text-xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50", L = (R) => u && x === R ? /* @__PURE__ */ e(Ot, { className: "h-3.5 w-3.5 animate-spin" }) : null;
  return /* @__PURE__ */ g("div", { className: "flex flex-wrap items-center gap-2", children: [
    p && /* @__PURE__ */ g("div", { className: "inline-flex rounded-md border border-zinc-300 bg-white p-0.5 text-xs", children: [
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `rounded px-2 py-1 ${d === "table" ? "bg-zinc-100 font-medium" : ""}`,
          onClick: () => p("table"),
          children: T.table
        }
      ),
      /* @__PURE__ */ e(
        "button",
        {
          type: "button",
          className: `rounded px-2 py-1 ${d === "chart" ? "bg-zinc-100 font-medium" : ""}`,
          onClick: () => p("chart"),
          disabled: A,
          children: T.chart
        }
      )
    ] }),
    o && /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: S,
        onClick: o,
        disabled: A,
        children: [
          L("excel") ?? /* @__PURE__ */ e($e, { className: "h-3.5 w-3.5" }),
          T.excel
        ]
      }
    ),
    m && /* @__PURE__ */ g("button", { type: "button", className: S, onClick: m, disabled: A, children: [
      L("csv") ?? /* @__PURE__ */ e(Ee, { className: "h-3.5 w-3.5" }),
      T.csv
    ] }),
    l && /* @__PURE__ */ g("button", { type: "button", className: S, onClick: l, disabled: A, children: [
      L("pdf") ?? /* @__PURE__ */ e(Ee, { className: "h-3.5 w-3.5" }),
      T.pdf
    ] }),
    i && /* @__PURE__ */ g("button", { type: "button", className: S, onClick: i, disabled: A, children: [
      L("html") ?? /* @__PURE__ */ e(Ft, { className: "h-3.5 w-3.5" }),
      T.html
    ] }),
    c && /* @__PURE__ */ g(
      "button",
      {
        type: "button",
        className: S,
        onClick: c,
        disabled: v || u,
        children: [
          L("chartPng") ?? /* @__PURE__ */ e(St, { className: "h-3.5 w-3.5" }),
          T.chartPng
        ]
      }
    ),
    M && /* @__PURE__ */ g("button", { type: "button", className: S, onClick: M, children: [
      N ? /* @__PURE__ */ e(zt, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ e(Rt, { className: "h-3.5 w-3.5" }),
      N ? T.exitFullscreen : T.fullscreen
    ] }),
    /* @__PURE__ */ g("button", { type: "button", className: S, onClick: t, children: [
      /* @__PURE__ */ e(Pt, { className: "h-3.5 w-3.5" }),
      T.expandAll
    ] }),
    /* @__PURE__ */ g("button", { type: "button", className: S, onClick: r, children: [
      /* @__PURE__ */ e(Dt, { className: "h-3.5 w-3.5" }),
      T.collapseAll
    ] }),
    /* @__PURE__ */ g("button", { type: "button", className: `${S} border-transparent`, onClick: n, children: [
      /* @__PURE__ */ e(Lt, { className: "h-3.5 w-3.5" }),
      T.reset
    ] }),
    D && /* @__PURE__ */ e(
      "button",
      {
        type: "button",
        className: `${S} ${E ? "bg-purple-50" : ""}`,
        onClick: D,
        children: T.columnTotals
      }
    ),
    s > 0 && y && /* @__PURE__ */ e("button", { type: "button", className: `${S} bg-amber-50`, onClick: y, children: T.clearFilters(s) })
  ] });
}
function xr() {
  return new Worker(new URL(
    /* @vite-ignore */
    "/assets/pivot.worker-CcTtH_KM.js",
    import.meta.url
  ), { type: "module" });
}
function vr(t, r, n = {}) {
  var U, ee, ce, ae;
  const o = se(new Ze()), l = se(null), [i, c] = I({
    ...Ie,
    ...n.initialConfig
  }), [m, h] = I(null), [v, u] = I(!1), [x, d] = I(/* @__PURE__ */ new Set()), [p, s] = I(!1), [y, E] = I([]), [D, N] = I(null), M = n.useWorker !== !1;
  oe(() => {
    if (!(!M || typeof Worker > "u"))
      return l.current = qe({
        threshold: n.workerThreshold ?? Qe,
        workerFactory: xr
      }), () => {
        var b;
        return (b = l.current) == null ? void 0 : b.terminate();
      };
  }, [M, n.workerThreshold]), oe(() => {
    r.length && c((b) => {
      var f, C, O, Q, de;
      if (!Ye(b) || (C = (f = n.initialConfig) == null ? void 0 : f.values) != null && C.length || (Q = (O = n.initialConfig) == null ? void 0 : O.rows) != null && Q.length)
        return b;
      const w = Je(r);
      return (de = w.values) != null && de.length ? { ...b, ...w } : b;
    });
  }, [r, (ee = (U = n.initialConfig) == null ? void 0 : U.rows) == null ? void 0 : ee.length, (ae = (ce = n.initialConfig) == null ? void 0 : ce.values) == null ? void 0 : ae.length]), oe(() => {
    if (!t.length || !i.values.length) {
      h(null), u(!1);
      return;
    }
    let b = !1;
    return u(!0), (async () => {
      try {
        const f = l.current, O = (f == null ? void 0 : f.shouldUseWorker(t.length)) && f ? await f.compute(t, r, i) : o.current.compute(t, r, i);
        b || h(O);
      } catch {
        if (!b)
          try {
            h(o.current.compute(t, r, i));
          } catch {
            h(null);
          }
      } finally {
        b || u(!1);
      }
    })(), () => {
      b = !0;
    };
  }, [t, r, i]);
  const T = _((b, w) => {
    c((f) => b === "values" ? f.values.some((C) => C.fieldId === w) ? f : { ...f, values: [...f.values, { fieldId: w, aggregation: "SUM" }] } : b === "reportFilters" ? f.reportFilters.includes(w) ? f : { ...f, reportFilters: [...f.reportFilters, w] } : f[b].includes(w) ? f : { ...f, [b]: [...f[b], w] });
  }, []), A = _((b, w) => {
    c((f) => b === "values" ? { ...f, values: f.values.filter((C) => C.fieldId !== w) } : b === "reportFilters" ? {
      ...f,
      reportFilters: f.reportFilters.filter((C) => C !== w),
      filters: f.filters.filter((C) => C.fieldId !== w)
    } : {
      ...f,
      [b]: f[b].filter((C) => C !== w),
      filters: f.filters.filter((C) => C.fieldId !== w)
    });
  }, []), S = _((b, w) => {
    c((f) => ({
      ...f,
      values: f.values.map((C) => C.fieldId === b ? { ...C, aggregation: w } : C)
    }));
  }, []), L = _(
    (b, w) => {
      c((f) => ({ ...f, [b]: w }));
    },
    []
  ), R = _((b) => {
    c((w) => {
      const f = new Map(w.values.map((O) => [O.fieldId, O])), C = b.map((O) => f.get(O)).filter(Boolean);
      return C.length !== w.values.length ? w : { ...w, values: C };
    });
  }, []), a = _((b, w) => {
    c((f) => {
      const C = (b == null ? void 0 : b.fieldId) ?? w;
      return C ? b ? {
        ...f,
        filters: [...f.filters.filter((O) => O.fieldId !== b.fieldId), b]
      } : { ...f, filters: f.filters.filter((O) => O.fieldId !== C) } : f;
    });
  }, []), k = _(() => {
    c((b) => ({ ...b, filters: [] }));
  }, []), F = _((b) => {
    c((w) => {
      const f = w.options.sortBy, C = (f == null ? void 0 : f.fieldId) === b && f.direction === "asc" ? "desc" : "asc";
      return {
        ...w,
        options: { ...w.options, sortBy: { fieldId: b, direction: C } }
      };
    });
  }, []), W = _((b) => {
    d((w) => {
      const f = new Set(w);
      return f.has(b) ? f.delete(b) : f.add(b), f;
    });
  }, []), H = _(() => {
    m != null && m.rows.length && d(new Set(et(m.rows)));
  }, [m]), P = _(() => d(/* @__PURE__ */ new Set()), []), $ = _(() => {
    c({ ...Ie, ...n.initialConfig }), d(/* @__PURE__ */ new Set());
  }, [n.initialConfig]), B = _(
    (b) => {
      if (!b.drillContext) return;
      const w = [
        ...r,
        ...tt(i.calculatedMeasures ?? [])
      ], f = o.current.getDrillThroughRecords(t, w, i, {
        rowGroupKey: b.drillContext.rowGroupKey,
        columnKey: b.columnKey,
        valueFieldId: b.drillContext.valueFieldId
      });
      E(f), N(b), s(!0);
    },
    [t, r, i]
  ), K = _(() => {
    s(!1), N(null), E([]);
  }, []), V = _((b) => {
    const w = rt.find((C) => C.id === b);
    if (!w) return;
    const f = {
      id: `calc_${w.id}`,
      label: w.label,
      formula: w.formula
    };
    c((C) => {
      var O;
      return (O = C.calculatedMeasures) != null && O.some((Q) => Q.id === f.id) ? C : {
        ...C,
        calculatedMeasures: [...C.calculatedMeasures ?? [], f],
        values: C.values.some((Q) => Q.fieldId === f.id) ? C.values : [...C.values, { fieldId: f.id, label: f.label, aggregation: "SUM" }]
      };
    });
  }, []), J = _((b) => {
    c((w) => ({
      ...w,
      calculatedMeasures: (w.calculatedMeasures ?? []).filter((f) => f.id !== b),
      values: w.values.filter((f) => f.fieldId !== b)
    }));
  }, []), Z = _(() => {
    c((b) => ({
      ...b,
      options: { ...b.options, showColumnTotals: !b.options.showColumnTotals }
    }));
  }, []), G = _((b) => {
    c((w) => ({
      ...w,
      ...b,
      options: { ...w.options, ...b.options }
    }));
  }, []), X = j(
    () => {
      var b;
      return !!((b = l.current) != null && b.shouldUseWorker(t.length));
    },
    [t.length, v]
  );
  return {
    config: i,
    pivotData: m,
    isComputing: v,
    usingWorker: X,
    expandedRows: x,
    drillOpen: p,
    drillRecords: y,
    drillCell: D,
    addField: T,
    removeField: A,
    reorderFields: L,
    reorderValueFields: R,
    updateValueAggregation: S,
    setFilter: a,
    clearAllFilters: k,
    setSortBy: F,
    toggleRow: W,
    expandAll: H,
    collapseAll: P,
    resetConfig: $,
    openDrillThrough: B,
    closeDrillThrough: K,
    addCalculatedPreset: V,
    removeCalculatedMeasure: J,
    toggleColumnTotals: Z,
    updateConfig: G,
    hasData: !!(m != null && m.rows.length),
    activeFilterCount: i.filters.length
  };
}
function wr() {
  const [t, r] = I(!1), [n, o] = I(null), [l, i] = I(null), c = j(() => l ? nt(l) : null, [l]), m = j(() => {
    if (!t || !n) return c;
    const s = z().export;
    return n === "excel" ? c ?? s.exportingExcel : n === "pdf" ? c ?? s.exportingPdf : n === "html" ? c ?? s.exportingHtml : n === "csv" ? c ?? "CSV…" : z().chart.exporting;
  }, [n, c, t]), h = _(
    async (s, y) => {
      r(!0), o(s), i(null);
      try {
        return await y((E) => i(E)), !0;
      } catch {
        return !1;
      } finally {
        r(!1), o(null), i(null);
      }
    },
    []
  ), v = _(
    async (s, y) => !(s != null && s.rows.length) || t ? !1 : h(
      "excel",
      (E) => lt(s, { ...y, onProgress: E })
    ),
    [t, h]
  ), u = _(
    async (s, y) => !(s != null && s.rows.length) || t ? !1 : h(
      "pdf",
      (E) => ot(s, { ...y, onProgress: E })
    ),
    [t, h]
  ), x = _(
    async (s, y) => !(s != null && s.rows.length) || t ? !1 : h(
      "html",
      (E) => st(s, { ...y, onProgress: E })
    ),
    [t, h]
  ), d = _(
    async (s, y) => {
      if (!s || t) return !1;
      r(!0), o("chartPng"), i(null);
      try {
        return await at(s, y), !0;
      } catch {
        return !1;
      } finally {
        r(!1), o(null), i(null);
      }
    },
    [t]
  ), p = _(
    async (s, y) => {
      if (!(s != null && s.rows.length) || t) return !1;
      r(!0), o("csv"), i(null);
      try {
        return await it(s, {
          ...y,
          onProgress: (E) => i(E)
        }), !0;
      } catch {
        return !1;
      } finally {
        r(!1), o(null), i(null);
      }
    },
    [t]
  );
  return {
    exportExcel: v,
    exportPdf: u,
    exportHtml: x,
    exportChartPng: d,
    exportCsv: p,
    isExporting: t,
    exportFormat: n,
    exportProgress: l,
    exportProgressLabel: m
  };
}
const Oe = [
  {
    id: "default",
    label: "Default",
    cssVars: {
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f4f4f5",
      "--pivot-accent": "#2563eb",
      "--pivot-text": "#18181b"
    }
  },
  {
    id: "striped",
    label: "Striped",
    cssVars: {
      "--pivot-border": "#d4d4d8",
      "--pivot-surface": "#fafafa",
      "--pivot-header": "#e4e4e7",
      "--pivot-accent": "#0f766e",
      "--pivot-text": "#27272a",
      "--pivot-row-alt": "#f4f4f5"
    }
  },
  {
    id: "compact",
    label: "Compact",
    cssVars: {
      "--pivot-border": "#e4e4e7",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f8fafc",
      "--pivot-accent": "#334155",
      "--pivot-text": "#0f172a",
      "--pivot-row-height": "28px"
    }
  },
  {
    id: "heatmap",
    label: "Heatmap",
    cssVars: {
      "--pivot-border": "#e2e8f0",
      "--pivot-surface": "#ffffff",
      "--pivot-header": "#f1f5f9",
      "--pivot-accent": "#dc2626",
      "--pivot-text": "#1e293b",
      "--pivot-heat-low": "#dcfce7",
      "--pivot-heat-mid": "#fef08a",
      "--pivot-heat-high": "#fecaca"
    }
  }
];
function yr(t) {
  return Oe.find((r) => r.id === t) ?? Oe[0];
}
function $r(t) {
  const r = t.cssVars, n = r["--pivot-surface"] ?? "#ffffff", o = r["--pivot-header"] ?? "#f4f4f5", l = r["--pivot-border"] ?? "#e4e4e7", i = r["--pivot-text"] ?? "#18181b", c = r["--pivot-accent"] ?? "#2563eb", m = r["--pivot-row-alt"] ?? n, h = r["--pivot-row-height"];
  return {
    ...r,
    "--pg-border": l,
    "--pg-body-bg": n,
    "--pg-header-bg": o,
    "--pg-flat-header-bg": o,
    "--pg-header-fg": i,
    "--pg-text": i,
    "--pg-row-band": m,
    "--pg-total-bg": o,
    "--pg-col-total-bg": o,
    "--pg-grand-total-bg": l,
    "--pg-hover-bg": m,
    "--pg-gutter-bg": o,
    "--pg-gutter-fg": "#999999",
    "--pg-select-border": c,
    ...h ? { "--pg-row-height": h } : {}
  };
}
const Nr = [
  "client_name",
  "agent_name",
  "category_name",
  "product_name",
  "product_sku",
  "brand_name",
  "is_bonus",
  "bonus_qty",
  "amount",
  "qty",
  "volume",
  "order_number",
  "order_status"
], Cr = /* @__PURE__ */ new Set([
  "client_category",
  "client_zone",
  "client_region",
  "client_city",
  "agent_branch",
  "agent_code",
  "work_slot_code"
]), kr = [
  "Country",
  "Category",
  "Product",
  "Price",
  "Discount",
  "Quantity"
], Tr = 14;
function Ir(t, r, n = {}) {
  const o = n.preferred ?? kr, l = n.excluded ?? /* @__PURE__ */ new Set(), i = n.maxColumns ?? Tr, c = /* @__PURE__ */ new Set();
  for (const v of t.slice(0, 80))
    for (const u of Object.keys(v))
      l.has(u) || c.add(u);
  const m = [], h = (v) => {
    !c.has(v) || m.includes(v) || m.push(v);
  };
  n.valueFieldId && h(n.valueFieldId);
  for (const v of o) h(v);
  for (const v of r) {
    if (m.length >= i) break;
    h(v.id);
  }
  for (const v of c) {
    if (m.length >= i) break;
    h(v);
  }
  return m.slice(0, i);
}
function Vr({ data: t, fields: r, config: n, onConfigChange: o, options: l }) {
  const i = (l == null ? void 0 : l.locale) ?? "ru";
  oe(() => {
    ct(i);
  }, [i]);
  const c = z(), [m, h] = I("table"), [v, u] = I("bar"), [x, d] = I(!1), p = se(null), s = se(null), y = (l == null ? void 0 : l.drillThrough) === !0, E = yr((l == null ? void 0 : l.theme) ?? "default"), {
    config: D,
    pivotData: N,
    isComputing: M,
    expandedRows: T,
    addField: A,
    removeField: S,
    reorderFields: L,
    reorderValueFields: R,
    updateValueAggregation: a,
    setFilter: k,
    toggleRow: F,
    expandAll: W,
    collapseAll: H,
    resetConfig: P,
    setSortBy: $,
    drillOpen: B,
    drillRecords: K,
    drillCell: V,
    openDrillThrough: J,
    closeDrillThrough: Z,
    addCalculatedPreset: G,
    removeCalculatedMeasure: X,
    activeFilterCount: U,
    clearAllFilters: ee,
    toggleColumnTotals: ce
  } = vr(t, r, {
    initialConfig: {
      ...n,
      options: {
        showSubtotals: !0,
        showGrandTotal: !0,
        showColumnTotals: !1,
        compactMode: !1,
        drillDown: !0,
        ...n == null ? void 0 : n.options,
        drillThrough: y
      }
    },
    useWorker: l == null ? void 0 : l.useWorker,
    workerThreshold: l == null ? void 0 : l.workerThreshold
  });
  oe(() => {
    o == null || o(D);
  }, [D, o]);
  const ae = j(
    () => ({
      ...D,
      options: { ...D.options, drillThrough: y }
    }),
    [D, y]
  ), { exportExcel: b, exportPdf: w, exportHtml: f, exportChartPng: C, exportCsv: O, isExporting: Q, exportFormat: de } = wr(), te = j(() => N ? dt(N) : null, [N]), Ve = !!(N && te && ut(te)), ue = _(() => {
    if (!N) return !1;
    if (!mt(N, { expandedRows: T, sourceRowCount: t.length })) return !0;
    const Y = ht(N, { expandedRows: T });
    return window.confirm(z().export.confirmLargeExport(Y));
  }, [N, T, t.length]), He = j(() => {
    var ie;
    return ((l == null ? void 0 : l.drillColumnIds) ?? Ir(K, r, {
      preferred: Nr,
      excluded: Cr,
      valueFieldId: (ie = V == null ? void 0 : V.drillContext) == null ? void 0 : ie.valueFieldId
    })).map(
      (re) => r.find((We) => We.id === re) ?? { id: re, label: re, dataType: "string" }
    );
  }, [l == null ? void 0 : l.drillColumnIds, K, r, V]);
  return /* @__PURE__ */ g(
    "div",
    {
      ref: p,
      className: q("salec-pivot-app flex min-h-[480px] flex-col gap-3 p-3", l == null ? void 0 : l.className),
      style: { ...E.cssVars, ...l == null ? void 0 : l.style },
      "data-theme": (l == null ? void 0 : l.theme) ?? "default",
      children: [
        /* @__PURE__ */ e(
          gr,
          {
            viewMode: m,
            onViewModeChange: h,
            onExpandAll: W,
            onCollapseAll: H,
            onReset: P,
            onExportExcel: () => {
              ue() && b(N, { expandedRows: T });
            },
            onExportPdf: () => {
              ue() && w(N, { expandedRows: T });
            },
            onExportHtml: () => {
              ue() && f(N, { expandedRows: T });
            },
            onExportChartPng: () => void C(s.current),
            onExportCsv: () => {
              ue() && O(N, { expandedRows: T });
            },
            exportDisabled: !N,
            chartExportDisabled: !Ve || m !== "chart",
            isExporting: Q,
            exportingFormat: de,
            activeFilterCount: U,
            onClearFilters: ee,
            showColumnTotals: D.options.showColumnTotals,
            onToggleColumnTotals: ce,
            isFullscreen: x,
            onToggleFullscreen: () => {
              var ie, re;
              const Y = p.current;
              Y && (document.fullscreenElement ? ((re = document.exitFullscreen) == null || re.call(document), d(!1)) : ((ie = Y.requestFullscreen) == null || ie.call(Y), d(!0)));
            }
          }
        ),
        /* @__PURE__ */ g("div", { className: "grid flex-1 gap-3 lg:grid-cols-[280px_1fr] pivot-mobile-stack", children: [
          /* @__PURE__ */ e(
            ir,
            {
              fields: r,
              config: ae,
              rawData: t,
              onAddField: A,
              onRemoveField: S,
              onUpdateAggregation: a,
              onSetFilter: k,
              onAddCalculatedPreset: G,
              onRemoveCalculatedMeasure: X,
              onReorderFields: L,
              onReorderValueFields: R
            }
          ),
          /* @__PURE__ */ g("div", { className: "min-h-0 min-w-0 overflow-x-auto overflow-y-auto rounded-lg border border-[var(--pivot-border,#e4e4e7)] bg-[var(--pivot-surface,#fff)]", children: [
            m === "table" && N ? /* @__PURE__ */ e(
              pr,
              {
                data: N,
                config: ae,
                expandedRows: T,
                onToggleRow: F,
                onSort: $,
                onCellDoubleClick: y ? J : void 0,
                className: "max-h-[70vh]"
              }
            ) : null,
            m === "chart" && te ? /* @__PURE__ */ e("div", { ref: s, className: "p-3", children: /* @__PURE__ */ e(cr, { data: te, chartType: v, onChartTypeChange: u }) }) : null,
            !N && !M ? /* @__PURE__ */ e("p", { className: "p-6 text-sm text-zinc-500", children: c.reportBuilder.dragMetricHint }) : null,
            M ? /* @__PURE__ */ e("p", { className: "p-4 text-xs text-zinc-500", children: c.reportBuilder.computing }) : null
          ] })
        ] }),
        y ? /* @__PURE__ */ e(
          dr,
          {
            open: B,
            records: K,
            fields: He,
            cellContext: V == null ? void 0 : V.drillContext,
            onClose: Z
          }
        ) : null,
        N && te ? /* @__PURE__ */ e("p", { className: "sr-only", children: [
          ...pt(N, { expandedRows: T, sourceRowCount: t.length }),
          ...bt(N, te, t.length)
        ].join(" ") }) : null
      ]
    }
  );
}
const _r = [
  {
    type: "gt",
    threshold: 35e4,
    backgroundColor: "#0598df",
    textColor: "#ffffff"
  },
  {
    type: "gt",
    threshold: 1e3,
    backgroundColor: "#f45328",
    textColor: "#ffffff"
  },
  {
    type: "negative",
    backgroundColor: "#fee2e2",
    textColor: "#b91c1c"
  }
];
function Hr(t = []) {
  return [..._r.map((n, o) => ({
    ...n,
    id: n.id ?? `heatmap-preset-${o}`
  })), ...t];
}
export {
  Yt as F,
  kr as G,
  _r as H,
  Oe as P,
  Cr as S,
  Vr as a,
  ir as b,
  cr as c,
  dr as d,
  pr as e,
  gr as f,
  Nr as g,
  q as h,
  yr as i,
  vr as j,
  wr as k,
  $r as p,
  Ir as r,
  er as u,
  Hr as w
};
//# sourceMappingURL=heatmapPresets-DO2sRzdC.js.map
