import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCopy,
  Download,
  FileCode2,
  FileDown,
  FolderDown,
  FolderOpen,
  GitBranch,
  Layers,
  PackageCheck,
  PencilLine,
  Plug2,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import {
  CATALOG_FLOW,
  FLUTTER_FILES,
  INSTALL_STEPS,
  MIGRATION_MAP,
  PACKAGE_DIR,
  PACKAGE_VERSION,
  PATCHES,
  REPO_MAP,
} from "../data/flutter";
import { buildZip, downloadBlob, textFile } from "../utils/zip";
import { Badge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

type Tab = "install" | "files" | "compat" | "catalog" | "map";

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: "install", label: "O'rnatish", hint: "6 qadamda ulash" },
  { key: "files", label: "Fayllar", hint: "14 fayl · kod + ZIP" },
  { key: "compat", label: "Moslik", hint: "Adapter va ko'chirish" },
  { key: "catalog", label: "Katalog", hint: "Kodsiz yangilash" },
  { key: "map", label: "Xarita", hint: "Repo fayllar kesimi" },
];

/* Tiny Dart/YAML tint: comments, strings, keywords, annotations, numbers. */
function CodeView({ code, lang }: { code: string; lang: string }) {
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const tint = (line: string, key: number) => {
    const parts: { t: string; c?: string }[] = [];
    const rest = line;
    // simple sequential scan
    const re = /(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(import|export|library|class|enum|extends|implements|static|const|final|required|return|if|else|for|while|switch|case|break|try|catch|await|async|Future|void|bool|int|double|String|this|super|true|false|null|get)\b|(@\w+)|\b(\d[\d_]*(?:\.\d+)?)\b|\b([A-Z][A-Za-z0-9_]*)\b/g;
    let last = 0;
    let m: RegExpExecArray | null;
    const pushText = (t: string, c?: string) => {
      if (t) parts.push({ t, c });
    };
    while ((m = re.exec(rest))) {
      pushText(rest.slice(last, m.index));
      const cls = m[1]
        ? "text-muted/80 italic"
        : m[2]
          ? "text-[#0E8A4F]"
          : m[3]
            ? "text-[#7A3FF2] font-semibold"
            : m[4]
              ? "text-[#E0A023]"
              : m[5]
                ? "text-[#2F7DF6]"
                : m[6]
                  ? "text-[#0F766E] font-medium"
                  : undefined;
      pushText(m[0], cls);
      last = m.index + m[0].length;
    }
    pushText(rest.slice(last));
    return (
      <span key={key}>
        {parts.map((p, i) => (
          <span key={i} className={p.c}>{p.t}</span>
        ))}
      </span>
    );
  };
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-[#0E1420] p-0">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="flex gap-1.5">
          <i className="size-2.5 rounded-full bg-[#FF6058]" />
          <i className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <i className="size-2.5 rounded-full bg-[#28C840]" />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">{lang}</span>
      </div>
      <pre className="scroll-thin max-h-[420px] overflow-auto p-3 font-mono text-[11px] leading-[1.65] text-[#DCE4F0]">
        {lines.map((l, i) => (
          <div key={i} className="flex gap-3">
            <span className="w-7 shrink-0 select-none text-right text-white/25">{i + 1}</span>
            <code className="whitespace-pre">{tint(l || " ", i)}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}

function CopyBtn({ value, label = "Nusxalash" }: { value: string; label?: string }) {
  const toast = useToast();
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch { /* ignore */ }
        setOk(true);
        toast("Kod nusxalandi");
        setTimeout(() => setOk(false), 1400);
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10.5px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
    >
      {ok ? <Check size={12} className="text-brand-600" /> : <ClipboardCopy size={12} />} {ok ? "Nusxalandi" : label}
    </button>
  );
}

export default function FlutterKit({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("install");
  const [file, setFile] = useState(FLUTTER_FILES[0].path);
  const active = FLUTTER_FILES.find((f) => f.path === file) ?? FLUTTER_FILES[0];

  const groups = useMemo(() => {
    const g: Record<string, typeof FLUTTER_FILES> = {};
    for (const f of FLUTTER_FILES) {
      const dir = f.path.split("/").slice(0, -1).join("/");
      (g[dir] ??= []).push(f);
    }
    return g;
  }, []);

  const downloadOne = () => {
    downloadBlob(new Blob([active.code], { type: "text/plain;charset=utf-8" }), active.path.split("/").pop()!);
    toast(`${active.path.split("/").pop()} yuklab olindi`);
  };

  const downloadZip = () => {
    const zip = buildZip(FLUTTER_FILES.map((f) => textFile(f.path.replace(/^mobile\//, ""), f.code)));
    downloadBlob(zip, `sales-arena-design-system-v${PACKAGE_VERSION}.zip`);
    toast("ZIP paket yuklab olindi — mobile/ ga oching");
  };

  return (
    <section id="flutter" className={embedded ? "relative" : "relative border-t border-line/70 bg-paper py-20 sm:py-28"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Flutter integratsiya"
            title={<>Loyihaga tayyor <span className="text-brand-600">kod paketi</span></>}
            description="14 fayl, 0 bog'liqlik. Papkani ko'chiring, 3 qator ulang — katalogdagi dizayn ilovangizda yangilanadi. Eski kod buzilmaydi: adapter, bayroqlar va versiyalash ichida."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand"><PackageCheck size={11} /> v{PACKAGE_VERSION}</Badge>
                <Badge tone="lime"><ShieldCheck size={11} /> 0 dependency</Badge>
                <button
                  type="button"
                  onClick={downloadZip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <FolderDown size={13} /> ZIP yuklash
                </button>
              </div>
            }
          />
        </Reveal>

        <Reveal delay={80}>
          <div className="no-scrollbar mt-7 flex items-center gap-1.5 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                title={t.hint}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[11.5px] font-semibold transition-all",
                  tab === t.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-brand-300 hover:text-brand-700",
                )}
              >
                {t.label}
                <span className={cn("hidden font-mono text-[9px] sm:inline", tab === t.key ? "text-lime" : "text-muted")}>{t.hint}</span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* ── INSTALL ─────────────────────────────────────────── */}
        {tab === "install" && (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {INSTALL_STEPS.map((s, i) => (
              <Reveal key={s.no} delay={Math.min(i * 50, 250)}>
                <div className="flex h-full gap-3 rounded-[18px] border border-line bg-white p-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-ink font-mono text-[11px] font-bold text-lime">{s.no}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-ink">{s.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-ink-2/70">{s.desc}</p>
                    {s.cmd && (
                      <div className="mt-2.5 flex items-center gap-2 overflow-hidden rounded-[10px] bg-midnight px-3 py-2">
                        <TerminalSquare size={13} className="shrink-0 text-lime" />
                        <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-white/90">{s.cmd}</code>
                        <CopyBtn value={s.cmd} label="" />
                      </div>
                    )}
                    {s.note && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-lime-soft/60 px-2 py-1 text-[9.5px] font-medium text-brand-900/70">
                        <Check size={10} /> {s.note}
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* ── FILES ───────────────────────────────────────────── */}
        {tab === "files" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[18px] border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <FolderOpen size={12} /> {PACKAGE_DIR}
                </p>
                <button
                  type="button"
                  onClick={downloadZip}
                  className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1.5 text-[10px] font-bold text-midnight transition hover:bg-[#d7fa8c]"
                >
                  <Download size={11} /> ZIP
                </button>
              </div>
              <div className="scroll-thin max-h-[480px] overflow-y-auto p-2">
                {Object.entries(groups).map(([dir, files]) => (
                  <div key={dir} className="mb-1">
                    <p className="px-2 pb-1 pt-2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-muted">{dir || "/"}</p>
                    {files.map((f) => (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => setFile(f.path)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left transition",
                          file === f.path ? "bg-ink text-white" : "text-ink-2 hover:bg-[#F3F8F6]",
                        )}
                      >
                        <FileCode2 size={12} className={file === f.path ? "text-lime" : "text-brand-600"} />
                        <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{f.path.split("/").pop()}</span>
                        {file === f.path && <ChevronRight size={11} className="text-lime" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-2">
                <Badge tone="brand">{active.tag}</Badge>
                <span className="font-mono text-[10px] text-muted">{active.path}</span>
                <span className="ml-auto flex gap-1.5">
                  <CopyBtn value={active.code} label="Kod" />
                  <button
                    type="button"
                    onClick={downloadOne}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10.5px] font-semibold text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
                  >
                    <FileDown size={12} /> .dart
                  </button>
                </span>
              </div>
              <p className="mb-2.5 text-[11.5px] text-ink-2/70">{active.desc}</p>
              <CodeView code={active.code} lang={active.path.endsWith(".json") ? "json" : active.path.endsWith(".md") ? "md" : active.path.endsWith(".yaml") ? "yaml" : "dart"} />
            </div>
          </div>
        )}

        {/* ── COMPAT ──────────────────────────────────────────── */}
        {tab === "compat" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="overflow-hidden rounded-[18px] border border-line bg-white">
              <div className="border-b border-line px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">Ko'chirish jadvali — eski nom → yangi token</p>
                <p className="mt-0.5 text-[10.5px] text-ink-2/60">SaCompat shu xaritaning kod ko'rinishi. Noma'lum nom kelsa crash emas, kulrang qaytadi.</p>
              </div>
              <div className="scroll-thin max-h-[460px] divide-y divide-line/70 overflow-y-auto">
                {MIGRATION_MAP.map((m) => (
                  <div key={m.old} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-2">
                    <code className="truncate rounded bg-[#F4F8F6] px-1.5 py-1 font-mono text-[9.5px] text-ink-2 line-through decoration-coral/50">{m.old}</code>
                    <ArrowRight size={11} className="shrink-0 text-brand-500" />
                    <div className="min-w-0">
                      <code className="block truncate rounded bg-lime-soft/70 px-1.5 py-1 font-mono text-[9.5px] font-semibold text-brand-900">{m.now}</code>
                      <span className="mt-0.5 block text-[8.5px] text-muted">{m.note}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: Plug2, t: "Adapter qatlami", d: "SaCompat eski AppColors nomlarini yangi tokenlarga o'giradi. Eski fayl o'chirilmaydi — hamma ekran ko'chib bo'lgach @deprecated belgilanadi." },
                { icon: ShieldCheck, t: "Orqaga qaytish", d: "SaFlags.useNewTheme=false qilinsagina eski ko'rinish bir zumda qaytadi. Har ekran alohida PR'da ko'chadi, risk tarqaladi." },
                { icon: GitBranch, t: "Semver kafolati", d: "PATCH/MINOR — ustiga yozish kifoya. MAJOR — alohida branch, eski API avval @deprecated bo'ladi." },
              ].map((c) => (
                <div key={c.t} className="rounded-[16px] border border-line bg-white p-4">
                  <p className="flex items-center gap-2 text-[12px] font-semibold text-ink"><c.icon size={14} className="text-brand-600" /> {c.t}</p>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-2/70">{c.d}</p>
                </div>
              ))}
              <div className="rounded-[16px] border border-brand-200/60 bg-brand-50 p-4">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-brand-900"><Wrench size={14} /> Tezkor qoida</p>
                <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-brand-900/75">Yangi ekran → faqat Sa* vidgetlar.<br />Eski ekran → SaCompat + bitta PR.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── CATALOG ─────────────────────────────────────────── */}
        {tab === "catalog" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="rounded-[18px] border border-line bg-white p-4 sm:p-5">
              <p className="text-[13px] font-semibold text-ink">Katalog yangilash oqimi — kod tegilmaydi</p>
              <div className="relative mt-4 space-y-0">
                {CATALOG_FLOW.map((s, i) => (
                  <div key={s.no} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < CATALOG_FLOW.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-28px)] w-px bg-line" />}
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-bold text-lime">{s.no}</span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12px] font-semibold text-ink">{s.title}</p>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-2/65">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2 rounded-[12px] bg-[#F7FAF9] p-3 text-[10px] text-ink-2/70">
                <span className="inline-flex items-center gap-1.5"><CircleDot size={10} className="text-brand-500" /> Aktivdagi nusxa — doimiy fallback</span>
                <span className="inline-flex items-center gap-1.5"><CircleDot size={10} className="text-brand-500" /> Kesh — oflaynda ham ishlaydi</span>
                <span className="inline-flex items-center gap-1.5"><CircleDot size={10} className="text-brand-500" /> Versiya solishtirish — semver</span>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone="lime"><RefreshCw size={11} /> catalog.json · v{PACKAGE_VERSION}</Badge>
                <span className="ml-auto"><CopyBtn value={FLUTTER_FILES.find((f) => f.path.endsWith("catalog.json"))!.code} label="JSON" /></span>
              </div>
              <CodeView code={FLUTTER_FILES.find((f) => f.path.endsWith("catalog.json"))!.code} lang="json" />
              <p className="mt-2 text-[10px] leading-relaxed text-ink-2/60">
                Rang o'zgartirish = shu faylni yangilab serverga qo'yish. Ilova keyingi bootstrap'da o'zi oladi — build va market yangilanishi shart emas.
              </p>
            </div>
          </div>
        )}

        {/* ── MAP ─────────────────────────────────────────────── */}
        {tab === "map" && (
          <div className="mt-5 overflow-hidden rounded-[18px] border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <p className="text-[13px] font-semibold text-ink">Repo fayllar xaritasi</p>
              <span className="ml-auto font-mono text-[9px] text-muted">NEW_PRO · main · mobile/</span>
            </div>
            <div className="divide-y divide-line/70">
              {REPO_MAP.map((r) => (
                <div key={r.target} className="grid gap-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center">
                  <code className="truncate font-mono text-[10px] text-ink">{r.target}</code>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-ink-2">{r.action}</p>
                    <p className="truncate text-[9.5px] text-muted">{r.detail}</p>
                  </div>
                  <span className={cn(
                    "inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold",
                    r.status === "add" && "bg-lime/20 text-brand-900",
                    r.status === "edit" && "bg-brand-50 text-brand-700",
                    r.status === "keep" && "bg-[#F4F8F6] text-ink-2",
                  )}>
                    {r.status === "add" ? <Download size={9} /> : r.status === "edit" ? <PencilLine size={9} /> : <ShieldCheck size={9} />}
                    {r.status === "add" ? "Yangi" : r.status === "edit" ? "Tahrir" : "Tegilmaydi"}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-line px-4 pb-2 pt-4">
              <p className="text-[13px] font-semibold text-ink">Aniq kod yamalar — nusxalab yopishtiring</p>
              <p className="mt-0.5 text-[10.5px] text-ink-2/60">Har bir yama qaysi faylga, nima qilish kerakligini aytadi.</p>
            </div>
            <div className="grid gap-3 px-4 pb-4 lg:grid-cols-2">
              {PATCHES.map((p) => (
                <div key={p.target} className="overflow-hidden rounded-[14px] border border-line">
                  <div className="flex items-center gap-2 border-b border-line bg-[#FAFCFB] px-3 py-2">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[9px] font-bold",
                      p.action === "Qo'shish" && "bg-lime/25 text-brand-900",
                      p.action === "Almashtirish" && "bg-brand-50 text-brand-700",
                      p.action === "Saqlash" && "bg-[#EEF2F6] text-ink-2",
                    )}>
                      {p.action}
                    </span>
                    <code className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-ink">{p.target}</code>
                    <CopyBtn value={p.code} label="" />
                  </div>
                  <div className="px-3 py-2">
                    <p className="text-[11px] font-semibold text-ink">{p.title}</p>
                    <p className="text-[9.5px] text-ink-2/65">{p.desc}</p>
                  </div>
                  <CodeView code={p.code} lang={p.lang} />
                </div>
              ))}
            </div>
            <div className="flex flex-col items-start justify-between gap-3 border-t border-line bg-[#FAFCFB] p-4 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2 text-[11px] text-ink-2/70">
                <Layers size={13} className="text-brand-600" /> Jami o'zgarish: <b className="text-ink">2 fayl tahrir · 15 fayl yangi · 0 fayl o'chirish</b>
              </p>
              <button
                type="button"
                onClick={() => { toast("Xarita nusxalandi — PR tavsifiga yopishtiring"); }}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[10.5px] font-semibold text-white transition hover:bg-brand-800"
              >
                <ClipboardCopy size={12} /> PR matni <ArrowRight size={11} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
