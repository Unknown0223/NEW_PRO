import { ArrowRight, ArrowUpRight, Landmark, Layers, Truck, UserRound, Users, type LucideIcon } from "lucide-react";
import { accents, roles, screens, sharedModules, type RoleKey, type ScreenKey } from "../data/design";
import { Badge, Reveal, SectionHead } from "./ui";

const roleIcon: Record<RoleKey, LucideIcon> = { agent: UserRound, expeditor: Truck, supervisor: Users, cashier: Landmark };

export default function Roles({ onOpen, embedded = false }: { onOpen: (screen: ScreenKey) => void; embedded?: boolean }) {
  return (
    <section id="rollar" className={embedded ? "relative" : "relative py-20 sm:py-24"}>
      <div className={embedded ? "" : "container-x"}>
        <Reveal>
          <SectionHead
            eyebrow="Rollar bo'yicha ilovalar"
            title={<>Bitta ilova, <span className="text-brand-600">4 ta rol</span>, umumiy yadro</>}
            description="SALEC mobil ilovasi rolga qarab turli interfeys ko'rsatadi. Har rol o'z aksent rangi, tab-bar va ekranlar to'plamiga ega — lekin dizayn tizimi, auth va sinxronlash umumiy."
            right={
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand"><Layers size={11} /> 80 repo · 54 prototip</Badge>
                <Badge tone="lime">54 interaktiv ekran</Badge>
              </div>
            }
          />
        </Reveal>

        <div className="mt-9 grid gap-4 lg:grid-cols-2">
          {roles.map((r, i) => {
            const a = accents.find((x) => x.id === r.accentId) ?? accents[0];
            const Icon = roleIcon[r.key];
            const list = screens.filter((s) => s.role === r.key);
            return (
              <Reveal key={r.key} delay={i * 70}>
                <div className="group card-hover relative h-full overflow-hidden rounded-[24px] border border-line bg-white">
                  <div className="relative overflow-hidden p-5" style={{ background: a.gradient, color: a.onAccent }}>
                    <div className="absolute -right-10 -top-12 size-40 rounded-full" style={{ background: a.onAccent === "#FFFFFF" ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.28)" }} />
                    <div className="absolute right-10 -bottom-14 size-28 rounded-full" style={{ background: a.onAccent === "#FFFFFF" ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.2)" }} />
                    <div className="relative flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center rounded-2xl backdrop-blur" style={{ background: a.onAccent === "#FFFFFF" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.14)" }}><Icon size={20} /></span>
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-65">{r.key}</p>
                          <h3 className="font-display text-[20px] font-semibold tracking-[-0.03em]">{r.name}</h3>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[26px] font-bold leading-none">{r.screensCount}</p>
                        <p className="text-[9px] opacity-65">ekran</p>
                      </div>
                    </div>
                    <p className="relative mt-3 max-w-md text-[11.5px] leading-relaxed opacity-85">{r.description}</p>
                    <div className="relative mt-3 flex items-center gap-2">
                      <span className="size-3 rounded-full border" style={{ background: a.hex, borderColor: a.onAccent === "#FFFFFF" ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.3)" }} />
                      <span className="font-mono text-[9px] opacity-75">{a.hex} · {a.name}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {r.modules.map((m) => (
                        <span key={m} className="rounded-md border border-line bg-[#F7FAF9] px-2 py-1 text-[9.5px] font-semibold text-ink-2">{m}</span>
                      ))}
                    </div>
                    <div className="mt-3 divide-y divide-line/80 overflow-hidden rounded-[14px] border border-line">
                      {list.map((s) => (
                        <button key={s.key} type="button" onClick={() => onOpen(s.key)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#F7FAF9]">
                          <span className="size-1.5 rounded-full" style={{ background: a.hex }} />
                          <span className="flex-1 truncate text-[10.5px] font-medium text-ink">{s.label.replace(/^.*· /, "")}</span>
                          <span className="hidden font-mono text-[8px] text-muted sm:inline">{s.tags[0]}</span>
                          <ArrowUpRight size={12} className="text-muted" />
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => onOpen(r.homeScreen)} className="group/btn mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: a.ink }}>
                      Prototipni ochish <ArrowRight size={12} className="transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120}>
          <div className="mt-4 rounded-[22px] border border-line surface-tint p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">Umumiy yadro</p>
                <p className="mt-1 text-[13.5px] font-semibold text-ink">Barcha rollar uchun bir xil modullar</p>
              </div>
              <span className="font-mono text-[9px] text-muted">auth · attendance · tasks · notifications · profile · sync</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {sharedModules.map((m) => (
                <button key={m.key} type="button" onClick={() => onOpen(m.key)} className="group flex items-center gap-3 rounded-[14px] border border-line bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft">
                  <span className="grid size-9 place-items-center rounded-xl bg-ink text-lime"><Layers size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-ink">{m.label}</span>
                    <span className="block truncate text-[9px] text-ink-2/60">{m.text}</span>
                  </span>
                  <ArrowUpRight size={13} className="text-muted transition group-hover:text-brand-600" />
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
