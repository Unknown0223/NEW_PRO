"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Employee = { id: string; fullName: string };
type AttendanceRow = {
  id: string;
  type: string;
  method: string;
  isAnomaly: boolean;
  note: string | null;
  createdAt: string;
  employeeId: string;
  employeeName: string | null;
};

export default function AttendancePage() {
  const [items, setItems] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<"check_in" | "check_out">("check_in");
  const [method, setMethod] = useState<"manual" | "qr">("manual");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = filterEmployeeId ? `?employeeId=${filterEmployeeId}` : "";
    const [attRes, empRes] = await Promise.all([
      fetch(`/api/attendance${qs}`),
      fetch("/api/employees?pageSize=100"),
    ]);
    if (!attRes.ok) {
      setError("Davomat yuklanmadi");
      setLoading(false);
      return;
    }
    const attData = await attRes.json();
    const empData = empRes.ok ? await empRes.json() : { items: [] };
    setItems(attData.items ?? []);
    setEmployees(
      (empData.items ?? []).map((e: { id: string; fullName: string }) => ({
        id: e.id,
        fullName: e.fullName,
      }))
    );
    setLoading(false);
  }, [filterEmployeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!employeeId) {
      setError("Xodimni tanlang");
      return;
    }
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        type,
        method,
        note: note || null,
        location: { source: "web", method },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Yozib bo‘lmadi");
      return;
    }
    setNote("");
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Davomat</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Check-in / check-out (manual yoki QR). Face / geofence — keyinroq.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-4 grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <select
          required
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
        >
          <option value="">Xodim…</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as "check_in" | "check_out")}
        >
          <option value="check_in">check_in</option>
          <option value="check_out">check_out</option>
        </select>
        <select
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          value={method}
          onChange={(e) => setMethod(e.target.value as "manual" | "qr")}
        >
          <option value="manual">manual</option>
          <option value="qr">qr</option>
        </select>
        <input
          className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
          placeholder="Izoh (ixtiyoriy)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm text-white">
          Yozish
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-[var(--warn)]">{error}</p> : null}

      <div className="mt-4 flex gap-2">
        <select
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          value={filterEmployeeId}
          onChange={(e) => setFilterEmployeeId(e.target.value)}
        >
          <option value="">Barcha xodimlar</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Vaqt</th>
              <th className="px-3 py-2 font-medium">Xodim</th>
              <th className="px-3 py-2 font-medium">Tur</th>
              <th className="px-3 py-2 font-medium">Usul</th>
              <th className="px-3 py-2 font-medium">Izoh</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                  Yuklanmoqda…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)]">
                  Yozuvlar yo‘q
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{row.employeeName ?? "—"}</td>
                  <td className="px-3 py-2.5">{row.type}</td>
                  <td className="px-3 py-2.5">{row.method}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{row.note ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
