import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCopy,
  Cloud,
  Code2,
  Database,
  Download,
  FileCode2,
  FolderDown,
  Layers,
  Lock,
  Package,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  SquareTerminal,
  Zap,
} from "lucide-react";
import {
  STACK_API,
  STACK_CHECKS,
  STACK_TESTS,
  STACK_EXTRA,
  STACK_FILES,
  STACK_LAYERS,
  STACK_VERSION,
  handoffReadme,
  type StackFile,
} from "../data/flutter";
import { screens, templates, roles } from "../data/design";
import { APP_BYTES, APP_FILES, APP_SCREENS, APP_TREE, APP_VERSION, APP_ZIP } from "../data/appManifest";
import { buildZipBytes, openDownloadPage, saveBytes, saveText, staticZipAvailable, staticZipUrl, textFile } from "../utils/zip";
import { Badge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

type Tab = "arch" | "app" | "api" | "code" | "db" | "run";

const TABS: { key: Tab; label: string; icon: typeof Server }[] = [
  { key: "arch", label: "Arxitektura", icon: Layers },
  { key: "app", label: "Ilova", icon: Smartphone },
  { key: "api", label: "API", icon: Server },
  { key: "code", label: "Kod", icon: FileCode2 },
  { key: "db", label: "Ma'lumot", icon: Database },
  { key: "run", label: "Ishga tushirish", icon: SquareTerminal },
];

function copy(text: string, toast: (m: string) => void) {
  navigator.clipboard?.writeText(text).catch(() => {});
  toast("Nusxalandi");
}

function Dart({ code }: { code: string }) {
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  return (
    <pre className="scroll-thin max-h-[440px] overflow-auto rounded-[12px] bg-[#0E1420] p-3 font-mono text-[10.5px] leading-[1.7] text-[#DCE4F0]">
      {lines.map((l, i) => (
        <div key={i} className="flex gap-2.5">
          <span className="w-6 shrink-0 select-none text-right text-white/25">{i + 1}</span>
          <code className={cn("whitespace-pre", l.trimStart().startsWith("//") && "text-white/40 italic")}>{l || " "}</code>
        </div>
      ))}
    </pre>
  );
}

function Method({ m }: { m: string }) {
  const tone = m === "GET" ? "bg-[#1E9E63]/12 text-[#1E9E63]" : m === "POST" ? "bg-[#2F7DF6]/12 text-[#2F7DF6]" : "bg-[#E0A023]/15 text-[#B77A08]";
  return <span className={cn("rounded px-1.5 py-0.5 font-mono text-[9px] font-bold", tone)}>{m}</span>;
}

export default function FullStackKit({ embedded = false }: { embedded?: boolean }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("arch");
  const [file, setFile] = useState<string>(STACK_FILES[0].path);
  const [filter, setFilter] = useState<"all" | "backend" | "mobile">("all");
  const [live, setLive] = useState<{ p: string; m: string; body: string } | null>(null);
  const [fallback, setFallback] = useState<{ name: string; bytes: Uint8Array; mime: string } | null>(null);
  const zipName = `sales-arena-fullstack-v${STACK_VERSION}.zip`;
  const [zipReady, setZipReady] = useState(false);
  useEffect(() => { staticZipAvailable(zipName).then(setZipReady); }, [zipName]);

  const allFiles: StackFile[] = [...STACK_FILES, ...STACK_EXTRA, ...STACK_TESTS];
  const active = allFiles.find((f) => f.path === file) ?? allFiles[0];
  const list = allFiles.filter((f) => (filter === "all" ? true : filter === "backend" ? f.path.startsWith("backend") : f.path.includes("mobile/") || f.path.includes("lib/core")));

  const total = allFiles.length + 5;

  const downloadStack = () => {
    const entries = [
      ...allFiles.map((f) => textFile(f.path, f.code)),
      textFile(
        "docs/tokens.json",
        JSON.stringify(
          {
            version: STACK_VERSION,
            colors: { brand: "#1F66D1", navy: "#14223F", agent: "#1F66D1", expeditor: "#0E8A4F", supervisor: "#1FA855", cashier: "#0F766E" },
            radius: { chip: 8, control: 12, card: 16, sheet: 20 },
            motion: { fast: 120, base: 240, emphatic: 420 },
          },
          null,
          2,
        ),
      ),
      textFile("docs/screens.json", JSON.stringify(screens.map((s) => ({ key: s.key, label: s.label, role: s.role, tags: s.tags })), null, 2)),
      textFile("docs/templates.json", JSON.stringify(templates.map((t) => ({ no: t.no, title: t.title, screen: t.screen ?? null })), null, 2)),
      textFile("docs/api.json", JSON.stringify(STACK_API, null, 2)),
      textFile("docs/README.md", handoffReadme()),
      textFile(
        "README.md",
        `# Sales Arena — Full Stack v${STACK_VERSION}

Backend (Fastify + Prisma) + Flutter API qatlami + design_system.

## Tez boshlash

    cd backend && cp .env.example .env
    npm install && npm run setup && npm run dev

Demo: aziz.qodirov / Arena#2026 · PIN 1234

Keyin ilova:
    mobile/lib/design_system/   -> UI tokenlari va vidgetlar
    mobile/lib/core/            -> api, models, repos, auth, sync

Batafsil: backend/README.md, docs/api.json
`,
      ),
    ];
    const bytes = buildZipBytes(entries);
    setFallback({ name: zipName, bytes, mime: "application/zip" });
    if (zipReady) return; // statik havola bosiladi
    saveBytes(bytes, zipName, "application/zip");
    openDownloadPage(bytes, zipName, "application/zip", staticZipUrl(zipName));
    toast("Yuklash sahifasi ochildi");
  };

  const runDemo = (p: string, m: string) => {
    const samples: Record<string, unknown> = {
      "/api/auth/login": { ok: true, token: "eyJhbGciOiJIUzI1…", user: { id: 1, name: "Aziz Qodirov", login: "aziz.qodirov", role: "agent" } },
      "/api/auth/pin": { ok: true },
      "/api/clients": { ok: true, total: 12, rows: [{ id: 1, code: "TT-1001", name: "MCHJ O'zbekiston Gullari", city: "Toshkent", balance: -1240000, tier: "A" }] },
      "/api/clients/:id": { ok: true, client: { id: 1, code: "TT-1001", balance: -1240000, orders: [], payments: [] }, ledger: [{ d: "26.06", v: -1240000 }, { d: "24.06", v: 500000 }] },
      "/api/products": { ok: true, categories: ["Ichimliklar", "Sneklar", "Kofe"], rows: [{ id: 1, sku: "P-001", name: "Coca-Cola 1.5L", price: 1200000, stock: 48 }] },
      "/api/orders": { ok: true, rows: [{ id: 12, number: "№1848", status: "confirmed", total: 6480000, discountPct: 2 }] },
      "/api/kpi/me": { ok: true, kpi: { plan: 34200000, fact: 21800000, pct: 64, premiumPct: 3, premium: 654000 } },
      "/api/sync/pull": { ok: true, serverTime: "2026-01-01T12:48:00Z", clients: [{}], products: [{}], orders: [{}] },
      "/api/sync/push": { ok: true, sent: 2, received: 0, logId: 41 },
      "/api/visits": { ok: true, rows: [{ id: 7, clientId: 1, status: "done", lat: 41.311, lng: 69.279 }] },
      "/api/payments": { ok: true, rows: [{ id: 3, amount: 1240000, method: "transfer", status: "pending" }] },
    };
    const key = Object.keys(samples).find((k) => p.startsWith(k)) ?? "/api/clients";
    setLive({ p, m, body: JSON.stringify(samples[key], null, 2) });
    toast(`${m} ${p} → 200 OK`);
  };

  return (
    <section id="fullstack" className={embedded ? "relative" : "relative py-20 sm:py-28"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Full stack"
            title={<>To‘liq kod: <span className="text-brand-600">backend + ilova</span></>}
            description="Ishlaydigan Fastify + Prisma API, 17 endpoint, 9 model, demo seed va Flutter klient qatlami. Uch buyruqda ishga tushadi — dizayn tizimi bilan bir xil tokenlar."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand"><Server size={11} /> {allFiles.length} fayl</Badge>
                <Badge tone="lime"><ShieldCheck size={11} /> 0 xizmat talab</Badge>
                <a
                  href={staticZipUrl(zipName)}
                  download={zipName}
                  onClick={(e) => { if (!zipReady) { e.preventDefault(); downloadStack(); } }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <FolderDown size={13} /> ZIP yuklash
                </a>
              </div>
            }
          />
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {STACK_CHECKS.map((c) => (
              <div key={c.l} className="rounded-[14px] border border-line bg-white/70 px-3 py-2.5">
                <p className="font-display text-[20px] font-bold leading-none tracking-tight text-ink">{c.v}</p>
                <p className="mt-1 text-[10px] font-semibold text-ink-2">{c.l}</p>
                <p className="font-mono text-[7.5px] text-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11.5px] font-semibold transition",
                  tab === t.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-brand-300 hover:text-brand-700",
                )}
              >
                <t.icon size={12} className={tab === t.key ? "text-lime" : "text-brand-600"} /> {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* APP */}
        {tab === "app" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="rounded-[20px] border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">Tayyor ilova</p>
                  <h3 className="mt-1 font-display text-[22px] font-semibold tracking-[-0.03em] text-ink">Sales Arena · v{APP_VERSION}</h3>
                  <p className="mt-1 text-[11px] text-ink-2/70">Flutter ilova + Fastify/Prisma backend — bitta arxivda, ishga tayyor.</p>
                </div>
                <span className="rounded-full bg-lime-soft px-2.5 py-1 font-mono text-[9px] font-bold text-brand-900">{(APP_BYTES / 1024).toFixed(0)} KB</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { v: String(APP_FILES.filter((f) => f.endsWith(".dart")).length), l: "Dart fayl" },
                  { v: String(APP_SCREENS.length), l: "Ekran" },
                  { v: String(APP_FILES.length), l: "Jami fayl" },
                  { v: "4", l: "Rol" },
                ].map((x) => (
                  <div key={x.l} className="rounded-[12px] border border-line bg-[#FAFCFB] px-3 py-2">
                    <p className="font-display text-[18px] font-bold leading-none text-ink">{x.v}</p>
                    <p className="mt-1 text-[9px] text-muted">{x.l}</p>
                  </div>
                ))}
              </div>

              <a
                href={staticZipUrl(APP_ZIP)}
                download={APP_ZIP}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3 text-[12px] font-bold text-midnight transition hover:brightness-105"
              >
                <FolderDown size={15} /> Ilovani yuklab olish · {(APP_BYTES / 1024).toFixed(0)} KB
              </a>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px]">
                <a href={staticZipUrl(APP_ZIP)} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline underline-offset-2">Yangi oynada ochish</a>
                <span className="font-mono text-muted">{APP_ZIP}</span>
              </div>

              <div className="mt-4 rounded-[12px] border border-line bg-[#FAFCFB] p-3">
                <p className="text-[11px] font-semibold text-ink">Ishga tushirish</p>
                <div className="mt-2 space-y-1.5">
                  {[
                    "unzip " + APP_ZIP,
                    "cd backend && npm install && npm run setup",
                    "npm run dev   # API :4000",
                    "flutter pub get && flutter run --dart-define=API_URL=http://10.0.2.2:4000",
                  ].map((c) => (
                    <div key={c} className="flex items-center gap-2 overflow-hidden rounded-md bg-midnight px-2 py-1.5">
                      <code className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-white/90">{c}</code>
                      <button type="button" onClick={() => copy(c, toast)} aria-label="Nusxalash" className="shrink-0 text-white/50 hover:text-lime"><ClipboardCopy size={11} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="overflow-hidden rounded-[18px] border border-line bg-white">
                <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                  <p className="text-[12px] font-semibold text-ink">Ekranlar · {APP_SCREENS.length}</p>
                  <span className="font-mono text-[8.5px] text-muted">lib/features</span>
                </div>
                <div className="scroll-thin max-h-[300px] overflow-y-auto">
                  {APP_SCREENS.map(([label, path, role]) => (
                    <button
                      key={path as string}
                      type="button"
                      onClick={() => toast(`${path} — arxiv ichida: ${APP_ZIP}`)}
                      className="flex w-full items-center gap-2 border-b border-line/60 px-3 py-1.5 text-left last:border-0 hover:bg-[#F7FAF9]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink">{label as string}</span>
                      <span className="rounded bg-[#F3F8F6] px-1.5 py-0.5 text-[7.5px] font-semibold text-muted">{role as string}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-[18px] border border-line bg-white p-3.5">
                <p className="text-[11px] font-semibold text-ink">Papka tuzilmasi</p>
                <div className="mt-2 space-y-1">
                  {Object.entries(APP_TREE as Record<string, string[]>).slice(0, 14).map(([dir, list]) => (
                    <div key={dir} className="flex items-center justify-between gap-2">
                      <code className="truncate font-mono text-[8.5px] text-ink-2">{dir}/</code>
                      <span className="font-mono text-[8px] text-muted">{list.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARCH */}
        {tab === "arch" && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {STACK_LAYERS.map((l, i) => {
              const Icon = [Smartphone, Server, Database, Cloud][i] ?? Layers;
              return (
                <Reveal key={l.name} delay={i * 60}>
                  <div className="flex h-full gap-3 rounded-[18px] border border-line bg-white p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-lime"><Icon size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-ink">{l.name}</p>
                        <span className="rounded bg-[#F3F8F6] px-1.5 py-0.5 font-mono text-[8.5px] text-muted">{l.tech}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-ink-2/70">{l.role}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {l.items.map((x) => <span key={x} className="rounded border border-line bg-[#FAFCFB] px-1.5 py-0.5 text-[8.5px] text-ink-2">{x}</span>)}
                      </div>
                    </div>
                  </div>
                </Reveal>
              );
            })}
            <Reveal delay={240}>
              <div className="rounded-[18px] border border-brand-200/60 bg-brand-50 p-4">
                <p className="flex items-center gap-2 text-[13px] font-semibold text-brand-900"><Zap size={14} /> Oqim: buyurtma yaratish</p>
                <ol className="mt-2 space-y-1.5">
                  {[
                    "Ilova: savat lokal SQLite'da, jami ko'rsatiladi",
                    "POST /api/orders — narx va stock serverda qayta tekshiriladi",
                    "Tranzaksiya: order + items + stock-- + client.balance--",
                    "Javob ilovaga, kesh yangilanadi, sync log yoziladi",
                    "Oflayn bo'lsa navbatga — keyingi sinxronda yuboriladi",
                  ].map((s, i) => (
                    <li key={s} className="flex gap-2 text-[10px] leading-snug text-brand-900/75">
                      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-brand-900 font-mono text-[7.5px] text-lime">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </Reveal>
          </div>
        )}

        {/* API */}
        {tab === "api" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="overflow-hidden rounded-[18px] border border-line bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <p className="text-[13px] font-semibold text-ink">Endpointlar</p>
                <span className="ml-auto font-mono text-[9px] text-muted">{STACK_API.length} ta · JWT + RBAC</span>
              </div>
              <div className="scroll-thin max-h-[440px] overflow-y-auto">
                {STACK_API.map((e, idx) => (
                  <div key={`${e.m}-${e.p}-${idx}`} className="grid grid-cols-[46px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line/60 px-4 py-2 last:border-0">
                    <Method m={e.m} />
                    <button type="button" onClick={() => runDemo(e.p, e.m)} className="group min-w-0 text-left">
                      <code className="block truncate font-mono text-[10.5px] font-medium text-ink group-hover:text-brand-700">{e.p}</code>
                      <span className="block truncate text-[9.5px] text-muted">{e.d}</span>
                    </button>
                    <div className="flex items-center gap-1.5">
                      <span className="hidden rounded bg-[#FAFCFB] px-1.5 py-0.5 font-mono text-[8px] text-muted sm:inline">{e.r}</span>
                      <button type="button" onClick={() => runDemo(e.p, e.m)} aria-label={`${e.p} sinash`} className="grid size-6 place-items-center rounded-md border border-line text-brand-600 transition hover:bg-brand-50">
                        <Play size={9} fill="currentColor" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[18px] border border-line bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-ink">Javob namunasi</p>
                {live && <button type="button" onClick={() => copy(live.body, toast)} className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-700"><ClipboardCopy size={11} /> nusxa</button>}
              </div>
              {live ? (
                <>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-[10px]"><Method m={live.m} /><span className="truncate text-ink-2">{live.p}</span></p>
                  <div className="mt-2 rounded-[10px] bg-[#0E1420] p-3">
                    <pre className="scroll-thin max-h-[340px] overflow-auto font-mono text-[9.5px] leading-relaxed text-[#B9E6C9]">{live.body}</pre>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#F0FAF3] px-2 py-1.5 text-[9px] font-medium text-[#166544]"><Check size={10} /> 200 OK · 41 ms · JWT tekshirildi</p>
                </>
              ) : (
                <div className="grid place-items-center py-14 text-center">
                  <Play size={22} className="text-line-dark" />
                  <p className="mt-2 text-[11px] font-semibold text-ink">Endpointni sinang</p>
                  <p className="text-[10px] text-muted">Chapdan birini bosing — javob shu yerda</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CODE */}
        {tab === "code" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-[18px] border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{allFiles.length} fayl</p>
                <button type="button" onClick={downloadStack} className="inline-flex items-center gap-1 rounded-full bg-lime px-2.5 py-1.5 text-[10px] font-bold text-midnight"><Download size={11} /> ZIP</button>
              </div>
              <div className="flex gap-1 px-2 pt-2">
                {(["all", "backend", "mobile"] as const).map((f) => (
                  <button key={f} type="button" onClick={() => setFilter(f)} className={cn("flex-1 rounded-md px-1.5 py-1 text-[9px] font-semibold", filter === f ? "bg-ink text-white" : "bg-[#F5F8F7] text-muted")}>
                    {f === "all" ? "Hammasi" : f === "backend" ? "Backend" : "Flutter"}
                  </button>
                ))}
              </div>
              <div className="scroll-thin max-h-[420px] overflow-y-auto p-2">
                {list.map((f) => (
                  <button key={f.path} type="button" onClick={() => setFile(f.path)} className={cn("flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left", file === f.path ? "bg-ink text-white" : "text-ink-2 hover:bg-[#F3F8F6]")}>
                    <Package size={11} className={file === f.path ? "text-lime" : "text-brand-600"} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[9.5px]">{f.path.split("/").pop()}</span>
                    <span className={cn("shrink-0 rounded px-1 text-[7px] font-bold", file === f.path ? "bg-white/10 text-lime" : "bg-[#F2F6F4] text-muted")}>{f.tag}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#F3F8F6] px-1.5 py-0.5 font-mono text-[9px] text-muted">{active.tag}</span>
                <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-ink-2">{active.path}</code>
                <button type="button" onClick={() => copy(active.code, toast)} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-[10px] font-semibold text-ink-2"><ClipboardCopy size={11} /> nusxa</button>
                <button type="button" onClick={() => { const r = saveText(active.code, active.path.split('/').pop()!); toast(r.ok ? 'Fayl yuklandi' : 'Yangi oynada ochildi'); }} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-[10px] font-semibold text-ink-2"><Download size={11} /> fayl</button>
              </div>
              <p className="mb-2 text-[10.5px] text-ink-2/70">{active.desc}</p>
              <Dart code={active.code} />
            </div>
          </div>
        )}

        {/* DB */}
        {tab === "db" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_380px]">
            <div className="rounded-[18px] border border-line bg-white p-4">
              <p className="text-[13px] font-semibold text-ink">Ma'lumot modeli</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  { n: "User", f: ["id", "login", "password", "role", "pinHash"], rel: "visits, orders, payments" },
                  { n: "Client", f: ["id", "code", "name", "city", "balance"], rel: "orders, visits, payments" },
                  { n: "Product", f: ["id", "sku", "price", "stock", "perBox"], rel: "order items" },
                  { n: "Order", f: ["id", "number", "status", "total", "discountPct"], rel: "client, agent, items" },
                  { n: "OrderItem", f: ["orderId", "productId", "qty", "price"], rel: "order, product" },
                  { n: "Visit", f: ["clientId", "agentId", "status", "lat", "lng"], rel: "client, agent" },
                  { n: "Payment", f: ["clientId", "amount", "method", "status"], rel: "client, order, cashier" },
                  { n: "BonusRule", f: ["type", "stepQty", "bonusQty", "minSum"], rel: "—" },
                  { n: "SyncLog", f: ["userId", "kind", "sent", "received"], rel: "user" },
                ].map((m) => (
                  <div key={m.n} className="rounded-[12px] border border-line bg-[#FAFCFB] p-2.5">
                    <p className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold text-ink"><Database size={10} className="text-brand-600" /> {m.n}</p>
                    <p className="mt-1 truncate font-mono text-[8.5px] text-ink-2/70">{m.f.join(" · ")}</p>
                    <p className="mt-0.5 truncate font-mono text-[8px] text-muted">→ {m.rel}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[16px] border border-line bg-white p-4">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-ink"><Lock size={13} className="text-brand-600" /> Butunlik qoidalari</p>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-ink-2/70">
                  {["Order.total faqat serverda hisoblanadi", "Stock order yaratishda tranzaksiyada kamayadi", "Client.balance payment/to'lovda atomar yangilanadi", "OrderItem product o'chirilsa — cascade"].map((x) => (
                    <li key={x} className="flex gap-1.5"><Check size={10} className="mt-0.5 shrink-0 text-[#1E9E63]" />{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[16px] border border-brand-200/60 bg-brand-50 p-4">
                <p className="flex items-center gap-2 text-[12px] font-semibold text-brand-900"><RefreshCw size={13} /> SQLite → Postgres</p>
                <p className="mt-1 text-[10px] leading-relaxed text-brand-900/70">Bitta qator: provider ni o'zgartiring, DATABASE_URL bering. Boshqa kod tegilmaydi.</p>
                <button type="button" onClick={() => { setTab("code"); setFile("backend/prisma/schema.prisma"); }} className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-900 px-2.5 py-1.5 text-[9.5px] font-semibold text-lime">sxemani ochish <ChevronRight size={10} /></button>
              </div>
            </div>
          </div>
        )}

        {/* RUN */}
        {tab === "run" && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-white p-4">
              <p className="text-[13px] font-semibold text-ink">Backendni ishga tushirish</p>
              <div className="mt-3 space-y-2">
                {[
                  { c: "cd backend && cp .env.example .env", d: "Muhit faylini tayyorlash" },
                  { c: "npm install", d: "Bog'liqliklarni o'rnatish" },
                  { c: "npm run setup", d: "SQLite + demo ma'lumot" },
                  { c: "npm run dev", d: "http://localhost:4000" },
                ].map((s, i) => (
                  <div key={s.c} className="rounded-[10px] border border-line bg-[#FAFCFB] p-2.5">
                    <p className="flex items-center gap-1.5 text-[9.5px] font-semibold text-ink"><span className="grid size-4 place-items-center rounded-full bg-ink font-mono text-[7.5px] text-lime">{i + 1}</span>{s.d}</p>
                    <div className="mt-1.5 flex items-center gap-2 overflow-hidden rounded bg-midnight px-2 py-1.5">
                      <code className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-white/90">{s.c}</code>
                      <button type="button" onClick={() => copy(s.c, toast)} aria-label="Nusxalash" className="shrink-0 text-white/50 hover:text-lime"><ClipboardCopy size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-[18px] border border-line bg-white p-4">
                <p className="text-[13px] font-semibold text-ink">Demo hisoblar</p>
                <div className="mt-2 overflow-hidden rounded-[10px] border border-line">
                  {roles.map((r, i) => (
                    <div key={r.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-2.5 py-1.5" style={{ borderBottom: i < roles.length - 1 ? "1px solid #E4E8EF" : "none" }}>
                      <span className="text-[9.5px] font-semibold text-ink">{r.short}</span>
                      <code className="truncate font-mono text-[9px] text-muted">{[ "aziz.qodirov", "bobur.rahimov", "kamol.aliyev", "dilnoza.karimova" ][i]}</code>
                      <code className="rounded bg-lime-soft px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-brand-900">PIN 1234</code>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[9px] text-muted">Parol: <code className="font-mono">Arena#2026</code></p>
              </div>
              <div className="rounded-[18px] border border-line bg-white p-4">
                <p className="text-[13px] font-semibold text-ink">Flutterga ulash</p>
                <div className="mt-2 rounded-[10px] bg-[#0E1420] p-2.5">
                  <pre className="scroll-thin overflow-x-auto font-mono text-[9px] leading-relaxed text-[#B9E6C9]">{`final api = ApiClient(baseUrl: 'http://10.0.2.2:4000');
final session = SessionController(api);
await session.login('aziz.qodirov', 'Arena#2026');
final orders = OrdersRepository(api);
final list = await orders.list();

// sync: identity | quick | full
final sync = SyncService(api);
final r = await sync.run(SyncKind.quick);`}</pre>
                </div>
                <p className="mt-1.5 text-[9px] text-muted">Android emulyatorda <code className="font-mono">10.0.2.2</code>, iOS'da <code className="font-mono">localhost</code>.</p>
              </div>
              <div className="rounded-[16px] border border-line bg-[#FAFCFB] p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink"><ShieldCheck size={12} className="text-brand-600" /> Tekshiruv</p>
                <code className="mt-1 block font-mono text-[9.5px] text-ink-2">curl localhost:4000/health</code>
                <p className="mt-1 font-mono text-[8.5px] text-muted">{`{ "ok": true, "version": "1.0.0" }`}</p>
              </div>
              <a href={staticZipUrl(zipName)} download={zipName} onClick={(e) => { if (!zipReady) { e.preventDefault(); downloadStack(); } }} className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-2.5 text-[11.5px] font-bold text-midnight">
                <FolderDown size={14} /> Full stack ZIP · {total} fayl
              </a>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[9px]">
                <a href={staticZipUrl(zipName)} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline underline-offset-2">Yangi oynada ochish</a>
                <button type="button" onClick={() => { setTab("run"); downloadStack(); }} className="font-semibold text-brand-700 underline underline-offset-2">Yuklanmasa — zaxira</button>
                <span className="font-mono text-muted">{zipReady ? "server fayli tayyor" : "brauzer xotirasidan"}</span>
              </div>
            </div>
          </div>
        )}

        {fallback && (
          <div className="mt-3 flex flex-col gap-2 rounded-[14px] border border-[#E8D9A8] bg-[#FFFCF2] px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A6300]"><Download size={12} /> Yuklab olinmadi?</p>
              <p className="text-[10px] text-[#8A6300]/70">Brauzer iframe ichida yuklashni to'sgan bo'lishi mumkin. Zaxira usulni tanlang.</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <button type="button" onClick={() => { saveBytes(fallback.bytes, fallback.name, fallback.mime); toast("Qayta urinildi — brauzer oynasini tekshiring"); }} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[10px] font-semibold text-white">
                <Download size={11} /> Qayta yuklash
              </button>
              <button type="button" onClick={() => { const ok = openDownloadPage(fallback.bytes, fallback.name, fallback.mime, staticZipUrl(fallback.name)); toast(ok ? "Yuklash sahifasi ochildi" : "Pop-up to'sildi — ruxsat bering"); }} className="inline-flex items-center gap-1 rounded-full border border-[#E8D9A8] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#8A6300]">
                <Cloud size={11} /> Yuklash sahifasi
              </button>
              <a href={staticZipUrl(fallback.name)} download={fallback.name} className="inline-flex items-center gap-1 rounded-full border border-[#E8D9A8] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#8A6300]">
                <FolderDown size={11} /> To'g'ridan
              </a>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col items-start justify-between gap-2 rounded-[14px] border border-line bg-white/70 px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-[10.5px] text-ink-2/70">
            <Code2 size={12} className="text-brand-600" /> Backend Fastify + Prisma · Klient Flutter · Dizayn design_system — bir xil tokenlar.
          </p>
          <button type="button" onClick={downloadStack} className="inline-flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-brand-700">
            Hammasini yuklash <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </section>
  );
}
