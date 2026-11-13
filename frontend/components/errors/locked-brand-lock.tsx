import type { KeyboardEvent } from "react";
import {
  BLUE,
  GREEN,
  LOCKED_BRAND_SPARKS,
  NAVY,
  RED,
  SKY
} from "./locked-brand-shared";

type Props = {
  refUrl: (name: string) => string;
  interactive: boolean;
  lockLabel: string;
  onLock?: () => void;
  onKey: (e: KeyboardEvent<SVGGElement>) => void;
  deny: number;
  tug: number;
  scan: number;
  keyFx: number;
  ok: number;
  pulseKey: number;
  sent: boolean;
  intro: boolean;
};

export function LockedBrandLock({
  refUrl,
  interactive,
  lockLabel,
  onLock,
  onKey,
  deny,
  tug,
  scan,
  keyFx,
  ok,
  pulseKey,
  sent,
  intro
}: Props) {
  return (
    <g className="sa-par-lock">
      <g className="sa-drop">
        <g className="sa-bob">
          <g
            className={interactive ? "sa-lockbtn" : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? lockLabel : undefined}
            onClick={onLock}
            onKeyDown={interactive ? onKey : undefined}
          >
            <rect x="198" y="50" width="164" height="226" rx="26" fill="transparent" />

            <g key={`d${deny}`} className={deny ? "sa-shake" : undefined}>
              <g key={`t${tug}`} className={tug ? "sa-wob" : undefined}>
                <g className="sa-lift">
                  <g className={tug ? "sa-tug" : undefined}>
                    <g className="sa-shk-close">
                      <path
                        d="M242 140V102a38 38 0 0 1 76 0v38"
                        fill="none"
                        stroke={refUrl("shackle")}
                        strokeWidth="17"
                        strokeLinecap="round"
                      />
                      <path
                        d="M247 128v-26a33 33 0 0 1 33-33"
                        fill="none"
                        stroke="#fff"
                        strokeOpacity="0.6"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                </g>

                <rect x="214" y="128" width="132" height="132" rx="29" fill={NAVY} filter={refUrl("ds")} />
                <rect x="214" y="128" width="132" height="132" rx="29" fill={refUrl("gloss")} />
                <rect x="214" y="128" width="132" height="132" rx="29" fill={refUrl("rim")} />
                <g clipPath={refUrl("body")}>
                  <polygon className="sa-glint" points="150,110 186,110 146,280 110,280" fill={refUrl("glint")} />
                </g>
                <rect
                  x="214.5"
                  y="128.5"
                  width="131"
                  height="131"
                  rx="28.5"
                  fill="none"
                  stroke="#fff"
                  strokeOpacity="0.07"
                />
                <g transform="translate(214 128) scale(0.2578125)">
                  <path
                    className="sa-draw-a"
                    d="M150 330L200 255L250 290"
                    pathLength={1}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="26"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    className="sa-draw-b"
                    d="M250 290L345 185"
                    pathLength={1}
                    fill="none"
                    stroke={BLUE}
                    strokeWidth="26"
                    strokeLinecap="round"
                  />
                  <polygon className="sa-head" points="345,185 285,192 322,235" fill={BLUE} />
                </g>
              </g>

              {deny ? (
                <>
                  <rect className="sa-deny-fill" x="214" y="128" width="132" height="132" rx="29" fill={RED} />
                  <rect
                    className="sa-deny-line"
                    x="209"
                    y="123"
                    width="142"
                    height="142"
                    rx="33"
                    fill="none"
                    stroke={RED}
                    strokeWidth="3"
                  />
                </>
              ) : null}
            </g>

            {scan ? (
              <g key={`s${scan}`} className="sa-nopo">
                <g className="sa-brackets" fill="none" stroke={SKY} strokeWidth="3" strokeLinecap="round">
                  <path d="M196 70V52h18M346 52h18v18M364 256v18h-18M214 274h-18v-18" />
                </g>
                <g className="sa-beam">
                  <rect x="200" y="40" width="160" height="26" fill={refUrl("beam")} />
                  <rect x="200" y="54" width="160" height="2" rx="1" fill="#bcd6ff" />
                </g>
              </g>
            ) : null}

            <g className="sa-nopo">
              <circle cx="280" cy="230" r="12" fill="#0b1730" fillOpacity="0.45" />
              <circle cx="280" cy="229" r="10" fill="#0b1730" fillOpacity="0.25" />
              <circle cx="280" cy="229" r="6" fill="#070f22" />
              <path d="M276.4 231h7.2l1.9 11h-11z" fill="#070f22" />
            </g>
            {pulseKey ? (
              <g key={`l${pulseKey}`} className="sa-nopo">
                <circle className="sa-klight" cx="280" cy="232" r="24" fill={refUrl("klight")} />
              </g>
            ) : null}

            {keyFx ? (
              <g key={`k${keyFx}`} className="sa-nopo">
                <g transform="translate(280 236)">
                  <g className="sa-key">
                    <rect x="0" y="-3.5" width="52" height="7" rx="3.5" fill={refUrl("gold")} />
                    <path d="M8 3.5V10h4V7h4v4h4V3.5z" fill={refUrl("gold")} />
                    <path
                      d="M49 0a15 15 0 1 0 30 0a15 15 0 1 0-30 0zM58 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0z"
                      fill={refUrl("gold")}
                      fillRule="evenodd"
                    />
                    <rect x="4" y="-2.4" width="40" height="1.6" rx="0.8" fill="#fff" fillOpacity="0.55" />
                  </g>
                </g>
              </g>
            ) : null}

            {deny ? (
              <g key={`x${deny}`} className="sa-xbadge sa-nopo">
                <circle cx="342" cy="132" r="13" fill={RED} stroke="#fff" strokeWidth="3" />
                <path d="M337 127l10 10M347 127l-10 10" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
              </g>
            ) : null}
            {sent ? (
              <g key={`ok${ok}`} className="sa-okbadge sa-nopo">
                <circle cx="342" cy="132" r="13" fill={GREEN} stroke="#fff" strokeWidth="3" />
                <path
                  d="M336.5 132.5l4 4 7.5-8"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ) : null}

            {interactive ? (
              <rect
                className="sa-focus"
                x="196"
                y="48"
                width="168"
                height="230"
                rx="28"
                fill="none"
                stroke={BLUE}
                strokeWidth="2"
                strokeDasharray="6 6"
              />
            ) : null}
          </g>

          {intro ? (
            <g className="sa-nopo">
              <circle
                className="sa-wave sa-wave-intro"
                cx="280"
                cy="194"
                r="70"
                fill="none"
                stroke={BLUE}
                strokeWidth="2.5"
              />
              {LOCKED_BRAND_SPARKS.map((s) => (
                <g
                  key={s.x}
                  className="sa-spark"
                  style={{ transformOrigin: `${s.x}px ${s.y}px` }}
                  stroke={SKY}
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  {s.angles.map((a) => {
                    const r = (a * Math.PI) / 180;
                    return (
                      <line
                        key={a}
                        x1={s.x + Math.cos(r) * 8}
                        y1={s.y + Math.sin(r) * 8}
                        x2={s.x + Math.cos(r) * 17}
                        y2={s.y + Math.sin(r) * 17}
                      />
                    );
                  })}
                </g>
              ))}
            </g>
          ) : null}
          {deny ? (
            <circle
              key={`w${deny}`}
              className="sa-wave sa-nopo"
              cx="280"
              cy="194"
              r="70"
              fill="none"
              stroke={RED}
              strokeWidth="2.5"
            />
          ) : null}
          {ok ? (
            <circle
              key={`o${ok}`}
              className="sa-wave sa-nopo"
              cx="280"
              cy="194"
              r="70"
              fill="none"
              stroke={GREEN}
              strokeWidth="2.5"
            />
          ) : null}
        </g>
      </g>
    </g>
  );
}
