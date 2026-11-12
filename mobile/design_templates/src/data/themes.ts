export type CanvasTheme = {
  id: string;
  name: string;
  note: string;
  /** dark canvas ramp */
  c900: string;
  c800: string;
  c700: string;
  /** three genuinely different ambient hues */
  amb1: string;
  amb2: string;
  amb3: string;
  dot: string;
  /** light surfaces */
  surface: string;
  paper: string;
  ink: string;
  ink2: string;
  muted: string;
  line: string;
};

export const canvasThemes: CanvasTheme[] = [
  {
    id: "indigo",
    name: "Midnight Indigo",
    note: "Elektr ko'k · binafsha · siyan",
    c900: "#070B1C",
    c800: "#0C1330",
    c700: "#16204A",
    amb1: "#2C5CF6",
    amb2: "#7C3AED",
    amb3: "#06B6D4",
    dot: "rgba(150,180,255,0.20)",
    surface: "#F2F4FA",
    paper: "#FCFDFF",
    ink: "#0B1024",
    ink2: "#3A4260",
    muted: "#6E7794",
    line: "#E2E6F0",
  },
  {
    id: "violet",
    name: "Obsidian Violet",
    note: "Magenta · binafsha · muz ko'k",
    c900: "#0B0718",
    c800: "#170D2E",
    c700: "#261546",
    amb1: "#A21CAF",
    amb2: "#6D28D9",
    amb3: "#22D3EE",
    dot: "rgba(216,180,254,0.20)",
    surface: "#F6F3FB",
    paper: "#FEFCFF",
    ink: "#150B24",
    ink2: "#453A60",
    muted: "#7A6E94",
    line: "#E9E2F0",
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    note: "Siyan · ko'k · dengiz to'lqini",
    c900: "#04121C",
    c800: "#072536",
    c700: "#0B3A52",
    amb1: "#0891B2",
    amb2: "#2563EB",
    amb3: "#14B8A6",
    dot: "rgba(125,211,252,0.20)",
    surface: "#EFF6FA",
    paper: "#FBFEFF",
    ink: "#061620",
    ink2: "#35505E",
    muted: "#5C7686",
    line: "#DEE9EF",
  },
  {
    id: "rose",
    name: "Carbon Rose",
    note: "Atirgul · fuksiya · indigo",
    c900: "#140A12",
    c800: "#250F1E",
    c700: "#3A1730",
    amb1: "#E11D48",
    amb2: "#C026D3",
    amb3: "#4F46E5",
    dot: "rgba(253,164,175,0.20)",
    surface: "#FAF2F5",
    paper: "#FFFCFD",
    ink: "#1C0A14",
    ink2: "#5A3A48",
    muted: "#8E6E7C",
    line: "#F0E2E8",
  },
  {
    id: "steel",
    name: "Slate Steel",
    note: "Grafit · po'lat ko'k · osmon",
    c900: "#0C0F14",
    c800: "#161B24",
    c700: "#232B38",
    amb1: "#2563EB",
    amb2: "#0EA5E9",
    amb3: "#7C8CA8",
    dot: "rgba(203,213,225,0.18)",
    surface: "#F3F5F8",
    paper: "#FCFDFE",
    ink: "#0D1117",
    ink2: "#3C4654",
    muted: "#63728C",
    line: "#E3E8EF",
  },
  {
    id: "emerald",
    name: "Emerald Ink",
    note: "Toza zumrad · siyan · laym",
    c900: "#05140F",
    c800: "#08251C",
    c700: "#0D3A2B",
    amb1: "#059669",
    amb2: "#0891B2",
    amb3: "#65A30D",
    dot: "rgba(134,239,172,0.18)",
    surface: "#F1F6F3",
    paper: "#FCFEFD",
    ink: "#08201C",
    ink2: "#37514A",
    muted: "#6D827B",
    line: "#E0E9E5",
  },
];

export const DEFAULT_CANVAS = "indigo";

export function getCanvasTheme(id: string): CanvasTheme {
  return canvasThemes.find((t) => t.id === id) ?? canvasThemes[0];
}

/** Single source of truth — writes runtime custom properties on <html>. */
export function applyCanvasTheme(id: string) {
  if (typeof document === "undefined") return;
  const t = getCanvasTheme(id);
  const root = document.documentElement;
  const map: Record<string, string> = {
    "--c-900": t.c900,
    "--c-800": t.c800,
    "--c-700": t.c700,
    "--amb-1": t.amb1,
    "--amb-2": t.amb2,
    "--amb-3": t.amb3,
    "--c-dot": t.dot,
    "--c-surface": t.surface,
    "--c-paper": t.paper,
    "--c-ink": t.ink,
    "--c-ink2": t.ink2,
    "--c-muted": t.muted,
    "--c-line": t.line,
  };
  Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.canvas = t.id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.c900);
}
