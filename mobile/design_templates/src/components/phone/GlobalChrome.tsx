import { useState } from "react";
import {
  Bell, Check, ChevronRight, Grid3X3, Home, Layers3, Menu, Moon, Palette, RefreshCw, Settings, Sun, UserRound, Wifi, X, type LucideIcon,
} from "lucide-react";
import { accents, roles, screens, templates, type Accent, type MotionLevel, type RoleKey, type ScreenKey, type ThemeMode } from "../../data/design";
import { canvasThemes } from "../../data/themes";
import { cn } from "../../utils/cn";
import { BRAND, BrandWordmark } from "./Brand";
import type { Tokens } from "./PhoneScreens";
import type { MotionVariant } from "./BrandSync";

export type MenuTheme = "light" | "dark" | "tinted";

/** The 18 items of `agent_menu_config.dart`, mapped to our screens. */
const REPO_MENU: { label: string; screen: ScreenKey; soon?: boolean }[] = [
  { label: "Bosh sahifa", screen: "home" },
  { label: "Yangi savdo nuqtasi", screen: "new-client" },
  { label: "Almashtirish so'rovi", screen: "shelf-return" },
  { label: "Polkadan qaytarish (S polki)", screen: "shelf-return" },
  { label: "KPI", screen: "kpi" },
  { label: "Kunlik reja", screen: "route-plan" },
  { label: "Hisobotlar", screen: "report" },
  { label: "Savdo nuqtalari", screen: "clients" },
  { label: "Maosh", screen: "tabel", soon: true },
  { label: "Qarzdorlar", screen: "exp-debtors" },
  { label: "Buyurtma bo'yicha qarzlar", screen: "debtors-by-orders" },
  { label: "Ombor qoldiqlari", screen: "warehouse" },
  { label: "Qoralamalar", screen: "drafts" },
  { label: "Vazifalar", screen: "tasks" },
  { label: "Mening lokatsiyam", screen: "map" },
  { label: "Tabel", screen: "tabel" },
  { label: "Davomat (Face ID)", screen: "attendance" },
  { label: "Sozlamalar", screen: "profile" },
];

const SYNC_OPTIONS: { key: MotionVariant; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "identity", label: "Rol kartasi", hint: "Rasm, raqam va ruxsatlar", icon: UserRound },
  { key: "quick", label: "Oddiy sinxron", hint: "Faqat o'zgargan yozuvlar", icon: RefreshCw },
  { key: "full", label: "Hammasini sinxronlash", hint: "To'liq kesh va foto", icon: Layers3 },
];

type Props = {
  t: Tokens;
  accent: Accent;
  role: RoleKey;
  activeScreen: ScreenKey;
  go: (s: ScreenKey) => void;
  toast: (m: string) => void;
  onRole: (r: RoleKey) => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  motion: MotionLevel;
  setMotion: (m: MotionLevel) => void;
  appAccentId: string | null;
  setAppAccentId: (id: string | null) => void;
  menuTheme: MenuTheme;
  setMenuTheme: (m: MenuTheme) => void;
  canvasId: string;
  setCanvasId: (id: string) => void;
  onSync: (v: MotionVariant) => void;
};

