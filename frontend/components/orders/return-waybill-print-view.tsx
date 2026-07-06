"use client";

/**
 * Qaytarish (возврат) nakladnoyi — chop etish ko'rinishi.
 *
 * MUHIM: bu yerda summa / narx / bonus-savdo ajratmasi KO'RSATILMAYDI.
 * Dastavchik ombordagi zavskladga umumiy qaytaradigan mahsulot MIQDORLARINI
 * topshiradi — shuning uchun faqat «№ / Kod / Mahsulot / Miqdor» ustunlari.
 */

type ReturnLine = {
  id: number;
  product_sku: string;
  product_name: string;
  /** Umumiy qaytariladigan miqdor (pullik + bonus birlashgan). */
  qty: string;
};

type ReturnWaybill = {
  number: string;
  status: string;
  created_at: string;
  client_name: string | null;
  order_number: string | null;
  warehouse_name: string;
  expeditor_name?: string | null;
  note?: string | null;
};

function fmtQty(n: string): string {
  const v = Number.parseFloat(n);
  if (!Number.isFinite(v)) return n;
  // Butun bo'lsa kasrsiz, aks holda 3 xonagacha.
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, "");
}

export function ReturnWaybillPrintView({
  doc,
  lines
}: {
  doc: ReturnWaybill;
  lines: ReturnLine[];
}) {
  const totalQty = lines.reduce((acc, l) => acc + (Number.parseFloat(l.qty) || 0), 0);

  return (
    <div className="print-only" style={{ padding: "20px", fontFamily: "Arial, sans-serif", color: "#111" }}>
      <style>{`
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

      {/* Sarlavha */}
      <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #333", paddingBottom: "14px" }}>
        <h1 style={{ margin: 0, fontSize: "19px", fontWeight: "bold" }}>ВОЗВРАТНАЯ НАКЛАДНАЯ</h1>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#888" }}>Qaytarish nakladnoyi</p>
        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#444" }}>
          № <strong>{doc.number}</strong> &nbsp;|&nbsp; Sana:{" "}
          <strong>{new Date(doc.created_at).toLocaleDateString("ru-RU")}</strong>
        </p>
      </div>

      {/* Tafsilotlar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Клиент</h3>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{doc.client_name ?? "—"}</p>
          {doc.order_number && (
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#666" }}>По заказу: {doc.order_number}</p>
          )}
        </div>
        <div>
          <h3 style={{ margin: "0 0 6px", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Детали</h3>
          <p style={{ margin: 0, fontSize: "12px" }}>Склад: {doc.warehouse_name}</p>
          {doc.expeditor_name && (
            <p style={{ margin: "2px 0 0", fontSize: "12px" }}>Экспедитор: {doc.expeditor_name}</p>
          )}
          {doc.note && (
            <p style={{ margin: "2px 0 0", fontSize: "12px", fontStyle: "italic" }}>Izoh: {doc.note}</p>
          )}
        </div>
      </div>

      {/* Mahsulotlar jadvali — faqat miqdor */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "24px" }}>
        <thead className="app-table-thead">
          <tr style={{ borderBottom: "2px solid #333" }}>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold", width: "40px" }}>№</th>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Kod</th>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Mahsulot</th>
            <th style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>Miqdor</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={line.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 8px" }}>{i + 1}</td>
              <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{line.product_sku}</td>
              <td style={{ padding: "6px 8px" }}>{line.product_name}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>{fmtQty(line.qty)}</td>
            </tr>
          ))}
          {lines.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "12px 8px", textAlign: "center", color: "#888" }}>
                Mahsulotlar yo‘q
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #333" }}>
            <td colSpan={2} style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>JAMI:</td>
            <td style={{ padding: "8px", textAlign: "right", color: "#666" }}>{lines.length} ta nom</td>
            <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>
              {fmtQty(String(totalQty))}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Imzolar */}
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
  );
}
