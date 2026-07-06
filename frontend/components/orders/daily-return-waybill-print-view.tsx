"use client";

/**
 * Kunlik YAXLIT qaytarish nakladnoyi — chop etish (PDF) ko'rinishi.
 *
 * Bitta dastavchik bo'yicha, aynan shu kunga tegishli barcha qaytarishlar
 * mahsulot bo'yicha yaxlitlanib chiqadi. Summa/narx/bonus ko'rsatilmaydi —
 * faqat «№ / Kod / Mahsulot / Miqdor». Brauzer chop etish oynasidan
 * «Сохранить как PDF» orqali PDF olinadi.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Line = {
  product_id: number;
  sku: string;
  name: string;
  qty: string;
  category_name?: string | null;
};

type Detail = {
  courier_name: string | null;
  date: string;
  warehouse_name: string;
  total_qty: number;
  return_count?: number;
  lines: Line[];
};

function fmtQty(n: string | number): string {
  const v = typeof n === "number" ? n : Number.parseFloat(n);
  if (!Number.isFinite(v)) return String(n);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
}

export function DailyReturnWaybillPrintView({
  detail,
  onClose
}: {
  detail: Detail;
  onClose: () => void;
}) {
  useEffect(() => {
    document.body.setAttribute("data-return-print", "1");
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    const t = window.setTimeout(() => window.print(), 350);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.body.removeAttribute("data-return-print");
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const dateLabel = new Date(`${detail.date}T00:00:00`).toLocaleDateString("ru-RU");

  const overlay = (
    <div className="fixed inset-0 z-[10300] overflow-auto bg-white p-4">
      <div className="no-print mb-4 flex items-center gap-3 border-b border-neutral-200 pb-3">
        <button
          type="button"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm"
          onClick={onClose}
        >
          Закрыть
        </button>
        <button
          type="button"
          className="rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white hover:bg-teal-800"
          onClick={() => window.print()}
        >
          Печать / PDF
        </button>
      </div>

      <div className="print-only" style={{ padding: "20px", fontFamily: "Arial, sans-serif", color: "#111" }}>
        <style>{`
          @page { size: A4; margin: 10mm; }
          @media print {
            body * { visibility: hidden; }
            .print-only, .print-only * { visibility: visible; }
            .print-only { position: absolute; left: 0; top: 0; width: 100%; }
            .no-print { display: none !important; }
          }
          @media screen {
            .print-only {
              max-width: 760px;
              margin: 0 auto;
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            }
          }
        `}</style>

        <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #333", paddingBottom: "14px" }}>
          <h1 style={{ margin: 0, fontSize: "19px", fontWeight: "bold" }}>ВОЗВРАТНАЯ НАКЛАДНАЯ (СВОДНАЯ)</h1>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#888" }}>
            Kunlik yaxlit qaytarish nakladnoyi
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#444" }}>
            Sana: <strong>{dateLabel}</strong>
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>
              Экспедитор / Создатель
            </h3>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{detail.courier_name ?? "—"}</p>
          </div>
          <div>
            <h3 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Детали</h3>
            <p style={{ margin: 0, fontSize: "12px" }}>Склад: {detail.warehouse_name || "—"}</p>
            {typeof detail.return_count === "number" && (
              <p style={{ margin: "2px 0 0", fontSize: "12px" }}>Возвратов в документе: {detail.return_count}</p>
            )}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "24px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333" }}>
              <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold", width: "40px" }}>№</th>
              <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Kod</th>
              <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Mahsulot</th>
              <th style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>Miqdor</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              let prevCat: string | null | undefined = Symbol("init") as unknown as string;
              let n = 0;
              const out: JSX.Element[] = [];
              for (const line of detail.lines) {
                const cat = line.category_name ?? "Без категории";
                if (cat !== prevCat) {
                  prevCat = cat;
                  out.push(
                    <tr key={`cat-${cat}`} style={{ background: "#f3f4f6" }}>
                      <td
                        colSpan={4}
                        style={{ padding: "5px 8px", fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", color: "#374151" }}
                      >
                        {cat}
                      </td>
                    </tr>
                  );
                }
                n += 1;
                out.push(
                  <tr key={line.product_id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 8px" }}>{n}</td>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{line.sku}</td>
                    <td style={{ padding: "6px 8px" }}>{line.name}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>{fmtQty(line.qty)}</td>
                  </tr>
                );
              }
              if (out.length === 0) {
                out.push(
                  <tr key="empty">
                    <td colSpan={4} style={{ padding: "12px 8px", textAlign: "center", color: "#888" }}>
                      Mahsulotlar yo‘q
                    </td>
                  </tr>
                );
              }
              return out;
            })()}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #333" }}>
              <td colSpan={2} style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>JAMI:</td>
              <td style={{ padding: "8px", textAlign: "right", color: "#666" }}>{detail.lines.length} ta nom</td>
              <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
                {fmtQty(detail.total_qty)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px", marginTop: "48px", fontSize: "12px" }}>
          <div>
            <div style={{ borderTop: "1px solid #333", paddingTop: "6px" }}>Topshirdi (ekspeditor)</div>
          </div>
          <div>
            <div style={{ borderTop: "1px solid #333", paddingTop: "6px" }}>Qabul qildi (ombor / зав.склад)</div>
          </div>
        </div>

        <div style={{ marginTop: "28px", borderTop: "1px solid #ddd", paddingTop: "12px", fontSize: "11px", color: "#888", textAlign: "center" }}>
          <p style={{ margin: 0 }}>Chop etilgan sana: {new Date().toLocaleString("ru-RU")}</p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
