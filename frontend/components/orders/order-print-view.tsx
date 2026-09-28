"use client";

import { formatNumberGrouped } from "@/lib/format-numbers";

type PrintOrderProps = {
  order: {
    id: number;
    number: string;
    status: string;
    total_sum: string;
    bonus_sum: string;
    comment: string | null;
    created_at: string;
    client_name: string;
    client_address: string | null;
    client_phone: string | null;
    client_inn: string | null;
    warehouse_name: string | null;
    agent_name: string | null;
  };
  items: Array<{
    id: number;
    sku: string;
    name: string;
    unit: string;
    qty: string;
    price: string;
    total: string;
    is_bonus: boolean;
  }>;
};

function fmt(n: string | number) {
  return formatNumberGrouped(n, { minFractionDigits: 2, maxFractionDigits: 2 });
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: "Новый",
    confirmed: "Подтверждён",
    picking: "Комплектация",
    delivering: "Доставка",
    delivered: "Доставлен",
    cancelled: "Отменён"
  };
  return map[status] ?? status;
}

export function OrderPrintView({ order, items }: PrintOrderProps) {
  return (
    <div className="print-only" style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        @media screen {
          .print-only {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px", borderBottom: "2px solid #333", paddingBottom: "16px" }}>
        <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "bold" }}>СЧЁТ / ЗАКАЗ</h1>
        <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#666" }}>
          Номер: <strong>{order.number}</strong> &nbsp;|&nbsp; Дата: <strong>{new Date(order.created_at).toLocaleDateString("ru-RU")}</strong>
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#888" }}>
          Статус: {statusLabel(order.status)}
        </p>
      </div>

      {/* Client & Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h3 style={{ margin: "0 0 8px", fontSize: "13px", color: "#666", textTransform: "uppercase" }}>Клиент</h3>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: "bold" }}>{order.client_name}</p>
          {order.client_address && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#666" }}>{order.client_address}</p>}
          {order.client_phone && <p style={{ margin: "2px 0 0", fontSize: "12px" }}>Тел.: {order.client_phone}</p>}
          {order.client_inn && <p style={{ margin: "2px 0 0", fontSize: "12px" }}>ИНН: {order.client_inn}</p>}
        </div>
        <div>
          <h3 style={{ margin: "0 0 8px", fontSize: "13px", color: "#666", textTransform: "uppercase" }}>Детали</h3>
          {order.warehouse_name && <p style={{ margin: 0, fontSize: "12px" }}>Склад: {order.warehouse_name}</p>}
          {order.agent_name && <p style={{ margin: "2px 0 0", fontSize: "12px" }}>Агент: {order.agent_name}</p>}
          <p style={{ margin: "2px 0 0", fontSize: "12px" }}>ID заказа: #{order.id}</p>
          {order.comment && <p style={{ margin: "2px 0 0", fontSize: "12px", fontStyle: "italic" }}>Комментарий: {order.comment}</p>}
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "24px" }}>
        <thead className="app-table-thead">
          <tr style={{ borderBottom: "2px solid #333" }}>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>#</th>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Код</th>
            <th style={{ padding: "8px", textAlign: "left", fontWeight: "bold" }}>Товар</th>
            <th style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>Количество</th>
            <th style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>Цена</th>
            <th style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 8px" }}>{i + 1}</td>
              <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>{item.sku}</td>
              <td style={{ padding: "6px 8px" }}>
                {item.name}
                {item.is_bonus && (
                  <span style={{ marginLeft: "4px", padding: "1px 6px", background: "#fef3c7", borderRadius: "4px", fontSize: "10px" }}>
                    БОНУС
                  </span>
                )}
              </td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{parseFloat(item.qty).toFixed(3)} {item.unit}</td>
              <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt(item.price)}</td>
              <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>{fmt(item.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid #333" }}>
            <td colSpan={4} style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>ИТОГО:</td>
            <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold" }}>{items.length} поз.</td>
            <td style={{ padding: "8px", textAlign: "right", fontWeight: "bold", fontSize: "14px" }}>{fmt(order.total_sum)} сум</td>
          </tr>
          {parseFloat(order.bonus_sum) > 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "4px 8px", textAlign: "right", color: "#666" }}>Сумма бонуса:</td>
              <td style={{ padding: "4px 8px", textAlign: "right", color: "#666" }}>{fmt(order.bonus_sum)} сум</td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ marginTop: "40px", borderTop: "1px solid #ddd", paddingTop: "16px", fontSize: "11px", color: "#888", textAlign: "center" }}>
        <p style={{ margin: 0 }}>Документ сформирован и подписан в электронном виде.</p>
        <p style={{ margin: "4px 0 0" }}>Дата печати: {new Date().toLocaleString("ru-RU")}</p>
      </div>
    </div>
  );
}