export default function GlobalChrome(p: Props) {
  const [panel, setPanel] = useState<null | "menu" | "sync" | "settings" | "quick">(null);
  const { t, accent, role, activeScreen, go } = p;
  const roleDef = roles.find((r) => r.key === role) ?? roles[0];
  const open = (which: typeof panel) => setPanel((cur) => (cur === which ? null : which));
  const close = () => setPanel(null);

  const barBg = p.menuTheme === "dark" ? "#101724" : p.menuTheme === "tinted" ? `color-mix(in srgb, ${accent.hex} 12%, #ffffff)` : t.card;
  const sheetBg = p.menuTheme === "dark" ? "#131B29" : p.menuTheme === "tinted" ? `color-mix(in srgb, ${accent.hex} 9%, #ffffff)` : "#FFFFFF";
  const sheetInk = p.menuTheme === "dark" ? "#E9EEF7" : "#0E1420";
  const sheetSub = p.menuTheme === "dark" ? "#9AA7BA" : "#677386";
  const sheetLine = p.menuTheme === "dark" ? "rgba(255,255,255,.12)" : "#E4E8EF";

  const goTo = (s: ScreenKey) => {
    close();
    go(s);
  };

  const groups = Array.from(new Set(screens.map((s) => s.group)));

  return (
    <>
      {/* ───────── top bar — visible on EVERY screen ───────── */}
      <div className="ch-bar flex h-[36px] items-center justify-between gap-2 border-b px-2.5" style={{ background: barBg, borderColor: sheetLine }} data-global-chrome="1">
        <button
          type="button"
          onClick={() => open("menu")}
          aria-label="Menyuni ochish"
          aria-expanded={panel === "menu"}
          className="grid size-8 shrink-0 place-items-center rounded-lg transition active:scale-90"
          style={{ background: panel === "menu" ? `${accent.hex}22` : "transparent", color: panel === "menu" ? accent.hex : sheetInk }}
        >
          <Menu size={16} strokeWidth={2.2} />
        </button>

        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <BrandWordmark size={12} tone={p.menuTheme === "dark" ? "dark" : "light"} />
          <span className="truncate text-[7.5px] font-medium" style={{ color: sheetSub }}>· {roleDef.short}</span>
        </span>

        <div className="flex shrink-0 items-center gap-0.5" aria-label="Yuqori amallar">
          <TopIcon label="Sinxronlash" active={panel === "sync"} onClick={() => open("sync")} icon={RefreshCw} accent={accent.hex} ink={sheetInk} badge />
          <TopIcon label="Sozlamalar va tema" active={panel === "settings"} onClick={() => open("settings")} icon={Palette} accent={accent.hex} ink={sheetInk} />
          <TopIcon label="Tezkor menyu" active={panel === "quick"} onClick={() => open("quick")} icon={Grid3X3} accent={accent.hex} ink={sheetInk} />
        </div>
      </div>

      {/* ───────── veil + slide-out panels ───────── */}
      <div className="pointer-events-none absolute inset-0 z-[60]" style={{ pointerEvents: panel ? "auto" : "none" }}>
        <div className="ch-veil absolute inset-0 bg-black/45" style={{ opacity: panel ? 1 : 0 }} onClick={close} aria-hidden={!panel} />

        {/* LEFT: full menu, grouped by section — every screen + repo menu */}
        <aside
          className="ch-drawer absolute inset-y-0 left-0 w-[262px] overflow-hidden rounded-r-[20px] shadow-2xl"
          style={{ transform: panel === "menu" ? "none" : "translateX(-104%)", background: sheetBg, color: sheetInk }}
          aria-label="Asosiy menyu"
          aria-hidden={panel !== "menu"}
        >
          <div className="flex items-center gap-2 border-b px-3 py-3" style={{ borderColor: sheetLine }}>
            <span className="grid size-8 place-items-center rounded-xl text-white" style={{ background: accent.gradient }}>
              <Menu size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold">Menyu</p>
              <p className="truncate text-[8px]" style={{ color: sheetSub }}>Sales Arena · {roleDef.name}</p>
            </div>
            <button type="button" onClick={close} aria-label="Menyuni yopish" className="grid size-7 place-items-center rounded-lg" style={{ background: p.menuTheme === "dark" ? "#1E2838" : "#F2F4F7" }}>
              <X size={13} />
            </button>
          </div>

          <div className="scroll-thin h-[calc(100%-58px)] overflow-y-auto px-2 pb-4">
            {/* roles */}
            <p className="px-2 pb-1 pt-2.5 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: sheetSub }}>Rol</p>
            <div className="grid grid-cols-4 gap-1">
              {roles.map((r) => {
                const a = accents.find((x) => x.id === r.accentId) ?? accent;
                const on = r.key === role;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => { close(); p.onRole(r.key); }}
                    className="rounded-lg border px-1 py-1.5 text-[7.5px] font-semibold"
                    style={{ borderColor: on ? a.hex : sheetLine, background: on ? `${a.hex}1A` : "transparent", color: on ? a.hex : sheetSub }}
                  >
                    {r.short}
                  </button>
                );
              })}
            </div>

            {/* all screens by section */}
            {groups.map((g) => (
              <div key={g}>
                <p className="px-2 pb-1 pt-3 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: sheetSub }}>{g} · {screens.filter((s) => s.group === g).length}</p>
                {screens.filter((s) => s.group === g).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => goTo(s.key)}
                    className="flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left"
                    style={{ background: activeScreen === s.key ? `${accent.hex}18` : "transparent", color: activeScreen === s.key ? accent.hex : sheetInk }}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: activeScreen === s.key ? accent.hex : sheetSub }} />
                    <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium">{s.label}</span>
                    <ChevronRight size={10} style={{ color: sheetSub }} />
                  </button>
                ))}
              </div>
            ))}

            {/* repo menu */}
            <p className="px-2 pb-1 pt-3 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: sheetSub }}>Loyiha menyusi · 18 band</p>
            {REPO_MENU.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => { if (!m.soon) goTo(m.screen); else p.toast("«Maosh» moduli tez orada"); }}
                className="flex w-full items-center gap-2 rounded-[9px] px-2 py-1.5 text-left"
                style={{ opacity: m.soon ? 0.55 : 1, color: sheetInk }}
              >
                <span className="min-w-0 flex-1 truncate text-[9px]">{m.label}</span>
                {m.soon ? <span className="rounded bg-[#FEF08A] px-1 text-[6.5px] font-bold text-[#854D0E]">Скоро</span> : <ChevronRight size={9} style={{ color: sheetSub }} />}
              </button>
            ))}

            {/* templates */}
            <p className="px-2 pb-1 pt-3 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: sheetSub }}>Shablonlar · {templates.length}</p>
            {Array.from(new Set(templates.map((x) => x.category))).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => goTo(templates.find((x) => x.category === c && x.screen)?.screen ?? "menu")}
                className="flex w-full items-center justify-between rounded-[9px] px-2 py-1.5 text-left text-[9px]"
                style={{ color: sheetInk }}
              >
                <span className="flex items-center gap-2"><Layers3 size={10} style={{ color: accent.hex }} /> {c}</span>
                <span className="font-mono text-[7.5px]" style={{ color: sheetSub }}>{templates.filter((x) => x.category === c).length}</span>
              </button>
            ))}

            {/* settings shortcut */}
            <button
              type="button"
              onClick={() => setPanel("settings")}
              className="mt-3 flex w-full items-center gap-2 rounded-[10px] border px-2 py-2 text-[9.5px] font-semibold"
              style={{ borderColor: sheetLine, background: p.menuTheme === "dark" ? "#1E2838" : "#F2F4F7", color: sheetInk }}
            >
              <Settings size={12} style={{ color: accent.hex }} /> Sozlamalar va tema <ChevronRight size={11} className="ml-auto" />
            </button>
          </div>
        </aside>

        {/* RIGHT: sync — three separate slide-outs */}
        <aside
          className="ch-drawer absolute inset-y-0 right-0 w-[240px] overflow-hidden rounded-l-[20px] shadow-2xl"
          style={{ transform: panel === "sync" ? "none" : "translateX(104%)", background: sheetBg, color: sheetInk }}
          aria-label="Sinxronlash turlari"
          aria-hidden={panel !== "sync"}
        >
          <SheetHead title="Sinxronlash" sub="3 xil alohida jarayon" onClose={close} line={sheetLine} subColor={sheetSub} />
          <div className="space-y-2 p-3">
            {SYNC_OPTIONS.map((o, i) => (
              <button
                key={o.key}
                type="button"
                onClick={() => { close(); p.onSync(o.key); }}
                className="flex w-full items-start gap-2.5 rounded-[12px] border p-2.5 text-left transition active:scale-[0.98]"
                style={{ borderColor: sheetLine, background: i === 2 ? `${accent.hex}10` : "transparent" }}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[10px]" style={{ background: `${accent.hex}1A`, color: accent.hex }}>
                  <o.icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold">{o.label}</span>
                  <span className="mt-0.5 block text-[8px]" style={{ color: sheetSub }}>{o.hint}</span>
                  <span className="mt-1 block font-mono text-[7px]" style={{ color: accent.hex }}>{roleDef.short} animatsiyasi bilan</span>
                </span>
                <ChevronRight size={11} className="mt-1" style={{ color: sheetSub }} />
              </button>
            ))}
            <div className="flex items-center gap-2 rounded-[10px] border px-2.5 py-2" style={{ borderColor: sheetLine }}>
              <Wifi size={11} style={{ color: accent.hex }} />
              <span className="flex-1 text-[8.5px]" style={{ color: sheetSub }}>Oflayn kesh tayyor</span>
              <span className="font-mono text-[8px] font-bold">12:48</span>
            </div>
            <button type="button" onClick={() => goTo("sync")} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border py-2 text-[9px] font-semibold" style={{ borderColor: sheetLine }}>
              <RefreshCw size={11} /> Sinxron ekranini ochish
            </button>
          </div>
        </aside>

        {/* RIGHT: settings — colour + menu theme + page theme */}
        <aside
          className="ch-drawer absolute inset-y-0 right-0 w-[248px] overflow-hidden rounded-l-[20px] shadow-2xl"
          style={{ transform: panel === "settings" ? "none" : "translateX(104%)", background: sheetBg, color: sheetInk }}
          aria-label="Sozlamalar"
          aria-hidden={panel !== "settings"}
        >
          <SheetHead title="Sozlamalar" sub="Rang va menyu temalari" onClose={close} line={sheetLine} subColor={sheetSub} />
          <div className="scroll-thin h-[calc(100%-58px)] space-y-3 overflow-y-auto p-3">
            <Section title="Ilova rangi" subColor={sheetSub}>
              <div className="flex flex-wrap gap-1.5">
                {accents.map((a) => {
                  const on = (p.appAccentId ?? accent.id) === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { p.setAppAccentId(a.id); p.toast(`${a.name} rangi qo'llandi`); }}
                      aria-label={a.name}
                      aria-pressed={on}
                      title={a.name}
                      className={cn("grid size-7 place-items-center rounded-full transition", on && "ring-2 ring-offset-2")}
                      style={{ background: a.gradient, color: a.onAccent, ["--tw-ring-color" as string]: a.hex }}
                    >
                      {on && <Check size={12} strokeWidth={3.5} />}
                    </button>
                  );
                })}
                <button type="button" onClick={() => { p.setAppAccentId(null); p.toast("Rol rangi tiklandi"); }} className="rounded-full border px-2 text-[8px] font-semibold" style={{ borderColor: sheetLine, color: sheetSub }}>
                  Rol rangi
                </button>
              </div>
            </Section>

            <Section title="Menyu temasi" subColor={sheetSub}>
              <div className="grid grid-cols-3 gap-1.5">
                {([{ k: "light", l: "Yorug'", bg: "#FFFFFF" }, { k: "dark", l: "Qorong'i", bg: "#131B29" }, { k: "tinted", l: "Rangli", bg: `color-mix(in srgb, ${accent.hex} 12%, white)` }] as const).map((m) => (
                  <button
                    key={m.k}
                    type="button"
                    onClick={() => { p.setMenuTheme(m.k); p.toast(`Menyu: ${m.l}`); }}
                    className="flex flex-col items-center gap-1 rounded-[9px] border p-1.5"
                    style={{ borderColor: p.menuTheme === m.k ? accent.hex : sheetLine, background: m.bg, color: p.menuTheme === m.k ? accent.hex : sheetSub }}
                  >
                    <span className="h-3 w-full rounded-[3px] border" style={{ background: m.bg, borderColor: sheetLine }} />
                    <span className="text-[7.5px] font-semibold">{m.l}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Sayt mavzusi" subColor={sheetSub}>
              <div className="grid grid-cols-3 gap-1.5">
                {canvasThemes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { p.setCanvasId(c.id); p.toast(`${c.name} mavzusi`); }}
                    className="flex flex-col items-center gap-1 rounded-[9px] border px-1 py-1.5"
                    style={{ borderColor: p.canvasId === c.id ? accent.hex : sheetLine, color: p.canvasId === c.id ? accent.hex : sheetSub }}
                  >
                    <span className="size-4 rounded-full" style={{ background: `conic-gradient(from 200deg, ${c.amb1}, ${c.amb2}, ${c.amb3}, ${c.amb1})` }} />
                    <span className="truncate text-[7px] font-semibold">{c.name.split(" ")[1] ?? c.name}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Kun / Tun" subColor={sheetSub}>
              <div className="grid grid-cols-2 gap-1.5">
                {([{ k: "light", l: "Kun", I: Sun }, { k: "dark", l: "Tun", I: Moon }] as const).map((m) => (
                  <button key={m.k} type="button" onClick={() => { if (p.theme !== m.k) p.toggleTheme(); }} className="flex items-center justify-center gap-1.5 rounded-[9px] border py-2 text-[9px] font-semibold" style={{ borderColor: p.theme === m.k ? accent.hex : sheetLine, background: p.theme === m.k ? `${accent.hex}14` : "transparent", color: p.theme === m.k ? accent.hex : sheetSub }}>
                    <m.I size={11} /> {m.l}
                  </button>
                ))}
              </div>
            </Section>

            <Section title="Harakat tezligi" subColor={sheetSub}>
              <div className="grid grid-cols-3 gap-1.5">
                {([{ k: "full", l: "To'liq" }, { k: "soft", l: "Yumshoq" }, { k: "off", l: "O'chiq" }] as const).map((m) => (
                  <button key={m.k} type="button" onClick={() => p.setMotion(m.k)} className="rounded-[9px] border py-2 text-[8.5px] font-semibold" style={{ borderColor: p.motion === m.k ? accent.hex : sheetLine, background: p.motion === m.k ? `${accent.hex}14` : "transparent", color: p.motion === m.k ? accent.hex : sheetSub }}>
                    {m.l}
                  </button>
                ))}
              </div>
            </Section>

            <button type="button" onClick={() => goTo("profile")} className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-[9.5px] font-semibold text-white" style={{ background: BRAND.blue }}>
              <Settings size={11} /> Profil sozlamalari
            </button>
          </div>
        </aside>

        {/* RIGHT: quick nav — the former bottom buttons */}
        <aside
          className="ch-drawer absolute inset-y-0 right-0 w-[196px] overflow-hidden rounded-l-[20px] shadow-2xl"
          style={{ transform: panel === "quick" ? "none" : "translateX(104%)", background: sheetBg, color: sheetInk }}
          aria-label="Tezkor menyu"
          aria-hidden={panel !== "quick"}
        >
          <SheetHead title="Tezkor o'tish" sub="Pastki tugmalar shu yerda" onClose={close} line={sheetLine} subColor={sheetSub} />
          <div className="space-y-1.5 p-3">
            {[...roleDef.nav, { key: roleDef.fab.key, label: roleDef.fab.label }, { key: "notifications" as ScreenKey, label: "Xabarlar" }, { key: "profile" as ScreenKey, label: "Profil" }, { key: "menu" as ScreenKey, label: "To'liq menyu" }].map((n, i) => {
              const Icon: LucideIcon = [Home, Bell, UserRound, Grid3X3, Layers3][Math.min(i, 4)] ?? Home;
              return (
                <button key={`${n.key}-${i}`} type="button" onClick={() => goTo(n.key)} className="flex w-full items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left" style={{ borderColor: activeScreen === n.key ? accent.hex : sheetLine, background: activeScreen === n.key ? `${accent.hex}14` : "transparent" }}>
                  <Icon size={12} style={{ color: activeScreen === n.key ? accent.hex : sheetSub }} />
                  <span className="flex-1 text-[9.5px] font-medium">{n.label}</span>
                  <ChevronRight size={10} style={{ color: sheetSub }} />
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </>
  );
}

function TopIcon({ label, active, onClick, icon: Icon, accent, ink, badge }: { label: string; active: boolean; onClick: () => void; icon: LucideIcon; accent: string; ink: string; badge?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className="relative grid size-8 place-items-center rounded-lg transition active:scale-90"
      style={{ background: active ? `${accent}22` : "transparent", color: active ? accent : ink }}
    >
      <Icon size={14} />
      {badge && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-[#22B573]" />}
    </button>
  );
}

function SheetHead({ title, sub, onClose, line, subColor }: { title: string; sub: string; onClose: () => void; line: string; subColor: string }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-3" style={{ borderColor: line }}>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-bold">{title}</p>
        <p className="truncate text-[8px]" style={{ color: subColor }}>{sub}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Yopish" className="grid size-7 place-items-center rounded-lg border" style={{ borderColor: line }}>
        <X size={12} />
      </button>
    </div>
  );
}

function Section({ title, subColor, children }: { title: string; subColor: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[7.5px] uppercase tracking-[0.16em]" style={{ color: subColor }}>{title}</p>
      {children}
    </div>
  );
}
