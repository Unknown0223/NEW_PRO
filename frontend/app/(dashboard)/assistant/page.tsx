"use client";

import { FormEvent, useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageShell } from "@/components/dashboard/page-shell";

type Group = { title: string; summary: string; columns: string[]; rows: string[][] };
type Answer = { title: string; lines: string[]; groups?: Group[] };
type Turn = { role: "user" | "assistant"; text: string; groups?: Group[] };

const HINTS = [
  "Nechta foydalanuvchi bor?",
  "Bugungi umumiy holat",
  "1-oktabrdan 10-oktabrgacha savdo",
  "Oxirgi buyurtmalar",
  "Qarzlar ro'yxati",
  "Mijozlarni ko'rsat"
];

export default function AssistantPage() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const q = text.trim();
    if (!slug || !q || busy) return;
    setQuestion("");
    setError("");
    setBusy(true);
    setTurns((prev) => [...prev, { role: "user", text: q }]);
    try {
      const res = await api.post<Answer>(`/api/${slug}/local-assistant/ask`, {
        question: q,
        history: turns.slice(-6).map((turn) => ({ role: turn.role, text: turn.text }))
      });
      const body = [res.data.title, ...res.data.lines].filter(Boolean).join("\n");
      setTurns((prev) => [...prev, { role: "assistant", text: body, groups: res.data.groups }]);
    } catch {
      setError("Javob olinmadi. LM Studio ochiqligini va qwen3 yuklanganini tekshiring.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <PageShell>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Помощник</h1>
            <p className="text-sm text-muted-foreground">Tizim bo'yicha savol bering. Javob shu diler ma'lumotidan olinadi.</p>
          </div>
        </div>

        <div className="flex max-h-[68vh] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border bg-card p-4">
          {turns.length === 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => void ask(hint)}
                  className="rounded-xl border bg-background px-3 py-3 text-left text-sm hover:bg-muted"
                >
                  {hint}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-3">
              {turns.map((turn, index) => (
                <div
                  key={`${turn.role}-${index}`}
                  className={
                    turn.role === "user"
                      ? "ml-auto max-w-[80%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "w-full rounded-2xl border bg-background p-3 text-sm"
                  }
                >
                  {turn.role === "assistant" && turn.groups?.length ? (
                    <div className="grid gap-3">
                      {turn.groups.map((group) => (
                        <div key={group.title}>
                          <div className="mb-2 flex items-baseline justify-between gap-2">
                            <p className="font-semibold">{group.title}</p>
                            <p className="text-xs text-muted-foreground">{group.summary}</p>
                          </div>
                          {group.rows.length ? (
                            <div className="overflow-x-auto rounded-lg border">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/70">
                                  <tr>
                                    {group.columns.map((column) => (
                                      <th key={column} className="px-2 py-2 font-medium">{column}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((row, rowIndex) => (
                                    <tr key={rowIndex} className="border-t">
                                      {row.map((cell, cellIndex) => (
                                        <td key={cellIndex} className="px-2 py-1.5 align-top">{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">{group.summary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                  )}
                </div>
              ))}
              {busy ? <p className="text-sm text-muted-foreground">Ma'lumot olinmoqda...</p> : null}
            </div>
          )}
        </div>

        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Savol yozing..."
            className="h-11 flex-1 rounded-xl border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Yuborish
          </button>
        </form>
      </div>
    </PageShell>
  );
}
