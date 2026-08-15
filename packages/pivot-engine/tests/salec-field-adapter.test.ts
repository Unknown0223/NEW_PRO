import { describe, expect, it } from "vitest";
import { salecFieldsToPivotFields, normalizeSalecDatasetRows } from "../src/adapters/salec-field-adapter.js";

describe("salec-field-adapter", () => {
  it("akb → client_id maydoni", () => {
    const fields = salecFieldsToPivotFields(
      [{ id: "warehouse_name", label: "Ombor" }],
      [{ id: "akb", label: "AKB" }]
    );
    const akb = fields.find((f) => f.id === "client_id");
    expect(akb?.label).toBe("AKB");
    expect(akb?.dataType).toBe("number");
  });

  it("sana maydonlari — date tipi", () => {
    const fields = salecFieldsToPivotFields([{ id: "order_date", label: "Sana" }]);
    expect(fields[0]?.dataType).toBe("date");
    expect(salecFieldsToPivotFields([{ id: "shipped_at", label: "Yuborilgan" }])[0]?.dataType).toBe("date");
  });

  it("yil/oy/kun — number tipi", () => {
    expect(salecFieldsToPivotFields([{ id: "order_date_year", label: "Yil" }])[0]?.dataType).toBe("number");
  });

  it("normalizeSalecDatasetRows — sana parse", () => {
    const rows = normalizeSalecDatasetRows([{ order_date: "2026-01-15", amount: 100 }]);
    expect(rows[0]?.order_date).toBeInstanceOf(Date);
  });

  it("normalizeSalecDatasetRows — _at va bo'sh string", () => {
    const rows = normalizeSalecDatasetRows([
      { shipped_at: "2026-02-01T10:00:00Z", client_id: "", amount: "1500.5", qty: null }
    ]);
    expect(rows[0]?.shipped_at).toBeInstanceOf(Date);
    expect(rows[0]?.client_id).toBeNull();
    expect(rows[0]?.amount).toBe(1500.5);
    expect(rows[0]?.qty).toBeNull();
  });
});
