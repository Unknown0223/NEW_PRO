"use client";

import { useEffect, useId, useState, type CSSProperties } from "react";
import { LockedBrandArt } from "./LockedBrandArt";
import { ERRORS, type ErrorCode } from "./error-data";

type Props = {
  code: ErrorCode;
  animated: boolean;
  attempt: number;
  checking: boolean;
  gesture?: "deny" | "key" | "tug";
};

function BrandGlyph({ x = 255, y = 145, size = 50 }: { x?: number; y?: number; size?: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="122 155 260 205">
      <path d="M150 330 200 255 250 290" fill="none" stroke="white" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m250 290 95-105" fill="none" stroke="#1e63c9" strokeWidth="26" strokeLinecap="round" />
      <path d="m345 185-60 7 37 43Z" fill="#1e63c9" />
    </svg>
  );
}

export function StatusArt({ code, animated, attempt, checking, gesture = "deny" }: Props) {
  const uid = useId().replace(/:/g, "");
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const timeout = window.setTimeout(() => setIntro(false), 2800);
    return () => window.clearTimeout(timeout);
  }, []);

  if (code === 403) {
    return (
      <div className="sa403-root sa403-art error-lock-art">
        <LockedBrandArt
          label="Sales Arena 403"
          className="status-svg"
          intro={intro && animated}
          motion={animated}
          fx={animated ? { [gesture]: checking ? 0 : attempt, scan: checking ? attempt : 0 } : {}}
        />
      </div>
    );
  }

  const fill = (name: string) => `url(#${uid}-${name})`;
  const accent = ERRORS[code].accent;

  return (
    <svg className={`status-svg scene-${code}`} viewBox="0 0 560 320" role="img" aria-label={`Sales Arena ${code}`}>
      <defs>
        <linearGradient id={`${uid}-navy`} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="#344565" /><stop offset=".55" stopColor="#1b2b49" /><stop offset="1" stopColor="#101d35" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#edf4ff" /><stop offset=".35" stopColor="#a7bddf" /><stop offset=".65" stopColor="#e0ebfb" /><stop offset="1" stopColor="#7189b1" />
        </linearGradient>
        <linearGradient id={`${uid}-digits`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#9baecc" stopOpacity=".59" /><stop offset="1" stopColor="#d5e2f5" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#eef6ff" stopOpacity=".9" /><stop offset="1" stopColor="#91b9f8" stopOpacity=".3" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffe6a0" /><stop offset=".5" stopColor="#dca33b" /><stop offset="1" stopColor="#ab721a" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop stopColor="#9ec2ff" stopOpacity=".22" /><stop offset="1" stopColor="#9ec2ff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="17" height="17" patternUnits="userSpaceOnUse">
          <path d="M17 0H0v17" stroke="#94b3df" strokeOpacity=".25" strokeWidth=".6" fill="none" />
        </pattern>
        <filter id={`${uid}-shadow`} x="-50%" y="-40%" width="200%" height="210%">
          <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#16233f" floodOpacity=".17" />
        </filter>
        <clipPath id={`${uid}-badge`}><rect x="209" y="87" width="142" height="169" rx="24" /></clipPath>
      </defs>

      <g className="scene-background">
        <text x="280" y="247" textAnchor="middle" fontSize="213" fontWeight="800" letterSpacing="-13" fill={fill("digits")}>{code}</text>
        <text x="280" y="247" textAnchor="middle" fontSize="213" fontWeight="800" letterSpacing="-13" fill={fill("grid")}>{code}</text>
      </g>
      <circle cx="280" cy="173" r="139" fill={fill("glow")} />
      <circle cx="280" cy="173" r="111" fill="none" stroke="#c5d7f1" strokeWidth="1" strokeDasharray="2 9" className="scene-orbit" />
      <ellipse className="scene-shadow" cx="280" cy="284" rx="82" ry="7" fill="#16233f" opacity=".08" />
      <g className="scene-particles" stroke="#8eb6f2" strokeWidth="2" fill="none">
        <path d="M177 78v10m-5-5h10" /><circle cx="373" cy="64" r="4" />
        <circle cx="190" cy="240" r="2.5" fill="#a9c8f5" stroke="none" />
        <path d="m394 247 6 6m0-6-6 6" />
      </g>

      <g className="scene-entrance">
        <g className="scene-parallax">
          <g key={attempt} className={attempt ? "scene-reaction" : "scene-float"}>
            {code === 401 && (
              <g>
                <path d="M258 91V61q0-24 22-24t22 24v30" fill="none" stroke={fill("metal")} strokeWidth="11" />
                <g filter={fill("shadow")}>
                  <rect x="209" y="87" width="142" height="169" rx="24" fill={fill("navy")} />
                  <rect x="210" y="88" width="140" height="167" rx="23" stroke="white" strokeOpacity=".16" fill="none" />
                </g>
                <rect x="257" y="98" width="46" height="6" rx="3" fill="#0d1930" />
                <circle cx="280" cy="152" r="25" fill="#263e63" stroke="#658ac2" strokeOpacity=".5" />
                <circle cx="280" cy="145" r="8" fill="#d9e8fe" />
                <path d="M265 166q0-15 15-15t15 15" fill="#d9e8fe" />
                <path d="M253 192h54M261 203h38" stroke="#718aaf" strokeWidth="4" strokeLinecap="round" />
                <BrandGlyph x={266} y={218} size={28} />
                <g clipPath={fill("badge")}>
                  <path className="scene-scanline" d="M205 110h150" stroke="#78b8ff" strokeWidth="3" />
                </g>
                <g className="scene-credential" transform="translate(0 0)">
                  <circle cx="355" cy="220" r="22" fill="#f7fbff" stroke="#d6e4f8" strokeWidth="2" />
                  <path d="M352 220h13m-4 0v5m-5-5v4" stroke={accent} strokeWidth="3" strokeLinecap="round" />
                  <circle cx="346" cy="220" r="6" stroke={accent} strokeWidth="3" fill="none" />
                </g>
              </g>
            )}

            {code === 404 && (
              <g>
                <g filter={fill("shadow")}>
                  <path d="M204 116q0-13 13-13h42l15 17h65q13 0 13 13v110q0 15-15 15H217q-13 0-13-13Z" fill="#203351" />
                  <path d="M198 142q0-13 13-13h132q13 0 12 13l-8 101q-1 14-15 14H218q-14 0-15-14Z" fill={fill("navy")} stroke="#5c7294" strokeWidth="1" />
                </g>
                <BrandGlyph x={251} y={161} size={48} />
                <path d="M239 227h62" stroke="#5b7396" strokeWidth="4" strokeLinecap="round" />
                <g className="scene-search">
                  <path d="m337 207 31 33" stroke="#16233f" strokeWidth="17" strokeLinecap="round" />
                  <path d="m339 206 17 18" stroke="#416ba9" strokeWidth="9" strokeLinecap="round" />
                  <circle cx="310" cy="176" r="42" fill={fill("glass")} stroke={fill("metal")} strokeWidth="11" />
                  <circle cx="310" cy="176" r="34" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="1.5" />
                  <path d="M298 168a12 12 0 0 1 24 0c0 9-12 7-12 16" fill="none" stroke="#335d9b" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="310" cy="193" r="2.6" fill="#335d9b" />
                </g>
              </g>
            )}

            {code === 429 && (
              <g>
                <circle cx="280" cy="169" r="85" fill={fill("metal")} filter={fill("shadow")} />
                <circle cx="280" cy="169" r="77" fill={fill("navy")} />
                <path d="M228 195a58 58 0 1 1 104 0" fill="none" stroke="#425779" strokeWidth="8" strokeLinecap="round" />
                <path d="M302 115a58 58 0 0 1 30 80" fill="none" stroke="#dfad54" strokeWidth="8" strokeLinecap="round" />
                {[0,1,2,3,4,5,6].map((i) => <path key={i} transform={`rotate(${i * 35 - 105} 280 169)`} d="M280 106v8" stroke="#b3c8e8" strokeWidth="2" />)}
                <g className="scene-gauge-needle">
                  <path d="m277 174 5-53 4 53Z" fill="#f4c976" /><circle cx="280" cy="169" r="7" fill="#f4c976" />
                </g>
                <BrandGlyph x={265} y={199} size={31} />
                <g className="scene-queue" fill="#81adea">
                  <circle cx="245" cy="270" r="4" /><circle cx="263" cy="270" r="4" /><circle cx="281" cy="270" r="4" />
                  <path d="M298 263v14m7-14v14" stroke="#b77a19" strokeWidth="3" strokeLinecap="round" />
                </g>
              </g>
            )}

            {code === 500 && (
              <g>
                <rect x="211" y="67" width="138" height="195" rx="22" fill={fill("navy")} filter={fill("shadow")} />
                <rect x="212" y="68" width="136" height="193" rx="21" stroke="#7a8da9" strokeOpacity=".4" fill="none" />
                <BrandGlyph x={261} y={84} size={38} />
                {[143,178,213].map((y, i) => (
                  <g key={y}>
                    <rect x="227" y={y} width="106" height="26" rx="7" fill="#101e36" stroke="#3b4f70" />
                    <path d={`M238 ${y + 10}h33m-33 6h23`} stroke="#7189af" strokeWidth="2" strokeLinecap="round" />
                    <circle className="scene-server-led" cx="318" cy={y+13} r="3" fill={i === 1 ? "#ef9a87" : "#7dabe9"} style={{animationDelay:`${i * .6}s`}} />
                  </g>
                ))}
                <g className="scene-warning">
                  <path d="m356 197 24 41q4 7-4 7h-48q-8 0-4-7l24-41q4-7 8 0Z" fill="#fff1e8" stroke="#e3a091" strokeWidth="2" />
                  <path d="M352 212v13" stroke="#ba5d51" strokeWidth="4" strokeLinecap="round" /><circle cx="352" cy="234" r="2.4" fill="#ba5d51" />
                </g>
              </g>
            )}

            {code === 502 && (
              <g>
                <path d="M170 238c-34 0-36-66 0-66m220-70c31 0 36 69 0 69" fill="none" stroke={fill("metal")} strokeWidth="14" strokeLinecap="round" />
                <g className="scene-plug-left">
                  <rect x="166" y="133" width="91" height="80" rx="20" fill={fill("navy")} filter={fill("shadow")} />
                  <path d="M256 154h14m-14 39h14" stroke={fill("metal")} strokeWidth="8" strokeLinecap="round" />
                  <BrandGlyph x={189} y={157} size={42} />
                </g>
                <g className="scene-plug-right">
                  <rect x="309" y="133" width="81" height="80" rx="20" fill={fill("navy")} filter={fill("shadow")} />
                  <path d="M311 154h14m-14 39h14" stroke="#0a1528" strokeWidth="10" strokeLinecap="round" />
                  <path d="M357 157v33m10-33v33" stroke="#738cae" strokeWidth="3" strokeLinecap="round" />
                </g>
                <path className="scene-link-spark" d="m291 137-10 22h14l-12 24" fill="none" stroke="#d99d3d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path className="scene-link-line" d="M240 240h80" stroke="#87b0ea" strokeWidth="2" strokeDasharray="4 7" />
              </g>
            )}

            {code === 503 && (
              <g>
                <path d="M254 129v-20q0-9 9-9h34q9 0 9 9v20" fill="none" stroke={fill("metal")} strokeWidth="10" />
                <rect x="201" y="128" width="158" height="125" rx="21" fill={fill("navy")} filter={fill("shadow")} />
                <rect x="201" y="128" width="158" height="43" rx="18" fill="#344b70" />
                <path d="M202 170h156" stroke="#657e9f" strokeOpacity=".6" />
                <rect x="269" y="159" width="22" height="26" rx="5" fill={fill("metal")} />
                <BrandGlyph x={259} y={198} size={41} />
                <g className="scene-wrench">
                  <path d="M338 66a21 21 0 0 0-25 24l-40 40a9 9 0 0 0 13 13l40-40a21 21 0 0 0 23-26l-14 14-13-13Z" fill={fill("gold")} stroke="#bb862d" strokeWidth="1.5" />
                  <circle cx="281" cy="135" r="3.2" fill="#7c571d" />
                </g>
              </g>
            )}

            {code === 504 && (
              <g>
                <rect x="270" y="58" width="20" height="22" rx="4" fill={fill("metal")} />
                <rect x="261" y="52" width="38" height="10" rx="5" fill={fill("navy")} />
                <path d="m335 87 12-12" stroke={fill("metal")} strokeWidth="10" strokeLinecap="round" />
                <circle cx="280" cy="169" r="87" fill={fill("metal")} filter={fill("shadow")} />
                <circle cx="280" cy="169" r="78" fill={fill("navy")} />
                {[0,1,2,3,4,5,6,7,8,9,10,11].map((i) => <path key={i} transform={`rotate(${i*30} 280 169)`} d="M280 102v7" stroke="#96accd" strokeWidth="2" />)}
                <path d="M280 169v-29" stroke="#dbe9fe" strokeWidth="4" strokeLinecap="round" />
                <g className="scene-clock-hand"><path d="M280 169v-50" stroke="#edbb66" strokeWidth="3" strokeLinecap="round" /></g>
                <circle cx="280" cy="169" r="5" fill="#edbb66" />
                <BrandGlyph x={265} y={204} size={31} />
                <circle className="scene-timeout-arc" cx="280" cy="169" r="91" stroke="#dba64f" strokeWidth="2.5" strokeDasharray="100 475" fill="none" />
              </g>
            )}
          </g>
        </g>
      </g>
      {checking && (
        <g className="scene-check-overlay" fill="none" stroke="#739fe0" strokeWidth="2">
          <path d="M180 105V80h25m150 0h25v25m0 145v25h-25m-150 0h-25v-25" />
          <path className="scene-scanline" d="M183 85h194" />
        </g>
      )}
      <g aria-hidden="true" className="scene-trails">
        {[0,1,2].map((i) => <circle key={i} cx={143+i*7} cy={138+i*45} r="2" fill="#86b0ee" style={{"--trail-delay":`${i*1.1}s`} as CSSProperties} />)}
      </g>
    </svg>
  );
}