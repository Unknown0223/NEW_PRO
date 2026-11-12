import { useEffect, useRef, useState } from "react";
import { BatteryFull, Check, Signal, Wifi } from "lucide-react";
import {
  accents,
  type Accent,
  type MotionLevel,
  type RoleKey,
  type ScreenKey,
  type ThemeMode,
} from "../../data/design";
import { applyCanvasTheme, DEFAULT_CANVAS } from "../../data/themes";
import { buildTokens, ScreenRenderer, type PhoneCtx } from "./PhoneScreens";
import GlobalChrome, { type MenuTheme } from "./GlobalChrome";
import { BrandSync, type MotionVariant } from "./BrandSync";
import { cn } from "../../utils/cn";

type Props = {
  screen: ScreenKey;
  onScreen?: (screen: ScreenKey) => void;
  theme: ThemeMode;
  onTheme?: () => void;
  accent: Accent;
  motion?: MotionLevel;
  effects?: boolean;
  className?: string;
  showHints?: boolean;
  role?: RoleKey;
  onRole?: (role: RoleKey) => void;
};

export default function PhoneFrame({
  screen,
  onScreen,
  theme,
  onTheme,
  accent,
  motion = "full",
  effects = true,
  className,
  showHints = false,
  role = "agent",
  onRole,
}: Props) {
  const [innerScreen, setInnerScreen] = useState<ScreenKey>(screen);
  const [innerTheme, setInnerTheme] = useState<ThemeMode>(theme);
  const [toast, setToast] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({ p1: 2, p3: 1 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* settings — all chosen from the phone's own settings panel */
  const [appAccentId, setAppAccentId] = useState<string | null>(null);
  const [menuTheme, setMenuTheme] = useState<MenuTheme>("light");
  const [canvasId, setCanvasId] = useState<string>(() =>
    typeof document === "undefined" ? DEFAULT_CANVAS : document.documentElement.dataset.canvas || DEFAULT_CANVAS,
  );
  const [motionOverride, setMotionOverride] = useState<MotionLevel | null>(null);
  const [motionRun, setMotionRun] = useState<{ variant: MotionVariant; id: number } | null>(null);

  const activeScreen = onScreen ? screen : innerScreen;
  const activeTheme = onTheme ? theme : innerTheme;
  const effMotion = motionOverride ?? motion;
  const effAccent = accents.find((a) => a.id === appAccentId) ?? accent;
  const t = buildTokens(activeTheme, effAccent);

  useEffect(() => {
    if (onScreen) setInnerScreen(screen);
  }, [screen, onScreen]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const go = (next: ScreenKey) => {
    setInnerScreen(next);
    onScreen?.(next);
  };
  const fireToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2300);
  };
  const setCanvas = (id: string) => {
    setCanvasId(id);
    applyCanvasTheme(id);
    try {
      localStorage.setItem("salec-canvas", id);
    } catch {
      /* private mode */
    }
  };
  const launchMotion = (variant: MotionVariant) => {
    setMotionRun({ variant, id: Date.now() });
    fireToast(variant === "full" ? "To'liq sinxron boshlandi" : variant === "quick" ? "Oddiy sinxron boshlandi" : "Rol kartasi yuklanmoqda");
  };

  const ctx: PhoneCtx = {
    motion: effMotion,
    effects,
    role,
    setRole: onRole,
    go,
    toast: fireToast,
    theme: activeTheme,
    toggleTheme: () => {
      const next = activeTheme === "light" ? "dark" : "light";
      setInnerTheme(next);
      onTheme?.();
    },
    cart,
    setQty: (id, delta) =>
      setCart((prev) => {
        const next = { ...prev };
        const value = (next[id] || 0) + delta;
        if (value <= 0) delete next[id];
        else next[id] = Math.min(99, value);
        return next;
      }),
    clearCart: () => setCart({}),
  };

  return (
    <div className={cn("relative", className, effMotion === "off" && "no-motion", effMotion === "soft" && "motion-soft")}>
      {effects && (
        <div aria-hidden className="pointer-events-none absolute -inset-10 -z-10">
          <div className="absolute left-1/2 top-1/2 size-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl" style={{ background: effAccent.hex }} />
          <div className="absolute -right-4 top-10 size-32 rounded-full bg-lime/30 blur-3xl" />
        </div>
      )}

      <div
        className="relative rounded-[46px] p-[9px]"
        style={{
          background: "linear-gradient(155deg,#22312d 0%,#0a1512 38%,#13211d 100%)",
          boxShadow: effects
            ? "0 50px 90px -40px rgba(6,33,30,.7), 0 24px 50px -30px rgba(6,33,30,.4), inset 0 1px 0 rgba(255,255,255,.16)"
            : "0 20px 40px -30px rgba(6,33,30,.4)",
        }}
      >
        <span className="absolute -left-[3px] top-[120px] h-8 w-[3px] rounded-l-sm bg-[#2a3a35]" />
        <span className="absolute -left-[3px] top-[168px] h-12 w-[3px] rounded-l-sm bg-[#22312d]" />
        <span className="absolute -right-[3px] top-[150px] h-16 w-[3px] rounded-r-sm bg-[#22312d]" />

        <div
          className="relative flex flex-col overflow-hidden rounded-[38px]"
          style={{ width: 330, height: 700, background: t.bg, color: t.ink, transition: "background .35s ease", ["--acc-on" as string]: effAccent.onAccent }}
        >
          <div className="pointer-events-none absolute left-1/2 top-[9px] z-40 h-[20px] w-[82px] -translate-x-1/2 rounded-full bg-[#050b09]" />

          {/* status bar */}
          <div className="relative z-30 flex shrink-0 items-center justify-between px-5 pb-1 pt-[11px]">
            <span className="font-mono text-[10px] font-semibold tracking-tight" style={{ color: t.isDark ? "#ffffff" : "#0E1420" }}>9:41</span>
            <div className="flex items-center gap-1" style={{ color: t.isDark ? "#ffffff" : "#0E1420" }}>
              <Signal size={11} strokeWidth={2.5} />
              <Wifi size={11} strokeWidth={2.5} />
              <BatteryFull size={15} strokeWidth={2} />
            </div>
          </div>

          {/* global bar — hamburger on the left, sync / theme / menu on the right, on every screen */}
          <GlobalChrome
            t={t}
            accent={effAccent}
            role={role}
            activeScreen={activeScreen}
            go={go}
            toast={fireToast}
            onRole={(r) => {
              if (onRole) onRole(r);
              else go("login");
            }}
            theme={activeTheme}
            toggleTheme={ctx.toggleTheme}
            motion={effMotion}
            setMotion={setMotionOverride}
            appAccentId={appAccentId}
            setAppAccentId={setAppAccentId}
            menuTheme={menuTheme}
            setMenuTheme={setMenuTheme}
            canvasId={canvasId}
            setCanvasId={setCanvas}
            onSync={launchMotion}
          />

          {/* screen */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div key={activeScreen} data-phone-screen={activeScreen} className={cn("h-full", effMotion !== "off" && "screen-enter")}>
              <ScreenRenderer screen={activeScreen} t={t} accent={effAccent} ctx={ctx} />
            </div>

            {toast && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-4">
                <div className={cn("flex max-w-full items-center gap-1.5 rounded-full px-3 py-2 text-[9.5px] font-semibold shadow-lg", effMotion !== "off" && "pop-in")} style={{ background: activeTheme === "dark" ? "#EEF2F8" : "#0E1420", color: activeTheme === "dark" ? "#0E1420" : "#fff" }}>
                  <span className="grid size-4 shrink-0 place-items-center rounded-full bg-lime text-midnight"><Check size={10} strokeWidth={3.5} /></span>
                  <span className="truncate">{toast}</span>
                </div>
              </div>
            )}
          </div>

          {/* bottom nav removed: its buttons now live in the top-right quick panel and the drawer */}

          <div className="flex justify-center pb-1.5 pt-0.5" style={{ background: t.card }}>
            <span className="h-[3px] w-20 rounded-full" style={{ background: t.isDark ? "rgba(255,255,255,.22)" : "#0E1420", opacity: 0.35 }} />
          </div>

          {/* role-matched animation — triggered by one of the three sync options */}
          {motionRun && (
            <BrandSync
              key={motionRun.id}
              role={role}
              accent={effAccent}
              variant={motionRun.variant === "welcome" ? "full" : motionRun.variant}
              motion={effMotion}
              onDone={() => {
                setMotionRun(null);
                fireToast(
                  motionRun.variant === "full" ? "Barcha ma'lumotlar sinxronlandi" : motionRun.variant === "quick" ? "O'zgarishlar sinxronlandi" : "Rol kartasi yangilandi",
                );
              }}
              onClose={() => setMotionRun(null)}
            />
          )}
        </div>
      </div>

      {showHints && (
        <div className="pointer-events-none absolute -left-6 top-24 hidden rounded-xl border border-line bg-white/95 px-2.5 py-1.5 text-[9px] font-medium text-ink-2 shadow-soft backdrop-blur lg:flex lg:items-center lg:gap-1.5">
          <span className="size-1.5 rounded-full bg-brand-500" /> Ekranda sinab ko'ring
        </div>
      )}
    </div>
  );
}
