"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Dept = { id: string; name: string; createdAt: string };

export default function DepartmentsPage() {
  const [items, setItems] = useState<Dept[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/departments");
    if (!res.ok) {
      setError("Yuklash xatosi");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Yaratib bo‘lmadi");
      return;
    }
    setName("");
    await load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Bo‘limlar</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Tashkiliy tuzilma</p>

      <form onSubmit={onCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Yangi bo‘lim nomi"
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm text-white">
          Qo‘shish
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-[var(--warn)]">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Nomi</th>
              <th className="px-3 py-2 font-medium">Yaratilgan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-[var(--muted)]">
                  Yuklanmoqda…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-3 py-8 text-center text-[var(--muted)]">
                  Bo‘limlar yo‘q
                </td>
              </tr>
            ) : (
              items.map((d) => (
                <tr key={d.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5 font-medium">{d.name}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
