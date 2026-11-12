import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Workspace from "./components/Workspace";
import Footer from "./components/Footer";
import Intro from "./components/Intro";
import CommandPalette from "./components/CommandPalette";
import { ToastProvider } from "./components/ui";
import { roles, screens, type RoleKey, type ScreenKey, type ViewKey } from "./data/design";
import { applyCanvasTheme, DEFAULT_CANVAS } from "./data/themes";

function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-[2px] bg-transparent" aria-hidden>
      <div
        className="h-full origin-left bg-gradient-to-r from-brand-500 via-brand-300 to-lime transition-transform duration-150"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

const prefersReduced = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenKey>("login");
  const [role, setRole] = useState<RoleKey>("agent");
  const [view, setView] = useState<ViewKey>("prototip");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [canvas, setCanvas] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_CANVAS;
    try {
      return localStorage.getItem("salec-canvas") || DEFAULT_CANVAS;
    } catch {
      return DEFAULT_CANVAS;
    }
  });

  useLayoutEffect(() => {
    applyCanvasTheme(canvas);
    try {
      localStorage.setItem("salec-canvas", canvas);
    } catch {
      /* private mode */
    }
  }, [canvas]);
  const [introOpen, setIntroOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    if (prefersReduced()) return false;
    try {
      return sessionStorage.getItem("salec-intro-seen") !== "1";
    } catch {
      return true;
    }
  });

  const scrollToWorkspace = () => {
    requestAnimationFrame(() => {
      document.getElementById("ishmaydoni")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openView = useCallback((next: ViewKey) => {
    setView(next);
    scrollToWorkspace();
  }, []);

  const openScreen = useCallback(
    (screen: ScreenKey) => {
      const def = screens.find((s) => s.key === screen);
      if (def && def.role !== "shared") setRole(def.role);
      setActiveScreen(screen);
      setView("prototip");
      scrollToWorkspace();
    },
    [],
  );

  const openRole = useCallback((next: RoleKey) => {
    const def = roles.find((r) => r.key === next) ?? roles[0];
    setRole(next);
    setActiveScreen(def.homeScreen);
    setView("prototip");
    scrollToWorkspace();
  }, []);

  const finishIntro = useCallback(() => {
    setIntroOpen(false);
    try {
      sessionStorage.setItem("salec-intro-seen", "1");
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = introOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [introOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ToastProvider>
      <div className={`min-h-screen bg-canvas ${introOpen ? "booting" : ""}`}>
        <ScrollProgress />
        {introOpen && <Intro onDone={finishIntro} onSkip={finishIntro} onPickRole={(r) => { setRole(r); setActiveScreen("login"); }} />}
        <Nav view={view} onView={openView} onPalette={() => setPaletteOpen(true)} onReplayIntro={() => setIntroOpen(true)} canvas={canvas} onCanvas={setCanvas} />
        <main>
          <Hero onOpenScreen={openScreen} onOpenRole={openRole} onOpenView={openView} initialRole={role} />
          <Workspace
            view={view}
            onView={setView}
            activeScreen={activeScreen}
            onChange={setActiveScreen}
            role={role}
            onRole={setRole}
            onOpenScreen={openScreen}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        </main>
        <Footer onOpenPalette={() => setPaletteOpen(true)} onOpenRole={openRole} onOpenView={openView} />
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onView={openView} onRole={openRole} onScreen={openScreen} onCanvas={setCanvas} />
      </div>
    </ToastProvider>
  );
}
