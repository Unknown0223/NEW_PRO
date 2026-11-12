"use client";

import { FormEvent, useState, useCallback } from "react";
import { Sparkles, RefreshCw, Download, ShieldAlert, Mail, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { PageShell } from "@/components/dashboard/page-shell";

type AiTableResult = {
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  truncated?: boolean;
};
type AiAction = {
  kind: "confirm";
  tool: string;
  token: string;
  title: string;
  summary: string;
  columns: string[];
  rows: string[][];
  expiresAt: string;
};
type AiExportLink = { format: "xlsx" | "csv"; url: string; rows: number; truncated: boolean };
type AiDenied = { tool: string; reason: string };
type Answer = {
  title: string;
  intent: string;
  summary: string[];
  lines: string[];
  groups?: AiTableResult[];
  actions?: AiAction[];
  export?: AiExportLink;
  denied?: AiDenied[];
  meta?: { tools: string[]; durationMs: number; period?: { from?: string; to?: string }; truncated: boolean };
};
type Turn = {
  role: "user" | "assistant";
  text: string;
  groups?: AiTableResult[];
  actions?: AiAction[];
  export?: AiExportLink;
  denied?: AiDenied[];
};

const HINTS = [
  "Umumiy holat: savdo, qarz, kassa",
  "Bugun savdo qancha bo‘ldi?",
  "Shu oy savdo va top agentlar",
  "Qarzdorlar ro‘yxati Excelda",
  "Oxirgi 7 kun to‘lovlar",
  "Rasxodlar va foyda shu oy",
  "Ombordagi qoldiq",
  "Agentlar ro‘yxati",
  "Ish haqi shu oy",
  "SKU-001 narxini 150000 qil"
];

export default function AssistantPage() {
  const slug = useAuthStore((s) => s.tenantSlug);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPending, setConfirmPending] = useState<AiAction | null>(null);

  const ask = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!slug || !q || busy) return;
      setQuestion("");
      setError("");
      setConfirmPending(null);
      setBusy(true);
      setTurns((prev) => [...prev, { role: "user", text: q }]);
      try {
        const res = await api.post<Answer>(`/api/${slug}/ai/ask`, {
          question: q
        });
        const data = res.data;
        const body = [data.title, ...data.summary, ...data.lines].filter(Boolean).join("\n");
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            text: body,
            groups: data.groups,
            actions: data.actions,
            export: data.export,
            denied: data.denied
          }
        ]);
        if (data.actions?.length && !data.denied?.length) {
          setConfirmPending(data.actions[0]);
        }
      } catch {
        setError("Javob olinmadi. Server va AI kalitini tekshiring.");
      } finally {
        setBusy(false);
      }
    },
    [slug, busy]
  );

  async function confirmAction() {
    if (!confirmPending || !slug) return;
    setBusy(true);
    try {
      const res = await api.post<Answer>(`/api/${slug}/ai/confirm`, {
        token: confirmPending.token
      });
      const data = res.data;
      const body = [data.title, ...data.summary, ...data.lines].filter(Boolean).join("\n");
      setTurns((prev) => [
        ...prev,
        { role: "assistant", text: body, groups: data.groups, denied: data.denied }
      ]);
      setConfirmPending(null);
    } catch {
      setError("Tasdiqlash bajarilmadi. Qaytadan urinib ko‘ring.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  function renderDenied(denied?: AiDenied[]) {
    if (!denied?.length) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className="size-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold">Ruxsat cheklanishi mumkin:</p>
            <ul className="list-disc list-inside mt-1 text-xs">
              {denied.map((d) => (
                <li key={d.tool}>{d.tool}: {d.reason}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  function renderTable(group: AiTableResult) {
    return (
      <div key={group.title} className="overflow-x-auto rounded-lg border bg-background">
        <div className="p-3 border-b">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-semibold">{group.title}</p>
            <p className="text-xs text-muted-foreground">{group.summary}</p>
          </div>
        </div>
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
        {group.truncated ? (
          <p className="text-xs text-muted-foreground p-3">
            Qatorlar cheklangan. To‘liq ma’lumot uchun eksportdan foydalaning.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">AI Yordamchi</h1>
            <p className="text-sm text-muted-foreground">
              Tizim bo‘yicha savol bering. Javob sizning ruxsatingizga tegishli ma’lumotdan olinadi.
            </p>
          </div>
        </div>

        {confirmPending && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mb-3">
            <div className="flex items-start gap-3">
              <Mail className="size-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-semibold">{confirmPending.title}</p>
                <p className="text-sm text-blue-700">{confirmPending.summary}</p>
                {confirmPending.rows?.length ? (
                  <div className="mt-2 overflow-x-auto rounded-lg border border-blue-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-blue-50/50">
                        <tr>
                          {confirmPending.columns.map((c) => (
                            <th key={c} className="px-2 py-1 font-medium text-blue-900">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confirmPending.rows.map((row, i) => (
                          <tr key={i} className="border-t">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <p className="text-xs text-blue-600 mt-2">
                  Eslatma: amal faqat bitta martalik bajariladi va sizning ruxsatingiz bo‘yicha tekshiriladi.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={confirmAction}
                disabled={busy}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Tasdiqlash
              </button>
              <button
                onClick={() => setConfirmPending(null)}
                className="rounded-xl bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        )}

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
                  {turn.role === "assistant" && (
                    <>
                      {renderDenied(turn.denied)}
                      {turn.text ? <p className="whitespace-pre-wrap mb-3">{turn.text}</p> : null}
                      {turn.groups?.length ? (
                        <div className="grid gap-3">{turn.groups.map(renderTable)}</div>
                      ) : null}
                      {turn.export ? (
                        <div className="mt-2 flex items-center gap-2">
                          <a
                            href={turn.export.url}
                            download
                            className="flex items-center gap-2 rounded-xl border bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
                          >
                            <Download className="size-4" />
                            {turn.export.format.toUpperCase()} yuklab olish ({turn.export.rows} qator)
                          </a>
                          {turn.export.truncated ? (
                            <span className="text-xs text-muted-foreground">Cheklanildi</span>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                  {turn.role === "user" && <p className="whitespace-pre-wrap">{turn.text}</p>}
                </div>
              ))}
              {busy ? <p className="text-sm text-muted-foreground">Ma’lumot olinmoqda...</p> : null}
            </div>
          )}
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="flex gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Savol yozing..."
            className="h-11 flex-1 rounded-xl border bg-background px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !question.trim() || confirmPending}
            className="h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Yuborish
          </button>
        </form>
      </div>
    </PageShell>
  );
}
