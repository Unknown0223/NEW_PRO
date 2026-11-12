import { useState } from "react";
import { ArrowUpRight, Download, Eye, FileStack, Layers3, Sparkles } from "lucide-react";
import { accents, roles, templates, type RoleKey, type ScreenKey, type Template } from "../data/design";
import ScreenThumb from "./ScreenThumb";
import { Badge, Reveal, SectionHead, useToast } from "./ui";
import { cn } from "../utils/cn";

const categories = ["Barchasi", "Onboarding", "Operatsiya", "Analitika", "Sozlama"] as const;

const backdrops: Record<Template["category"], string> = {
  Onboarding: "from-[#E8F4F0] via-[#E1F0EB] to-[#D2E9E3]",
  Operatsiya: "from-[#F2F7F3] via-[#E9F1EC] to-[#DDEAE2]",
  Analitika: "from-[#EAF2F6] via-[#E2EDF2] to-[#D4E4EB]",
  Sozlama: "from-[#F6F2E9] via-[#F0EADD] to-[#E7DFCE]",
};

export default function Templates({ onOpen, embedded = false }: { onOpen: (screen: ScreenKey) => void; embedded?: boolean }) {
  const [filter, setFilter] = useState<(typeof categories)[number]>("Barchasi");
  const [roleFilter, setRoleFilter] = useState<RoleKey | "all" | "shared">("all");
  const toast = useToast();
  const list = templates
    .filter((t) => (filter === "Barchasi" ? true : t.category === filter))
    .filter((t) => (roleFilter === "all" ? true : t.role === roleFilter));
  const roleAccent = (r: Template["role"]) => (r === "shared" ? accents[0] : accents.find((a) => a.id === roles.find((x) => x.key === r)?.accentId) ?? accents[0]);
  const roleColor = (r: Template["role"]) => roleAccent(r).ink;
  const roleName = (r: Template["role"]) => (r === "shared" ? "Umumiy" : roles.find((x) => x.key === r)?.short ?? r);

  const open = (template: Template) => {
    if (template.screen) {
      onOpen(template.screen);
      toast(`${template.title} — studio'da ochildi`);
    } else {
      toast(`${template.title} konsept bosqichida — tez orada`);
    }
  };

  return (
    <section id="shablonlar" className={embedded ? "relative" : "relative border-y border-line/70 bg-paper py-20 sm:py-28"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Shablon katalogi"
            title={<>54 ekran, <span className="text-brand-600">4 rol</span>, bitta tizim</>}
            description="Har bir shablon — real stsenariy uchun. Prevyuni bosib studio'da sinab ko'ring, tokenlarni oling va jamoaga bering."
            right={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand"><Layers3 size={11} /> 128 token</Badge>
                <Badge tone="lime"><Sparkles size={11} /> 54 interaktiv</Badge>
                <button
                  type="button"
                  onClick={() => toast("Figma kutubxonasi havolasi nusxalandi")}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                >
                  <Download size={12} /> Figma
                </button>
              </div>
            }
          />
        </Reveal>

        <Reveal delay={60}>
          <div className="no-scrollbar mt-7 flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="mr-1 shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Rol</span>
            {([{ key: "all", label: "Barcha rollar", hex: "#06211E" }, ...roles.map((r) => ({ key: r.key, label: r.short, hex: accents.find((a) => a.id === r.accentId)?.hex ?? "#078179" })), { key: "shared", label: "Umumiy", hex: "#6D827B" }] as { key: RoleKey | "all" | "shared"; label: string; hex: string }[]).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRoleFilter(r.key)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition", roleFilter === r.key ? "border-transparent text-white" : "border-line bg-white text-ink-2 hover:border-brand-300")}
                style={roleFilter === r.key ? { background: r.hex } : undefined}
              >
                <span className="size-1.5 rounded-full" style={{ background: roleFilter === r.key ? "#fff" : r.hex }} />
                {r.label}
                <span className={cn("font-mono text-[8.5px]", roleFilter === r.key ? "text-white/70" : "text-muted")}>{r.key === "all" ? templates.length : templates.filter((t) => t.role === r.key).length}</span>
              </button>
            ))}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="no-scrollbar mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((c) => {
              const base = roleFilter === "all" ? templates : templates.filter((t) => t.role === roleFilter);
              const n = c === "Barchasi" ? base.length : base.filter((t) => t.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[11.5px] font-semibold transition-all",
                    filter === c
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-white text-ink-2 hover:border-brand-300 hover:text-brand-700",
                  )}
                >
                  {c}
                  <span className={cn("font-mono text-[9px]", filter === c ? "text-lime" : "text-muted")}>{n}</span>
                </button>
              );
            })}
            <span className="ml-auto hidden shrink-0 items-center gap-1.5 font-mono text-[9.5px] text-muted sm:flex">
              <span className="size-1.5 rounded-full bg-[#22b573]" /> {templates.filter((t) => t.status !== "Konsept").length} tayyor · {templates.filter((t) => t.status === "Konsept").length} konsept
            </span>
          </div>
        </Reveal>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((template, i) => (
            <Reveal key={template.id} delay={Math.min(i * 45, 240)}>
              <button
                type="button"
                onClick={() => open(template)}
                aria-label={`${template.title} shablonini ochish`}
                className="group card-hover relative block h-full w-full overflow-hidden rounded-[22px] border border-line bg-white p-2.5 text-left"
              >
                <div className={cn("relative h-[222px] overflow-hidden rounded-[16px] bg-gradient-to-br", backdrops[template.category])}>
                  <div className="dot-grid absolute inset-0 opacity-[0.35]" />
                  <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
                    <span className="rounded-md bg-white/75 px-1.5 py-1 font-mono text-[9px] font-bold text-ink-2 backdrop-blur">{template.no}</span>
                    <span className="flex items-center gap-1 rounded-md bg-white/75 px-1.5 py-1 text-[8px] font-bold backdrop-blur" style={{ color: roleColor(template.role) }}>
                      <span className="size-1.5 rounded-full" style={{ background: roleColor(template.role) }} />{roleName(template.role)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8.5px] font-bold uppercase tracking-wider backdrop-blur",
                      template.status === "Yangi"
                        ? "border-brand-600/20 bg-brand-600 text-white"
                        : template.status === "Konsept"
                          ? "border-white/60 bg-white/80 text-muted"
                          : "border-white/60 bg-white/80 text-brand-800",
                    )}
                  >
                    {template.status === "Yangi" && <span className="size-1.5 rounded-full bg-lime" />}
                    {template.status}
                  </span>

                  <div className="flex h-full items-center justify-center pt-4 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 group-hover:scale-[1.04]">
                    <ScreenThumb
                      kind={template.kind}
                      tint={(() => {
                        const a = roleAccent(template.role);
                        return { hex: a.hex, soft: a.soft, ink: a.ink, deep: a.ink, on: a.onAccent };
                      })()}
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/25 to-transparent pb-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[9.5px] font-semibold text-ink shadow-sm backdrop-blur">
                      <Eye size={11} /> {template.screen ? "Prevyuni ochish" : "Konseptni ko'rish"}
                    </span>
                  </div>
                </div>

                <div className="px-1.5 pb-0.5 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-[14.5px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                      {template.title}
                    </h3>
                    <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-muted transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                  <p className="mt-1 line-clamp-1 text-[10.5px] text-ink-2/65">{template.subtitle}</p>
                  <div className="mt-2.5 flex items-center justify-between border-t border-line/80 pt-2.5">
                    <div className="no-scrollbar flex gap-1 overflow-hidden">
                      {template.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="shrink-0 rounded bg-[#F4F8F6] px-1.5 py-1 font-mono text-[7.5px] text-ink-2/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <span className="shrink-0 font-mono text-[8px] text-muted">{template.effort}</span>
                  </div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 overflow-hidden rounded-[22px] border border-line bg-gradient-to-r from-[#F6FAF8] to-white p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl border border-brand-200/60 bg-brand-50 text-brand-700">
                <FileStack size={20} />
              </span>
              <div>
                <p className="text-[13.5px] font-semibold text-ink">Repo'dagi 80 ekran · 54 tasi prototipda — Figma + Flutter + React</p>
                <p className="mt-0.5 text-[11px] text-ink-2/60">Har bir ekran 3 breakpointda, komponentlar bilan birga.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toast("To'plam yuklab olish navbatga qo'shildi")}
              className="group inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-lime px-4 py-2.5 text-[11.5px] font-bold text-midnight transition hover:bg-[#d7fa8c] sm:w-auto"
            >
              <Download size={13} /> To'plamni yuklab olish
              <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
