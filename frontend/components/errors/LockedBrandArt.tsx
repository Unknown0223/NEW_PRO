"use client";

import { useId, type CSSProperties, type KeyboardEvent } from "react";
import { LockedBrandDefs } from "./locked-brand-defs";
import { LockedBrandLock } from "./locked-brand-lock";
import {
  BLUE,
  LOCKED_BRAND_PACKETS,
  NAVY,
  SKY,
  type LockedBrandArtProps
} from "./locked-brand-shared";
import "./lock-motion.css";

/**
 * «4 🔒 3»: chap-o‘ngda raqamlar, o‘rtada Sales Arena ikonkasidan yasalgan qulf.
 */
export function LockedBrandArt({
  className = "",
  label = "403",
  lockLabel = "Lock",
  intro = false,
  motion = true,
  fx = {},
  sent = false,
  onLock
}: LockedBrandArtProps) {
  const u = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `sa403-${u}-${name}`;
  const refUrl = (name: string) => `url(#${id(name)})`;
  const { deny = 0, tug = 0, scan = 0, key = 0, ok = 0 } = fx;
  const interactive = Boolean(onLock);
  const pulseKey = key || ok;

  function onKey(e: KeyboardEvent<SVGGElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onLock?.();
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 560 300"
      role={interactive ? "group" : "img"}
      aria-label={label}
      overflow="visible"
      className={`${intro ? "sa-intro " : ""}${className}`}
    >
      <LockedBrandDefs id={id} refUrl={refUrl} motion={motion} />

      <g mask={refUrl("mask")}>
        <g className="sa-par-far">
          <g
            fontFamily="Inter, Arial, Helvetica, sans-serif"
            style={{ fontFamily: "var(--font-sans, Inter), Inter, Arial, Helvetica, sans-serif" }}
            fontWeight="800"
            fontSize="236"
            textAnchor="middle"
          >
            <g className="sa-d4">
              <text x="130" y="262" fill={refUrl("digit")}>
                4
              </text>
              <text x="130" y="262" fill={refUrl("grid")}>
                4
              </text>
              <text x="130" y="262" fill={refUrl("shine")}>
                4
              </text>
            </g>
            <g className="sa-d3">
              <text x="428" y="262" fill={refUrl("digit")}>
                3
              </text>
              <text x="428" y="262" fill={refUrl("grid")}>
                3
              </text>
              <text x="428" y="262" fill={refUrl("shine")}>
                3
              </text>
            </g>
          </g>
        </g>
      </g>

      <g className="sa-par-mid">
        <g className="sa-fade">
          <circle className="sa-glow" cx="280" cy="180" r="134" fill={refUrl("glow")} />
        </g>
        <g className="sa-ring-in">
          <g className="sa-orbit">
            <circle
              cx="280"
              cy="172"
              r="112"
              fill="none"
              stroke={BLUE}
              strokeOpacity="0.3"
              strokeWidth="1.6"
              strokeDasharray="2 9"
              strokeLinecap="round"
            />
          </g>
          <circle cx="280" cy="172" r="92" fill="none" stroke={BLUE} strokeOpacity="0.07" strokeWidth="1.2" />
          <g className="sa-radar">
            <circle
              cx="280"
              cy="172"
              r="92"
              fill="none"
              stroke={SKY}
              strokeOpacity="0.55"
              strokeWidth="2"
              strokeDasharray="64 514"
              strokeLinecap="round"
            />
          </g>
          <g className="sa-sat">
            <circle cx="392" cy="172" r="3.6" fill={BLUE} />
            <circle cx="392" cy="172" r="7" fill={BLUE} fillOpacity="0.15" />
          </g>
          <g className="sa-chip-orbit" style={{ transformOrigin: "280px 172px" }}>
            <g transform="translate(168 172)">
              <g className="sa-chip-counter" style={{ transformOrigin: "0px 0px" }}>
                <rect x="-17" y="-15" width="34" height="30" rx="10" fill={NAVY} stroke={SKY} strokeOpacity="0.5" />
                <text x="0" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c7ddff">
                  403
                </text>
              </g>
            </g>
          </g>
        </g>

        {LOCKED_BRAND_PACKETS.map((p, i) => {
          const half = Math.sqrt(Math.max(0, 112 * 112 - (p.y - 172) ** 2));
          const w = p.s * 1.7;
          const left = p.side === "l";
          const x0 = left ? 18 : 542 - w;
          const edge = left ? 280 - half - w - 2 : 280 + half + 2;
          const style = {
            "--dx": `${edge - x0}px`,
            "--dur": `${p.dur}s`,
            "--delay": `${2.2 + p.delay}s`
          } as CSSProperties;
          return (
            <g key={i} className="sa-pk" style={style}>
              <line
                x1={left ? x0 - 16 : x0 + w}
                y1={p.y + p.s / 2}
                x2={left ? x0 : x0 + w + 16}
                y2={p.y + p.s / 2}
                stroke={i % 2 ? SKY : BLUE}
                strokeOpacity="0.3"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <rect x={x0} y={p.y} width={w} height={p.s} rx={p.s / 2.5} fill={i % 2 ? SKY : BLUE} />
            </g>
          );
        })}
      </g>

      <g className="sa-par-near">
        <g className="sa-fade">
          <g className="sa-f1">
            <circle cx="210" cy="86" r="4.5" fill={SKY} />
          </g>
          <g className="sa-f2">
            <circle cx="352" cy="72" r="3.2" fill={BLUE} fillOpacity="0.55" />
          </g>
          <g className="sa-f3">
            <path d="M232 30v12M226 36h12" stroke={SKY} strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <g className="sa-f2">
            <circle cx="330" cy="28" r="4.5" fill="none" stroke={BLUE} strokeOpacity="0.4" strokeWidth="2" />
          </g>
          <g className="sa-f3">
            <rect
              x="404"
              y="58"
              width="7"
              height="7"
              rx="2"
              fill={SKY}
              fillOpacity="0.6"
              transform="rotate(20 407.5 61.5)"
            />
          </g>
        </g>
      </g>

      <g className="sa-shadow-in">
        <ellipse className="sa-floorlight" cx="280" cy="268" rx="118" ry="26" fill={refUrl("glow")} />
        <g className="sa-shadow-bob">
          <ellipse cx="280" cy="276" rx="70" ry="7" fill={NAVY} fillOpacity="0.07" />
        </g>
      </g>

      <LockedBrandLock
        refUrl={refUrl}
        interactive={interactive}
        lockLabel={lockLabel}
        onLock={onLock}
        onKey={onKey}
        deny={deny}
        tug={tug}
        scan={scan}
        keyFx={key}
        ok={ok}
        pulseKey={pulseKey}
        sent={sent}
        intro={intro}
      />
    </svg>
  );
}
