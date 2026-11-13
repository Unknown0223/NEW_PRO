import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Check,
  ChevronRight,
  Layers,
  Palette,
  Plus,
  Search,
  Shapes,
  Type,
  Download,
} from "lucide-react";
import { accents, motionPresets, palette, typeScale } from "../data/design";
import { CopyButton, Reveal, SectionHead, useToast } from "./ui";
import { saveText } from "../utils/zip";
import { cn } from "../utils/cn";

const tabs = [
  { key: "rang", label: "Ranglar", icon: Palette },
  { key: "type", label: "Tipografiya", icon: Type },
  { key: "comp", label: "Komponentlar", icon: Layers },
  { key: "shape", label: "Shakl & soya", icon: Shapes },
] as const;

type Tab = (typeof tabs)[number]["key"];

const radii = [
  { name: "sm / 8", v: 8, use: "Chip, badge" },
  { name: "md / 12", v: 12, use: "Input, button" },
  { name: "lg / 16", v: 16, use: "Karta, list" },
  { name: "xl / 20", v: 20, use: "Sheet, hero" },
  { name: "2xl / 28", v: 28, use: "Panel, modal" },
  { name: "full", v: 999, use: "Avatar, FAB" },
];

const spaces = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64];

export default function DesignSystem({ embedded = false }: { embedded?: boolean }) {
  const [tab, setTab] = useState<Tab>("rang");
  const [chip, setChip] = useState(1);
  const [toggle1, setToggle1] = useState(true);
  const [toggle2, setToggle2] = useState(false);
  const [seg, setSeg] = useState(0);
  const [q, setQ] = useState("");
  const [headingSize, setHeadingSize] = useState(40);
  const toast = useToast();

  const downloadTokens = () => {
    const data = {
      name: "SALEC Agent 2.0",
      version: "2.0.0",
      updated: "2026-07",
      colors: palette,
      accents: accents.map(({ id, name, hex, soft, ink, gradient }) => ({ id, name, hex, soft, ink, gradient })),
      typography: typeScale,
      motion: motionPresets,
      radii: radii.map(({ name, v, use }) => ({ name, value: v, use })),
      spacing: spaces,
    };
    const res = saveText(JSON.stringify(data, null, 2), "salec-design-tokens.json", "application/json");
    toast(res.ok ? "salec-design-tokens.json yuklab olindi" : "Yangi oynada ochildi");
  };

  return (
    <section id="dizayn" className={embedded ? "relative" : "relative py-20 sm:py-28"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Design system"
            title={<>Bitta til, <span className="text-brand-600">cheksiz ekran</span></>}
            description="SALEC brandidan olingan ranglar, tipografiya va komponentlar. Har bir qiymat token sifatida saqlanadi — dizayner va dasturchi bir xil tilda gaplashadi."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2">
                  <span className="size-2 rounded-full bg-brand-500" />
                  <span className="font-mono text-[10px] text-ink-2">v2.0.0 · stable</span>
                </div>
                <button
                  type="button"
                  onClick={downloadTokens}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[10.5px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <Download size={12} /> tokens.json
                </button>
              </div>
            }
          />
        </Reveal>

        <Reveal delay={80}>
          <div className="no-scrollbar mt-8 flex gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 sm:w-fit">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-semibold transition",
                  tab === t.key ? "bg-ink text-white" : "text-ink-2 hover:bg-[#F3F8F6]",
                )}
              >
                <t.icon size={12.5} /> {t.label}
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-4 rounded-[26px] border border-line bg-white p-4 shadow-[0_2px_4px_rgba(6,33,30,.03),0_30px_60px_-45px_rgba(6,33,30,.4)] sm:p-6">
            {tab === "rang" && (
              <div>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">Rang palitrasi</h3>
                    <p className="mt-0.5 text-[11px] text-ink-2/60">Ilova tokenlari: brend + neytral + semantik. Hex'ni bosib nusxalang.</p>
                    <p className="mt-1 font-mono text-[8.5px] text-muted">Sahifa mavzusi alohida — yuqoridagi palitra tugmasidan o'zgaradi</p>
                  </div>
                  <span className="rounded-full bg-[#F4F8F6] px-2.5 py-1 font-mono text-[9px] text-muted">12 core · 6 semantic</span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {palette.map((c) => (
                    <div key={c.name} className="group overflow-hidden rounded-[14px] border border-line bg-white">
                      <div
                        className="relative h-[74px] w-full transition-transform duration-300 group-hover:h-[86px]"
                        style={{ background: c.hex }}
                      >
                        <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-md bg-white/25 text-[8px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                          Aa
                        </span>
                        {c.hex === "#C8F56A" && <span className="absolute bottom-2 left-2 text-[8px] font-bold uppercase text-brand-900/60">accent</span>}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-ink">{c.name}</p>
                        <p className="mt-0.5 truncate font-mono text-[8px] uppercase text-muted">{c.hex}</p>
                        <div className="mt-1.5">
                          <CopyButton value={c.hex} label="nusxa" className="!border-0 !bg-[#F5F9F7] !px-1.5 !py-1 !text-[8px]" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="overflow-hidden rounded-[14px] p-4" style={{ background: "linear-gradient(120deg,#078179,#0B9A90 48%,#C8F56A 140%)" }}>
                    <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/60">brand gradient</p>
                    <p className="mt-6 font-display text-[15px] font-semibold text-white">Asosiy hero va CTA</p>
                    <p className="font-mono text-[8px] text-white/50">135° · 3 stop</p>
                  </div>
                  {[
                    { l: "Success", hex: "#22A06B", bg: "#EAF8F0" },
                    { l: "Warning", hex: "#E0A023", bg: "#FDF6E6" },
                    { l: "Error", hex: "#E0574B", bg: "#FDEDEB" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-[14px] border border-line p-3" style={{ background: s.bg }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold" style={{ color: s.hex }}>{s.l}</span>
                        <span className="size-2 rounded-full" style={{ background: s.hex }} />
                      </div>
                      <p className="mt-3 font-mono text-[8px] uppercase" style={{ color: s.hex }}>{s.hex}</p>
                      <p className="mt-1 text-[9px] text-ink-2/55">Soft background + ink matn</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "type" && (
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">Tipografik shkala</h3>
                      <p className="mt-0.5 text-[11px] text-ink-2/60">Sora — sarlavhalar, Inter — matn, JetBrains Mono — raqamlar.</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-[#FAFCFB] px-2 py-1.5">
                      <span className="font-mono text-[8.5px] text-muted">SIZE</span>
                      <input
                        type="range"
                        min={24}
                        max={64}
                        value={headingSize}
                        onChange={(e) => setHeadingSize(Number(e.target.value))}
                        className="h-1 w-24 accent-brand-600"
                        aria-label="Sarlavha o'lchami"
                      />
                      <span className="w-8 font-mono text-[9px] font-semibold text-ink">{headingSize}px</span>
                    </div>
                  </div>

                  <div className="mt-3 flex min-h-[156px] flex-col justify-center overflow-hidden rounded-[16px] border border-line bg-gradient-to-br from-[#F7FBF9] to-[#EFF6F3] p-5">
                    <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-muted">Live specimen</p>
                    <p
                      className="mt-2 font-display font-semibold leading-[1.02] tracking-[-0.04em] text-ink transition-all duration-200"
                      style={{ fontSize: `${headingSize}px` }}
                    >
                      Yangi avlod <span className="text-brand-600">interfeysi</span>
                    </p>
                    <p className="mt-2 text-[11px] text-ink-2/55">Har bir o'lcham 4px grid tizimiga moslashadi.</p>
                  </div>

                  <div className="mt-3 divide-y divide-line overflow-hidden rounded-[14px] border border-line">
                    {typeScale.map((t, i) => (
                      <div key={t.name} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[#FAFCFB]">
                        <span className="w-6 font-mono text-[8px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                        <span className="w-16 text-[9.5px] font-semibold text-ink">{t.name}</span>
                        <span className="flex-1 truncate text-[11px] text-ink-2/75" style={{ fontFamily: i < 3 ? "Sora, sans-serif" : i === 5 ? "JetBrains Mono, monospace" : "Inter, sans-serif" }}>
                          {t.sample}
                        </span>
                        <span className="hidden font-mono text-[8px] text-muted sm:inline">{t.weight}</span>
                        <span className="w-12 text-right font-mono text-[8px] text-muted">{t.size}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { name: "Sora", role: "Display / Sarlavha", family: "Sora, sans-serif", weights: "400 · 500 · 600 · 700", sample: "Aa" },
                    { name: "Inter", role: "UI / Body matn", family: "Inter, sans-serif", weights: "400 · 500 · 600 · 700", sample: "Aa" },
                    { name: "JetBrains Mono", role: "Raqam / Kod", family: "JetBrains Mono, monospace", weights: "400 · 500 · 600", sample: "04:57" },
                  ].map((f) => (
                    <div key={f.name} className="flex items-center gap-3 rounded-[14px] border border-line p-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink font-display text-[19px] font-semibold text-lime" style={{ fontFamily: f.family }}>
                        {f.sample}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11.5px] font-semibold text-ink">{f.name}</p>
                          <CopyButton value={`font-family: ${f.family};`} label="CSS" className="!px-1.5 !py-0.5 !text-[8px]" />
                        </div>
                        <p className="text-[9.5px] text-ink-2/55">{f.role}</p>
                        <p className="mt-0.5 font-mono text-[8px] text-muted">{f.weights}</p>
                      </div>
                    </div>
                  ))}
                  <div className="rounded-[14px] border border-line bg-[#FBFDFC] p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink"><Check size={11} className="text-brand-600" /> O'qiluvchanlik qoidalari</p>
                    <ul className="mt-1.5 space-y-1 text-[9px] leading-relaxed text-ink-2/65">
                      <li>· Body matn 14px dan kichik emas</li>
                      <li>· Matn va fon kontrasti 4.5:1 dan yuqori</li>
                      <li>· Raqamlar uchun tabular-nums</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {tab === "comp" && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[16px] border border-line p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Buttons</p>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">Amallar ierarxiyasi</h4>
                  <div className="mt-3 flex flex-col gap-2">
                    <button type="button" onClick={() => toast("Asosiy CTA bosildi")} className="group flex items-center justify-between rounded-full bg-brand-700 px-4 py-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-800">
                      Vizitni yakunlash <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                    <button type="button" onClick={() => toast("Ikkilamchi amal")} className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 py-2.5 text-[11px] font-semibold text-ink transition hover:border-brand-300 hover:text-brand-700">
                      <Plus size={13} /> Yangi buyurtma
                    </button>
                    <button type="button" onClick={() => toast("Matn tugmasi")} className="flex items-center justify-center gap-1 rounded-full px-4 py-2 text-[11px] font-semibold text-ink-2 transition hover:bg-[#F3F8F6] hover:text-ink">
                      Barchasini ko'rish <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-line p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Chips & segmented</p>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">Filtr holatlari</h4>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["Bugun", "Qarzdor", "A toifa", "VIP"].map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChip(i)}
                        className={cn(
                          "rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition",
                          chip === i ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-white text-ink-2 hover:border-brand-200",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-1 rounded-lg bg-[#F2F7F5] p-1">
                    {["Hafta", "Oy", "Yil"].map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeg(i)}
                        className={cn("flex-1 rounded-md py-1.5 text-[9.5px] font-semibold transition", seg === i ? "bg-white text-ink shadow-sm" : "text-muted")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-line bg-[#FBFDFC] px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[10px] text-ink-2"><Bell size={11} className="text-brand-600" /> Push xabarlar</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={toggle1}
                      aria-label="Push xabarlar"
                      onClick={() => setToggle1((v) => !v)}
                      className={cn("relative h-4 w-7 rounded-full transition-colors", toggle1 ? "bg-brand-600" : "bg-line-dark")}
                    >
                      <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", toggle1 ? "left-3.5" : "left-0.5")} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-line p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Input & search</p>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">Kiritish maydonlari</h4>
                  <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-line bg-[#F8FBFA] px-3 py-2.5 focus-within:border-brand-500 focus-within:bg-white">
                    <Search size={13} className="text-muted" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Mijoz yoki kod…"
                      className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-muted"
                      aria-label="Mijoz qidirish"
                    />
                    {q && <button type="button" onClick={() => setQ("")} className="text-muted"><span className="text-[11px]">×</span></button>}
                  </div>
                  <p className="mt-1.5 font-mono text-[8px] text-muted">{q ? `"${q}" · 0ms debounce demo` : "180ms debounce · lokal indeks"}</p>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-[#F1D9A8] bg-[#FEF8E8] px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[9.5px] font-medium text-[#8a6300]"><span className="grid size-4 place-items-center rounded-full bg-[#E9B949]/25 text-[8px]">!</span> Qarz limiti oshdi</span>
                    <span className="font-mono text-[8px] text-[#8a6300]">1.24 mln</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[9px] font-medium text-ink-2">Xavfsiz saqlash</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={toggle2}
                      aria-label="Xavfsiz saqlash"
                      onClick={() => setToggle2((v) => !v)}
                      className={cn("relative h-4 w-7 rounded-full transition-colors", toggle2 ? "bg-brand-600" : "bg-line-dark")}
                    >
                      <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", toggle2 ? "left-3.5" : "left-0.5")} />
                    </button>
                  </div>
                </div>

                <div className="rounded-[16px] border border-line p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Data card</p>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">KPI kartasi</h4>
                  <div className="mt-3 rounded-[12px] bg-gradient-to-br from-[#0B3B37] to-[#06211E] p-3 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[8.5px] text-white/50">Bugungi fakt</span>
                      <span className="rounded bg-lime/15 px-1.5 py-0.5 font-mono text-[7.5px] font-bold text-lime">+18%</span>
                    </div>
                    <p className="mt-1 font-display text-[20px] font-bold tracking-[-0.03em]">8.1 <span className="text-[10px] font-medium text-white/50">mln so'm</span></p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[65%] rounded-full bg-lime" />
                    </div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-line p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Avatar & identity</p>
                  <h4 className="mt-1 text-[13px] font-semibold text-ink">Jamoa</h4>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {["AQ", "MK", "SN", "DR"].map((a, i) => (
                        <span key={a} className="grid size-8 place-items-center rounded-full border-2 border-white text-[8.5px] font-bold text-white" style={{ background: ["#078179", "#2F7DF6", "#7A5CF0", "#F0714B"][i] }}>
                          {a}
                        </span>
                      ))}
                      <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-lime-soft text-[8.5px] font-bold text-brand-900">+8</span>
                    </div>
                    <span className="ml-auto rounded-full bg-[#F2F7F5] px-2 py-1 font-mono text-[8px] text-muted">online</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-line px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[9.5px] text-ink-2"><span className="size-1.5 rounded-full bg-[#22a06b]" /> 12 agent faol</span>
                    <ChevronRight size={12} className="text-muted" />
                  </div>
                </div>

                <div className="rounded-[16px] border border-dashed border-line-dark p-4">
                  <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted">Empty state</p>
                  <div className="mt-3 flex flex-col items-center justify-center py-4 text-center">
                    <span className="grid size-10 place-items-center rounded-full bg-[#F2F7F5] text-muted"><Search size={17} /></span>
                    <p className="mt-2 text-[11px] font-semibold text-ink">Hech narsa topilmadi</p>
                    <p className="mt-0.5 max-w-[180px] text-[9px] leading-relaxed text-ink-2/55">Filtrni o'zgartiring yoki qidiruvni tozalang</p>
                    <button type="button" onClick={() => toast("Filtr tozalandi")} className="mt-2.5 rounded-full border border-line px-2.5 py-1 text-[9px] font-semibold text-ink-2 transition hover:border-brand-300">
                      Filtrni tozalash
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === "shape" && (
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">Burchak radiuslari</h3>
                  <p className="mt-0.5 text-[11px] text-ink-2/60">Bir oila — turli vazifalar. Kartalar uchun 16, sheet uchun 20.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {radii.map((r) => (
                      <div key={r.name} className="group rounded-[12px] border border-line p-2.5 transition hover:border-brand-200 h-full">
                        <div className="grid h-12 place-items-center border border-dashed border-brand-200 bg-brand-50/60 text-brand-700 transition-transform duration-300 group-hover:scale-95" style={{ borderRadius: r.v === 999 ? "999px" : r.v, width: "100%" }}>
                          <span className="font-mono text-[8px]">{r.v === 999 ? "∞" : r.v}</span>
                        </div>
                        <p className="mt-1.5 text-[9.5px] font-semibold text-ink">{r.name}</p>
                        <p className="text-[8px] text-muted">{r.use}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">Bo'shliq tizimi</h3>
                  <p className="mt-0.5 text-[11px] text-ink-2/60">4px asosidagi shkala. Ekran chetlari 16–20px.</p>
                  <div className="mt-3 space-y-1.5 rounded-[14px] border border-line p-3">
                    {spaces.map((s) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="w-8 font-mono text-[8.5px] text-muted">{s}px</span>
                        <div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-200" style={{ width: `${s * 2.2}px` }} />
                        <span className="ml-auto font-mono text-[7.5px] text-muted/60">space-{s / 4}</span>
                      </div>
                    ))}
                  </div>

                  <h3 className="mt-5 font-display text-[17px] font-semibold tracking-[-0.02em] text-ink">Soyalar</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      { n: "soft", v: "0 16px 40px -20px rgba(6,33,30,.18)" },
                      { n: "card", v: "0 28px 60px -28px rgba(6,33,30,.24)" },
                      { n: "float", v: "0 24px 48px -20px rgba(7,129,121,.35)" },
                      { n: "inner", v: "inset 0 1px 0 rgba(255,255,255,.16)" },
                    ].map((s) => (
                      <div key={s.n} className="rounded-[12px] border border-line bg-white p-3" style={{ boxShadow: s.v }}>
                        <p className="font-mono text-[9px] font-semibold text-ink">shadow-{s.n}</p>
                        <p className="mt-1 truncate font-mono text-[7px] text-muted">{s.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { t: "Token-first", d: "Dizayn qarorlari kodda emas, tokenlarda saqlanadi.", v: "128" },
              { t: "Accessible", d: "AA kontrast, 44px tap maydon, focus ko'rinadi.", v: "AA" },
              { t: "Cross-platform", d: "Flutter va React uchun bitta manba.", v: "2×" },
            ].map((c) => (
              <div key={c.t} className="flex items-center gap-3 rounded-[16px] border border-line bg-white/60 p-3.5">
                <span className="font-display text-[20px] font-bold tracking-tight text-brand-700">{c.v}</span>
                <div>
                  <p className="text-[11px] font-semibold text-ink">{c.t}</p>
                  <p className="text-[9.5px] leading-snug text-ink-2/60">{c.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
