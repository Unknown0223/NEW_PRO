"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@demo.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kirish amalga oshmadi");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-8 shadow-sm"
      >
        <div className="mb-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)] text-white font-bold">
            HR
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">HR Hub</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Mustaqil kadrlar platformasi — SALEC Arena dan alohida
          </p>
        </div>

        <label className="block text-sm mb-3">
          <span className="text-[var(--muted)]">Email</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </label>
        <label className="block text-sm mb-4">
          <span className="text-[var(--muted)]">Parol</span>
          <input
            className="mt-1 w-full rounded-xl border border-[var(--line)] px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>

        {error ? <p className="mb-3 text-sm text-[var(--warn)]">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-white font-medium disabled:opacity-60"
        >
          {loading ? "Kirilmoqda…" : "Kirish"}
        </button>

        <p className="mt-4 text-xs text-[var(--muted)]">
          Demo: admin@demo.local / admin123
        </p>
      </form>
    </main>
  );
}
