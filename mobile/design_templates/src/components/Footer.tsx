import { ArrowRight, ArrowUp, ArrowUpRight, Check, Command, Github, Mail, Send, Sparkles } from "lucide-react";
import ScreenThumb from "./ScreenThumb";
import { workspaceViews, type RoleKey, type ViewKey } from "../data/design";
import { Logo, Reveal, useToast } from "./ui";

export default function Footer({
  onOpenPalette,
  onOpenRole,
  onOpenView,
}: {
  onOpenPalette: () => void;
  onOpenRole: (r: RoleKey) => void;
  onOpenView: (v: ViewKey) => void;
}) {
  const toast = useToast();

  const groups = [
    {
      title: "Mahsulot",
      links: workspaceViews.map((v) => ({ label: v.label, view: v.key })),
    },
    {
      title: "Resurslar",
      links: [
        { label: "Token JSON", view: "dizayn" as ViewKey },
        { label: "Figma kutubxonasi", view: "katalog" as ViewKey },
        { label: "Performance checklist", view: "tezlik" as ViewKey },
        { label: "Motion lab", view: "harakat" as ViewKey },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden border-t border-line bg-paper pt-16">
      <div className="container-x">
        <Reveal>
          <div className="canvas-dark relative overflow-hidden rounded-[30px] p-6 sm:p-10">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="amb-mesh absolute inset-0 opacity-55" />
              <div className="amb amb-1 absolute -right-20 -top-24 size-[380px] rounded-full opacity-40 blur-[80px]" />
              <div className="amb amb-3 absolute bottom-0 left-1/3 size-64 rounded-full opacity-25 blur-[70px]" />
              <div className="dot-grid-dark absolute inset-0 opacity-40" />
            </div>

            <div className="relative grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/20 bg-lime/10 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-lime">
                  <Sparkles size={10} /> Keyingi qadam
                </span>
                <h2 className="mt-4 max-w-[460px] font-display text-[30px] font-semibold leading-[1.04] tracking-[-0.04em] text-white text-balance sm:text-[40px]">
                  Shablonni tanladingizmi?
                  <br />
                  <span className="text-amb-gradient">Endi birga yig'amiz.</span>
                </h2>
                <p className="mt-3 max-w-[420px] text-[12.5px] leading-relaxed text-white/50">
                  Dizayn tizimi va 12 shablon tayyor. Ekranlarni Flutter ilovaga ko'chirish, animatsiya
                  byudjetini sozlash va birinchi releasni chiqarish — keyingi bosqich.
                </p>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onOpenView("prototip")}
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-lime px-5 py-3 text-[12px] font-bold text-midnight transition hover:bg-[#d7fa8c]"
                  >
                    Studioda davom etish
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    type="button"
                    onClick={onOpenPalette}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[12px] font-semibold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/10"
                  >
                    <Command size={14} /> ⌘K bilan navigatsiya
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {(["agent", "expeditor", "supervisor", "cashier"] as RoleKey[]).map((r) => (
                    <button key={r} type="button" onClick={() => onOpenRole(r)} className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[9px] font-medium text-white/60 transition hover:border-lime/30 hover:text-lime">
                      {r === "agent" ? "Agent" : r === "expeditor" ? "Ekspeditor" : r === "supervisor" ? "Supervayzer" : "Kassir"}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[9.5px] text-white/35">
                  <span className="flex items-center gap-1.5"><Check size={10} className="text-lime" /> Figma fayllar</span>
                  <span className="flex items-center gap-1.5"><Check size={10} className="text-lime" /> Token JSON</span>
                  <span className="flex items-center gap-1.5"><Check size={10} className="text-lime" /> Flutter / React kodi</span>
                  <span className="flex items-center gap-1.5"><Check size={10} className="text-lime" /> 54 ekran</span>
                </div>
              </div>

              <div className="relative flex h-[250px] items-center justify-center sm:h-[280px]">
                <div className="absolute left-2 top-6 hidden -rotate-[10deg] opacity-70 min-[420px]:block sm:left-6">
                  <ScreenThumb kind="login" />
                </div>
                <div className="absolute right-2 top-1 hidden rotate-[9deg] opacity-80 min-[420px]:block sm:right-6">
                  <ScreenThumb kind="kpi" />
                </div>
                <div className="relative z-10 translate-y-2 scale-[1.12] transition-transform duration-500 hover:scale-[1.18]">
                  <ScreenThumb kind="home" />
                </div>
                <span className="absolute bottom-0 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-midnight/80 px-3 py-1.5 font-mono text-[8px] text-white/50 backdrop-blur">
                  <span className="size-1.5 rounded-full bg-lime" /> 8 interaktiv ekran
                </span>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-[260px] text-[11.5px] leading-relaxed text-ink-2/65">
              SALEC agent ilovasi uchun qayta ishlangan dizayn va harakat tizimi. Tez, jonli va oflayn-first.
            </p>
            <div className="mt-4 flex items-center gap-1.5">
              <a
                href="https://github.com/Unknown0223/NEW_PRO"
                target="_blank"
                rel="noreferrer"
                className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink-2 transition hover:border-brand-300 hover:text-brand-700"
                aria-label="GitHub"
              >
                <Github size={14} />
              </a>
              <button type="button" onClick={() => toast("Telegram havolasi nusxalandi")} className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink-2 transition hover:border-brand-300 hover:text-brand-700" aria-label="Telegram">
                <Send size={14} />
              </button>
              <button type="button" onClick={() => toast("design@salec.uz")} className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink-2 transition hover:border-brand-300 hover:text-brand-700" aria-label="Email">
                <Mail size={14} />
              </button>
            </div>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">{g.title}</p>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <button type="button" onClick={() => onOpenView(l.view)} className="group inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-2/75 transition hover:text-brand-700">
                      {l.label}
                      <ArrowUpRight size={10} className="opacity-0 transition group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-muted">Newsletter</p>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-2/65">Yangi shablonlar va dizayn tizimi yangilanishlari.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                toast("Obuna rasmiylashtirildi");
                (e.currentTarget as HTMLFormElement).reset();
              }}
              className="mt-3 flex items-center gap-1 rounded-full border border-line bg-white p-1 pl-3 focus-within:border-brand-400"
            >
              <input
                required
                type="email"
                placeholder="email@salec.uz"
                aria-label="Email manzil"
                className="w-full bg-transparent text-[11px] text-ink outline-none placeholder:text-muted/70"
              />
              <button type="submit" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800" aria-label="Obuna bo'lish">
                <ArrowRight size={12} />
              </button>
            </form>
            <p className="mt-2 font-mono text-[8px] text-muted">Spam yo'q · 1 marta / oy</p>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-line py-5 sm:flex-row sm:items-center">
          <p className="font-mono text-[9px] text-muted">
            © 2026 SALEC Design Studio · Agent 2.0 · <span className="text-ink-2/60">NEW_PRO</span> asosida qayta ishlangan
          </p>
          <div className="flex items-center gap-4">
            <span className="font-mono text-[9px] text-muted">Flutter · React · Figma</span>
            <a href="#top" className="group flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-[9.5px] font-medium text-ink-2 transition hover:border-brand-300 hover:text-brand-700">
              Yuqoriga <ArrowUp size={11} className="transition-transform group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
