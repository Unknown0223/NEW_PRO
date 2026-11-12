import { useEffect, useId, useRef, useState } from "react";
import type { Accent, MotionLevel, RoleKey } from "../../data/design";

export const SPLASH_META: Record<RoleKey, { word: string; tagline: string }> = {
  agent: { word: "Agent", tagline: "Marshrut, vizit va buyurtma — bir necha bosishda." },
  expeditor: { word: "Dastavka", tagline: "Yetkazing, to'lovni oling va yoping — bir necha bosishda." },
  supervisor: { word: "Nazorat", tagline: "Jamoa, GPS va KPI — real vaqtda, bitta ekranda." },
  cashier: { word: "Kassa", tagline: "O'tkazmalarni solishtiring va tasdiqlang — xatosiz." },
};

const PERIOD = 160;
const ANGLE = -32;
const PIN_Y = -47;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x * x;

/** One rAF clock, isolated so the surrounding form never re-renders at 60fps. */
function useTicker(motion: MotionLevel) {
  const [ms, setMs] = useState(motion === "off" ? 1700 : 0);
  useEffect(() => {
    if (motion === "off") {
      setMs(1700);
      return;
    }
    const speed = motion === "soft" ? 0.6 : 1;
    let raf = 0;
    let start = 0;
    let alive = true;
    const loop = (now: number) => {
      if (!alive) return;
      if (!start) start = now;
      setMs((now - start) * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [motion]);
  return ms;
}

const INK = "#1A1F28";
const GLASS = "#1E3A55";

function Truck({ a }: { a: Accent }) {
  return (
    <g>
      {[[-25, -17], [-25, 13], [15, -16], [15, 12]].map(([x, y], i) => <rect key={i} x={x} y={y} width="11" height="4.4" rx="1.6" fill={INK} />)}
      <rect x="10" y="-6.5" width="5" height="13" fill={INK} />
      <rect x="-33" y="-14.5" width="45" height="29" rx="3.6" fill={a.hex} />
      <rect x="-33" y="-14.5" width="45" height="13" rx="3.6" fill="#fff" opacity="0.22" />
      <line x1="-18" y1="-14.5" x2="-18" y2="14.5" stroke="#000" strokeOpacity="0.1" />
      <line x1="-3" y1="-14.5" x2="-3" y2="14.5" stroke="#000" strokeOpacity="0.1" />
      {/* Sales Arena mark seen from above */}
      <g transform="translate(-10.5 0) rotate(90)" fill="none" stroke={a.onAccent} strokeLinecap="round" strokeLinejoin="round">
        <path d="M-6.4 3.6 L-3 -1.2 L0 1" strokeWidth="2" />
        <path d="M0 1 L5.4 -4.8" strokeWidth="2" />
        <path d="M2.6 -5.4 L6.4 -6 L5 -2.4 Z" fill={a.onAccent} strokeWidth="0.6" />
      </g>
      <rect x="-34.2" y="-11" width="1.8" height="5" rx="0.9" fill="#EF4444" />
      <rect x="-34.2" y="6" width="1.8" height="5" rx="0.9" fill="#EF4444" />
      <rect x="14" y="-13" width="20" height="26" rx="6.4" fill="#FFFFFF" stroke="#D5DAE1" strokeWidth="0.8" />
      <path d="M24.5 -10.4 Q32 -9 32 0 Q32 9 24.5 10.4 Z" fill={GLASS} />
      <path d="M26 -8.6 Q30 -7 30.4 -2 L27 -2 Z" fill="#fff" opacity="0.28" />
      <rect x="16.4" y="-9.4" width="7" height="18.8" rx="2.2" fill="#EEF1F5" />
      <rect x="20.5" y="-16" width="4.4" height="3.2" rx="1.2" fill={INK} />
      <rect x="20.5" y="12.8" width="4.4" height="3.2" rx="1.2" fill={INK} />
      <rect x="33" y="-10.4" width="2" height="4.4" rx="1" fill="#FFE39A" />
      <rect x="33" y="6" width="2" height="4.4" rx="1" fill="#FFE39A" />
    </g>
  );
}

function Scooter({ a }: { a: Accent }) {
  return (
    <g>
      <rect x="20" y="-2.8" width="11" height="5.6" rx="2.8" fill={INK} />
      <rect x="-21" y="-2.8" width="11" height="5.6" rx="2.8" fill={INK} />
      <path d="M-17 -6.4 Q-17 -8.4 -13 -8.4 H11 Q20 -6.4 22.6 0 Q20 6.4 11 8.4 H-13 Q-17 8.4 -17 6.4 Z" fill={a.hex} />
      <path d="M-13 -8.4 H11 Q18 -7 21 -2 H-17 V-6.4 Q-17 -8.4 -13 -8.4Z" fill="#fff" opacity="0.2" />
      <rect x="-33" y="-9.6" width="17" height="19.2" rx="3.8" fill="#FFFFFF" stroke="#D5DAE1" strokeWidth="0.9" />
      <rect x="-33" y="-2.2" width="17" height="4.4" fill={a.hex} opacity="0.9" />
      <path d="M4 -7.4 L16.6 -11.4" stroke={a.ink} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M4 7.4 L16.6 11.4" stroke={a.ink} strokeWidth="4.2" strokeLinecap="round" />
      <ellipse cx="1" cy="0" rx="8.4" ry="9.4" fill={a.ink} />
      <rect x="15.4" y="-13.4" width="3.2" height="26.8" rx="1.6" fill={INK} />
      <circle cx="17" cy="-12.4" r="2.5" fill="#F3F5F8" stroke={INK} strokeWidth="0.8" />
      <circle cx="17" cy="12.4" r="2.5" fill="#F3F5F8" stroke={INK} strokeWidth="0.8" />
      <circle cx="6.4" cy="0" r="5.8" fill="#FFFFFF" stroke="#D5DAE1" strokeWidth="0.9" />
      <path d="M9.6 -4 Q12.4 0 9.6 4" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="4.6" cy="0" r="1.5" fill={a.hex} />
    </g>
  );
}

function Car({ a, beat }: { a: Accent; beat: number }) {
  return (
    <g>
      {[[-19, -15], [-19, 11.4], [11, -15], [11, 11.4]].map(([x, y], i) => <rect key={i} x={x} y={y} width="9" height="3.6" rx="1.4" fill={INK} />)}
      <rect x="-27" y="-12.6" width="54" height="25.2" rx="9.6" fill={a.hex} />
      <rect x="-27" y="-12.6" width="54" height="11" rx="9.6" fill="#fff" opacity="0.16" />
      <path d="M7 -9.6 Q15.4 -8.6 15.4 0 Q15.4 8.6 7 9.6 L3.6 7.6 V-7.6 Z" fill={GLASS} />
      <path d="M8.6 -7.6 Q13 -6.4 13.6 -2 L9.6 -2 Z" fill="#fff" opacity="0.28" />
      <path d="M-14 -8.8 L-10.4 -7 V7 L-14 8.8 Q-18.4 6.4 -18.4 0 Q-18.4 -6.4 -14 -8.8 Z" fill={GLASS} />
      <rect x="2.4" y="-15.4" width="4" height="3" rx="1.2" fill={INK} />
      <rect x="2.4" y="12.4" width="4" height="3" rx="1.2" fill={INK} />
      <rect x="25.4" y="-9.6" width="2" height="4.4" rx="1" fill="#FFE39A" />
      <rect x="25.4" y="5.2" width="2" height="4.4" rx="1" fill="#FFE39A" />
      <rect x="-27.6" y="-9" width="1.8" height="4.4" rx="0.9" fill="#EF4444" />
      <rect x="-27.6" y="4.6" width="1.8" height="4.4" rx="0.9" fill="#EF4444" />
      <circle cx="-3.4" cy="0" r="3" fill="#fff" />
      <circle cx="-3.4" cy="0" r="1.9" fill={a.bright} opacity={0.5 + beat * 0.5} />
    </g>
  );
}

function Van({ a }: { a: Accent }) {
  return (
    <g>
      {[[-23, -16.6], [-23, 12.6], [13, -16], [13, 12]].map(([x, y], i) => <rect key={i} x={x} y={y} width="10" height="4" rx="1.5" fill={INK} />)}
      <rect x="-31" y="-14" width="60" height="28" rx="6.4" fill={a.hex} />
      <rect x="-31" y="-14" width="60" height="12" rx="6.4" fill="#fff" opacity="0.16" />
      <path d="M17 -11 Q26.4 -9.6 26.4 0 Q26.4 9.6 17 11 Z" fill={GLASS} />
      <path d="M18.6 -8.8 Q23.6 -7.4 24.4 -2 L19.6 -2 Z" fill="#fff" opacity="0.28" />
      <rect x="9.6" y="-10.4" width="3.4" height="20.8" rx="1.7" fill="#fff" opacity="0.5" />
      <line x1="-24" y1="-14" x2="-24" y2="14" stroke="#000" strokeOpacity="0.14" />
      <circle cx="-8" cy="0" r="8" fill="none" stroke={a.onAccent} strokeOpacity="0.4" strokeWidth="1.2" />
      <circle cx="-8" cy="0" r="5" fill="#F6C945" stroke="#C99A19" strokeWidth="0.9" />
      <path d="M-8 -2.6 V2.6 M-10 -0.8 H-6 M-10 1 H-6" stroke="#7A5600" strokeWidth="0.9" strokeLinecap="round" />
      <rect x="14" y="-16.8" width="4.2" height="3" rx="1.2" fill={INK} />
      <rect x="14" y="13.8" width="4.2" height="3" rx="1.2" fill={INK} />
      <rect x="27.6" y="-10.6" width="2" height="4.4" rx="1" fill="#FFE39A" />
      <rect x="27.6" y="6.2" width="2" height="4.4" rx="1" fill="#FFE39A" />
      <rect x="-32" y="-10" width="1.8" height="5" rx="0.9" fill="#EF4444" />
      <rect x="-32" y="5" width="1.8" height="5" rx="0.9" fill="#EF4444" />
    </g>
  );
}

const GLYPH: Record<RoleKey, string> = {
  expeditor: "M-5 -2 L0 -4.6 L5 -2 V3.4 L0 6 L-5 3.4 Z M-5 -2 L0 0.6 L5 -2 M0 0.6 V6",
  agent: "M-5.6 -1 L-4.2 -5 H4.2 L5.6 -1 Z M-4.6 -1 V5 H4.6 V-1 M-1.5 5 V1.6 H1.5 V5",
  supervisor: "M-4.6 5 Q-4.6 0.6 0 0.6 Q4.6 0.6 4.6 5 M2.3 -2.6 A2.3 2.3 0 1 1 -2.3 -2.6 A2.3 2.3 0 1 1 2.3 -2.6",
  cashier: "M-5.6 -1.6 L0 -5 L5.6 -1.6 Z M-4 -0.2 V3.6 M0 -0.2 V3.6 M4 -0.2 V3.6 M-5.6 5 H5.6",
};

export function RoadScene({
  role,
  accent,
  dark = false,
  motion = "full",
  leaving = false,
}: {
  role: RoleKey;
  accent: Accent;
  dark?: boolean;
  motion?: MotionLevel;
  leaving?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const ms = useTicker(motion);
  const leaveAt = useRef<number | null>(null);
  if (leaving && leaveAt.current === null) leaveAt.current = ms;
  if (!leaving) leaveAt.current = null;

  const still = motion === "off";
  const enter = still ? 1 : easeOut(clamp01(ms / 1150));
  const exit = leaving && leaveAt.current !== null && !still ? easeIn(clamp01((ms - leaveAt.current) / 700)) : 0;
  const vx = -230 * (1 - enter) + exit * 320;
  const scroll = (ms * 0.085) % PERIOD;
  const sway = still ? 0 : Math.sin(ms / 270) * 1.5;
  const bob = still ? 0 : Math.sin(ms / 130) * 0.45;
  const beat = 0.5 + 0.5 * Math.sin(ms / 260);

  const road1 = dark ? "#1E2533" : "#E2E5EA";
  const road2 = dark ? "#181E2A" : "#ECEEF2";
  const road3 = dark ? "#151B26" : "#F0F2F5";
  const paper = dark ? "#131824" : "#FFFFFF";
  const glyph = dark ? "#C9D2E0" : "#5B6677";
  const dust = dark ? "#FFFFFF" : "#9AA3B2";
  const cells = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <svg viewBox="0 0 300 300" className="size-full" preserveAspectRatio="xMidYMin meet" aria-hidden>
      <defs>
        <radialGradient id={`${uid}m`} cx="50%" cy="50%" r="50%">
          <stop offset="0.42" stopColor="#fff" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${uid}k`}><rect width="300" height="300" fill={`url(#${uid}m)`} /></mask>
        <filter id={`${uid}s`} x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="2.6" /></filter>
      </defs>

      <g mask={`url(#${uid}k)`}>
        <g transform={`translate(150 150) rotate(${ANGLE})`}>
          {cells.map((k) => {
            const X = k * PERIOD - scroll;
            return (
              <g key={k}>
                <rect x={X - 13} y="-300" width="26" height="600" fill={road2} />
                <rect x={X + 30} y="44" width="100" height="84" rx="5" fill="none" stroke={road3} strokeWidth="6" />
                <rect x={X + 36} y="-150" width="88" height="96" rx="5" fill="none" stroke={road3} strokeWidth="6" />
                <rect x={X + 62} y="150" width="40" height="120" fill={road3} />
              </g>
            );
          })}
          <rect x="-420" y="-25" width="840" height="50" fill={road1} />
          <line x1="-420" y1="0" x2="420" y2="0" stroke={paper} strokeWidth="2.2" strokeDasharray="13 13" strokeDashoffset={scroll} strokeLinecap="round" />
        </g>
      </g>

      <g transform={`translate(150 150) rotate(${ANGLE})`}>
        {role === "supervisor" && !still && cells.slice(1, 6).map((k) => {
          const X = k * PERIOD - scroll;
          const y = (k % 2 ? 1 : -1) * (70 + 34 * Math.sin(ms / 900 + k * 1.7));
          return (
            <g key={`m${k}`} transform={`translate(${X} ${y})`}>
              <circle r="7" fill={accent.hex} opacity="0.16" />
              <circle r="4.2" fill={["#5CC8F5", "#A79BFF", "#FFC24D", "#5FE3B0", "#F472B6"][(k + 5) % 5]} stroke={paper} strokeWidth="1.6" />
            </g>
          );
        })}

        {cells.map((k) => {
          const ix = k * PERIOD - scroll + 84;
          const dx = ix - vx;
          const passed = dx < -8;
          const near = Math.abs(dx) < 42;
          const p = clamp01(1 - (dx + 8) / 50);
          const pop = near ? 1 + 0.2 * Math.sin(p * Math.PI) : 1;
          return (
            <g key={`s${k}`} transform={`translate(${ix} ${PIN_Y})`}>
              {near && !still && <circle r={12 + p * 12} fill="none" stroke={accent.hex} strokeWidth="1.6" opacity={0.7 * (1 - p)} />}
              <g transform={`rotate(${-ANGLE}) scale(${pop})`}>
                <circle r="12" fill={passed ? accent.hex : paper} stroke={passed ? accent.hex : road1} strokeWidth="1.6" />
                {passed ? <path d="M-4.4 0.2 L-1.2 3.4 L4.8 -3" fill="none" stroke={accent.onAccent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  : <path d={GLYPH[role]} fill="none" stroke={glyph} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />}
              </g>
            </g>
          );
        })}

        {(role === "expeditor" || role === "cashier") && !still && cells.map((k) => {
          const ix = k * PERIOD - scroll + 84;
          const dx = ix - vx;
          const p = clamp01(1 - (dx + 8) / 50);
          if (p <= 0.02 || p >= 0.98) return null;
          const q = role === "expeditor" ? p : 1 - p;
          const x = vx + (ix - vx) * q;
          const y = PIN_Y * q - Math.sin(q * Math.PI) * 14;
          return role === "expeditor" ? (
            <g key={`t${k}`} transform={`translate(${x} ${y}) rotate(${q * 140})`}>
              <rect x="-4.6" y="-4.6" width="9.2" height="9.2" rx="1.8" fill="#E9C27A" stroke="#B98A3C" strokeWidth="0.8" />
              <rect x="-1" y="-4.6" width="2" height="9.2" fill="#B98A3C" opacity="0.6" />
            </g>
          ) : (
            <g key={`t${k}`} transform={`translate(${x} ${y})`}>
              <circle r="4.4" fill="#F6C945" stroke="#C99A19" strokeWidth="0.9" />
              <circle r="1.7" fill="#C99A19" opacity="0.55" />
            </g>
          );
        })}

        <g transform={`translate(${vx} ${bob})`}>
          {role === "supervisor" && !still && [0, 0.5].map((o) => {
            const ph = (ms / 1500 + o) % 1;
            return <circle key={o} r={22 + ph * 74} fill="none" stroke={accent.hex} strokeWidth="1.4" opacity={0.42 * (1 - ph)} />;
          })}
          {!still && [0, 1, 2].map((j) => {
            const ph = (ms / 420 + j / 3) % 1;
            return <circle key={j} cx={-40 - ph * 30} cy={(j - 1) * 3} r={2 + ph * 4.6} fill={dust} opacity={0.26 * (1 - ph)} />;
          })}
          <ellipse cx="1" cy="6" rx="36" ry="15" fill="#000" opacity={dark ? 0.45 : 0.16} filter={`url(#${uid}s)`} />
          <g transform={`rotate(${sway})`}>
            {role === "expeditor" ? <Truck a={accent} /> : role === "agent" ? <Scooter a={accent} /> : role === "supervisor" ? <Car a={accent} beat={beat} /> : <Van a={accent} />}
          </g>
        </g>
      </g>
    </svg>
  );
}
