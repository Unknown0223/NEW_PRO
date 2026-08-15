"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Dept = { id: string; name: string };
type EmployeeRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  position: string;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  hiredAt: string | null;
};

export default function EmployeesPage() {
  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    departmentId: "",
    status: "active",
  });

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (departmentId) p.set("departmentId", departmentId);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [q, status, departmentId, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch(`/api/employees?${query}`),
        fetch("/api/departments"),
      ]);
      if (!empRes.ok) throw new Error("Xodimlarni yuklashda xato");
      const empData = await empRes.json();
      const deptData = deptRes.ok ? await deptRes.json() : { items: [] };
      setItems(empData.items ?? []);
      setTotal(empData.total ?? 0);
      setDepartments(deptData.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        phone: form.phone || null,
        departmentId: form.departmentId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Yaratib bo‘lmadi");
      return;
    }
    setShowForm(false);
    setForm({
      fullName: "",
      email: "",
      phone: "",
      position: "",
      departmentId: "",
      status: "active",
    });
    setPage(1);
    await load();
  }

  function exportCsv() {
    const p = new URLSearchParams(query);
    p.set("format", "csv");
    p.set("pageSize", "100");
    window.open(`/api/employees?${p.toString()}`, "_blank");
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Xodimlar</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Filter, sahifalash, CSV export</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm text-white"
          >
            {showForm ? "Yopish" : "Yangi xodim"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <input
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          placeholder="Qidiruv…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <select
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">Barcha status</option>
          <option value="active">active</option>
          <option value="onboarding">onboarding</option>
          <option value="on_vacation">on_vacation</option>
          <option value="candidate">candidate</option>
          <option value="terminated">terminated</option>
        </select>
        <select
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
          value={departmentId}
          onChange={(e) => {
            setPage(1);
            setDepartmentId(e.target.value);
          }}
        >
          <option value="">Barcha bo‘limlar</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
          Jami: {total}
        </div>
      </div>

      {showForm ? (
        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-2 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-2"
        >
          <input
            required
            placeholder="F.I.Sh"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <input
            required
            type="email"
            placeholder="Email"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Telefon"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            required
            placeholder="Lavozim"
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
          <select
            className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          >
            <option value="">Bo‘limsiz</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm text-white">
            Saqlash
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-[var(--warn)]">{error}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">F.I.Sh</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Lavozim</th>
              <th className="px-3 py-2 font-medium">Bo‘lim</th>
              <th className="px-3 py-2 font-medium">Status</th>
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
                  Xodimlar yo‘q
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5 font-medium">{row.fullName}</td>
                  <td className="px-3 py-2.5">{row.email}</td>
                  <td className="px-3 py-2.5">{row.position}</td>
                  <td className="px-3 py-2.5">{row.departmentName ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs text-[var(--accent)]">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <button
          type="button"
          disabled={page <= 1}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Oldingi
        </button>
        <span className="text-[var(--muted)]">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          className="rounded-lg border border-[var(--line)] px-3 py-1.5 disabled:opacity-40"
          onClick={() => setPage((p) => p + 1)}
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}
