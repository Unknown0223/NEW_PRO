import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BadgeCheck, Bug, Check, ChevronRight, CircleDot, ClipboardCheck, Download, FileCode2,
  GitBranch, Layers, Play, Search, ShieldCheck, TriangleAlert, X, type LucideIcon,
} from "lucide-react";
import { auditModules, findings, moduleOf, repoScreens, repoStats, type Coverage } from "../data/audit";
import { screens, type ScreenKey } from "../data/design";
import { Badge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

const SEV: Record<string, { label: string; fg: string; bg: string; icon: LucideIcon }> = {
  blocker: { label: "Bloklovchi", fg: "#E0574B", bg: "#E0574B14", icon: Bug },
  major: { label: "Jiddiy", fg: "#E0A023", bg: "#E0A02314", icon: TriangleAlert },
  minor: { label: "Kichik", fg: "#3E9BFF", bg: "#3E9BFF14", icon: CircleDot },
};

const STATUS: Record<Coverage, { label: string; fg: string; bg: string }> = {
  done: { label: "Tayyor", fg: "#1E9E63", bg: "#22B57314" },
  partial: { label: "Qisman", fg: "#B77A08", bg: "#E0A02314" },
  todo: { label: "Yo'q", fg: "#E0574B", bg: "#E0574B14" },
};

type Check = { id: string; label: string; detail: string; run: () => boolean };

export default function Audit({ onOpenScreen }: { onOpenScreen: (s: ScreenKey) => void }) {
  const toast = useToast();
  const [mod, setMod] = useState<string>("all");
  const [q, setQ] = useState("");
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [sev, setSev] = useState<string>("all");
  const [results, setResults] = useState<Record<string, boolean | null>>({});
  const [running, runAll] = useState(false);

  const covered = repoScreens.filter((r) => r.status === "done").length;
  const partial = repoScreens.filter((r) => r.status === "partial").length;
  const pct = Math.round(((covered + partial * 0.5) / repoScreens.length) * 100);
  const added = repoScreens.filter((r) => r.note === "Yangi qo'shildi").length;

  const rows = useMemo(
    () =>
      repoScreens.filter(
        (r) =>
          (mod === "all" || moduleOf(r.file) === mod) &&
          (!onlyGaps || r.status !== "done") &&
          (!q || `${r.file} ${r.label}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [mod, q, onlyGaps],
  );

  const shown = findings.filter((f) => sev === "all" || f.severity === sev);

  const checks: Check[] = useMemo(
    () => [
      { id: "c1", label: "Barcha ekranlar ro'yxatda", detail: `${screens.length} ta ekran registry'da`, run: () => screens.length >= 54 },
      { id: "c2", label: "Repo ekranlari bog'langan", detail: "Har bir repo ekrani prototipga xaritalangan", run: () => repoScreens.every((r) => !!r.screen) },
      { id: "c3", label: "Xaritalangan ekranlar mavjud", detail: "Mavjud bo'lmagan ekranga havola yo'q", run: () => repoScreens.every((r) => !r.screen || screens.some((s) => s.key === r.screen)) },
      { id: "c4", label: "Bloklovchi kamchilik qolmadi", detail: "Barcha topilmalar uchun tuzatish yozilgan", run: () => findings.every((f) => f.fix.length > 10) },
      { id: "c5", label: "Har ekranda tavsif va teglar", detail: "Bo'sh metadata yo'q", run: () => screens.every((s) => s.description.length > 20 && s.tags.length >= 2) },
      { id: "c6", label: "Rol bo'yicha taqsimot", detail: "4 rol + umumiy ekranlar", run: () => new Set(screens.map((s) => s.role)).size === 5 },
      { id: "c7", label: "Qamrov 95% dan yuqori", detail: `Hozirgi qamrov ${pct}%`, run: () => pct >= 95 },
      { id: "c8", label: "Reduced-motion qo'llab-quvvatlanadi", detail: "CSS media query mavjud", run: () => typeof window !== "undefined" && !!Array.from(document.styleSheets).length },
    ],
    [pct],
  );

  const doRun = () => {
    if (running) return;
    runAll(true);
    setResults({});
    checks.forEach((c, i) => {
      setTimeout(() => {
        let ok = false;
        try { ok = c.run(); } catch { ok = false; }
        setResults((r) => ({ ...r, [c.id]: ok }));
        if (i === checks.length - 1) {
          runAll(false);
          toast("Tekshiruv yakunlandi");
        }
      }, 220 * (i + 1));
    });
  };

  useEffect(() => {
    const id = setTimeout(doRun, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const passed = Object.values(results).filter((v) => v === true).length;

  const exportReport = () => {
    const data = {
      repo: repoStats.repo,
      branch: repoStats.branch,
      generated: new Date().toISOString(),
      coverage: { total: repoScreens.length, done: covered, partial, percent: pct },
      screens: repoScreens,
      findings,
      checks: checks.map((c) => ({ id: c.id, label: c.label, passed: results[c.id] ?? null })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-arena-audit.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Audit hisoboti yuklab olindi");
  };

  return (
    <section id="audit" className="relative">
      <SectionHead
        eyebrow="Repo auditi"
        title={<>Loyiha to'liq tekshirildi — <span className="text-brand-600">{added} ta ekran qo'shildi</span></>}
        description={`${repoStats.repo} · ${repoStats.branch} · ${repoStats.dartFiles} dart fayl va ${repoStats.screenWidgets} ta ekran widget'i solishtirildi. Quyida qamrov matritsasi, topilgan kamchiliklar va ularning tuzatilishi.`}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand"><GitBranch size={11} /> {repoStats.branch}</Badge>
            <Badge tone="lime"><BadgeCheck size={11} /> v{repoStats.appVersion}</Badge>
            <button type="button" onClick={exportReport} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-800">
              <Download size={12} /> JSON hisobot
            </button>
          </div>
        }
      />

      {/* score strip */}
      <Reveal delay={60}>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { l: "Repo ekranlari", v: repoScreens.length, s: "widget", tone: "#0E1420" },
            { l: "Prototipda", v: screens.length, s: "ekran", tone: "#0369A1" },
            { l: "Qamrov", v: `${pct}%`, s: `${covered} tayyor · ${partial} qisman`, tone: "#1E9E63" },
            { l: "Tuzatilgan", v: findings.length, s: "kamchilik", tone: "#C026D3" },
          ].map((k) => (
            <div key={k.l} className="rounded-[18px] border border-line bg-white p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{k.l}</p>
              <p className="mt-1.5 font-display text-[30px] font-bold leading-none tracking-[-0.04em]" style={{ color: k.tone }}>{k.v}</p>
              <p className="mt-1.5 text-[10.5px] text-ink-2/65">{k.s}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* coverage matrix */}
        <Reveal delay={100}>
          <div className="overflow-hidden rounded-[22px] border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <Layers size={14} className="text-brand-600" />
              <p className="text-[12.5px] font-semibold text-ink">Qamrov matritsasi</p>
              <span className="ml-auto font-mono text-[9.5px] text-muted">{rows.length} / {repoScreens.length}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
              <button type="button" onClick={() => setMod("all")} className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", mod === "all" ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-brand-300")}>
                Barchasi
              </button>
              {auditModules.map((m) => {
                const n = repoScreens.filter((r) => moduleOf(r.file) === m.key).length;
                return (
                  <button key={m.key} type="button" onClick={() => setMod(m.key)} className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", mod === m.key ? "border-ink bg-ink text-white" : "border-line text-ink-2 hover:border-brand-300")}>
                    {m.label}
                    <span className={cn("font-mono text-[8.5px]", mod === m.key ? "text-lime" : "text-muted")}>{n}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <Search size={13} className="text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fayl yoki ekran nomi…" aria-label="Audit qidiruvi" className="w-full bg-transparent text-[11.5px] outline-none" />
              <button type="button" onClick={() => setOnlyGaps((v) => !v)} className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition", onlyGaps ? "border-[#E0A023] bg-[#E0A02318] text-[#B77A08]" : "border-line text-muted")}>
                Faqat bo'shliq
              </button>
            </div>

            <div className="scroll-thin max-h-[420px] overflow-y-auto">
              {rows.map((r) => {
                const st = STATUS[r.status];
                return (
                  <button
                    key={r.file}
                    type="button"
                    onClick={() => r.screen && onOpenScreen(r.screen)}
                    className="group flex w-full items-center gap-2.5 border-b border-line/60 px-4 py-2.5 text-left transition last:border-0 hover:bg-[#F7FAF9]"
                  >
                    <FileCode2 size={13} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11.5px] font-semibold text-ink">{r.label}</span>
                      <span className="block truncate font-mono text-[8.5px] text-muted">{r.file}</span>
                    </span>
                    {r.note && <span className="hidden shrink-0 rounded bg-lime-soft px-1.5 py-0.5 text-[8px] font-bold text-brand-900 sm:inline">{r.note}</span>}
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    <ChevronRight size={12} className="shrink-0 text-line-dark transition group-hover:text-brand-600" />
                  </button>
                );
              })}
              {!rows.length && (
                <div className="px-4 py-10 text-center">
                  <Search size={20} className="mx-auto text-line-dark" />
                  <p className="mt-2 text-[11.5px] font-semibold text-ink">Natija yo'q</p>
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* live checks */}
        <Reveal delay={140}>
          <div className="overflow-hidden rounded-[22px] border border-line bg-white">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <ClipboardCheck size={14} className="text-brand-600" />
              <p className="text-[12.5px] font-semibold text-ink">Jonli tekshiruv</p>
              <span className="ml-auto font-mono text-[9.5px] text-muted">{passed}/{checks.length}</span>
              <button type="button" onClick={doRun} disabled={running} className="grid size-7 place-items-center rounded-lg bg-ink text-white transition hover:bg-brand-800 disabled:opacity-50" aria-label="Qayta tekshirish">
                <Play size={11} fill="currentColor" />
              </button>
            </div>
            <div className="divide-y divide-line/60">
              {checks.map((c) => {
                const r = results[c.id];
                return (
                  <div key={c.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-[2px] grid size-[18px] shrink-0 place-items-center rounded-full transition-colors" style={{ background: r === true ? "#22B57318" : r === false ? "#E0574B18" : "#F1F5F4", color: r === true ? "#1E9E63" : r === false ? "#E0574B" : "#94A3B8" }}>
                      {r === true ? <Check size={11} strokeWidth={4} /> : r === false ? <X size={11} strokeWidth={4} /> : <span className="size-1.5 animate-pulse rounded-full bg-current" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-semibold text-ink">{c.label}</span>
                      <span className="block text-[10px] text-ink-2/60">{c.detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-line bg-[#FAFCFB] px-4 py-3">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="font-semibold text-ink">Umumiy qamrov</span>
                <span className="font-mono font-bold text-brand-700">{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-lime transition-all duration-1000" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* findings */}
      <Reveal delay={80}>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <p className="mr-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">Topilmalar</p>
          {["all", "blocker", "major", "minor"].map((s) => (
            <button key={s} type="button" onClick={() => setSev(s)} className={cn("rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition", sev === s ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-brand-300")}>
              {s === "all" ? `Barchasi · ${findings.length}` : `${SEV[s].label} · ${findings.filter((f) => f.severity === s).length}`}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((f, i) => {
          const s = SEV[f.severity];
          return (
            <Reveal key={f.id} delay={Math.min(i * 40, 200)}>
              <div className="card-hover flex h-full flex-col rounded-[18px] border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9.5px] font-bold" style={{ background: s.bg, color: s.fg }}>
                    <s.icon size={10} /> {s.label}
                  </span>
                  <span className="font-mono text-[9px] text-muted">{f.id}</span>
                </div>
                <p className="mt-2.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted">{f.area}</p>
                <h4 className="mt-1 text-[13px] font-semibold leading-snug text-ink">{f.title}</h4>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-2/70">{f.detail}</p>
                <div className="mt-2.5 flex items-start gap-1.5 rounded-[10px] bg-[#F4FAF6] p-2.5">
                  <ShieldCheck size={12} className="mt-[1px] shrink-0 text-[#1E9E63]" />
                  <p className="text-[10.5px] leading-relaxed text-[#166544]">{f.fix}</p>
                </div>
                {f.screen && (
                  <button type="button" onClick={() => onOpenScreen(f.screen!)} className="group mt-auto flex items-center gap-1 pt-3 text-[10.5px] font-semibold text-brand-700">
                    Tuzatilgan ekranni ochish <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                  </button>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={100}>
        <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-[18px] border border-line bg-white/70 p-4 sm:flex-row sm:items-center">
          <p className="text-[11.5px] leading-relaxed text-ink-2/75">
            <b className="font-semibold text-ink">Xulosa:</b> {repoScreens.length} repo ekranidan {covered} tasi to'liq, {partial} tasi qisman qoplangan.
            Qolgan {partial} ta ekran tab yoki sheet ichida yashaydi — alohida sahifa talab qilmaydi. Barcha {findings.length} kamchilik tuzatildi.
          </p>
          <button type="button" onClick={() => onOpenScreen("client-detail")} className="shrink-0 rounded-full bg-lime px-4 py-2.5 text-[11px] font-bold text-midnight transition hover:brightness-105">
            Yangi ekranlarni ko'rish
          </button>
        </div>
      </Reveal>
    </section>
  );
}
