import { NAVY, BLUE, SKY } from "./locked-brand-shared";

type Props = {
  id: (name: string) => string;
  refUrl: (name: string) => string;
  motion: boolean;
};

export function LockedBrandDefs({ id, refUrl, motion }: Props) {
  return (
    <defs>
      <linearGradient id={id("digit")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={NAVY} stopOpacity="0.34" />
        <stop offset="100%" stopColor={BLUE} stopOpacity="0.15" />
      </linearGradient>
      <pattern id={id("grid")} width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0H0V16" fill="none" stroke={BLUE} strokeOpacity="0.15" strokeWidth="1" />
      </pattern>
      <linearGradient
        id={id("shine")}
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="0"
        x2="150"
        y2="70"
        gradientTransform="translate(-240 0)"
      >
        <stop offset="0" stopColor={SKY} stopOpacity="0" />
        <stop offset="0.5" stopColor={SKY} stopOpacity="0.6" />
        <stop offset="1" stopColor={SKY} stopOpacity="0" />
        {motion ? (
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            values="-240 0;-240 0;640 0;640 0"
            keyTimes="0;0.3;0.7;1"
            dur="7s"
            repeatCount="indefinite"
          />
        ) : null}
      </linearGradient>
      <radialGradient id={id("fade")} cx="50%" cy="46%" r="56%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="42%" stopColor="#fff" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <mask id={id("mask")} maskUnits="userSpaceOnUse" x="-40" y="-40" width="640" height="380">
        <rect x="-40" y="-40" width="640" height="380" fill={refUrl("fade")} />
      </mask>
      <radialGradient id={id("glow")} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={BLUE} stopOpacity="0.22" />
        <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={id("shackle")} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#d3ddec" />
        <stop offset="50%" stopColor="#97aacb" />
        <stop offset="100%" stopColor="#5f7599" />
      </linearGradient>
      <linearGradient id={id("gloss")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="55%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id("glint")} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id("beam")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={SKY} stopOpacity="0" />
        <stop offset="55%" stopColor={SKY} stopOpacity="0.45" />
        <stop offset="100%" stopColor={SKY} stopOpacity="0" />
      </linearGradient>
      <linearGradient id={id("gold")} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fde68a" />
        <stop offset="55%" stopColor="#f5b62e" />
        <stop offset="100%" stopColor="#c27a0e" />
      </linearGradient>
      <clipPath id={id("body")}>
        <rect x="214" y="128" width="132" height="132" rx="29" />
      </clipPath>
      <radialGradient id={id("rim")} cx="50%" cy="20%" r="90%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.1" />
        <stop offset="60%" stopColor="#fff" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
      </radialGradient>
      <filter id={id("ds")} x="-40%" y="-30%" width="180%" height="190%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor={NAVY} floodOpacity="0.26" />
      </filter>
      <radialGradient id={id("klight")} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}
