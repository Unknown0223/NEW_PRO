import { useId } from "react";
import { cn } from "@/lib/utils";

/** SALEC AI brend ikonkasi — Sales Arena zig-zag + AI spark. */
export function SalecAiIcon({
  size = 44,
  className,
  rounded = true
}: {
  size?: number;
  className?: string;
  rounded?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const bg = `bg-${uid}`;
  const arrow = `ar-${uid}`;
  const glow = `gl-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label="SALEC AI brend ikonkasi"
    >
      <defs>
        <linearGradient id={bg} x1="40" y1="30" x2="470" y2="490" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1B2D50" />
          <stop offset="0.55" stopColor="#16233F" />
          <stop offset="1" stopColor="#11203C" />
        </linearGradient>
        <linearGradient id={arrow} x1="290" y1="220" x2="390" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="#59C7FF" />
          <stop offset="1" stopColor="#1E63C9" />
        </linearGradient>
        <radialGradient
          id={glow}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(390 110) rotate(90) scale(230)"
        >
          <stop stopColor="#2E8BE8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2E8BE8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {rounded ? (
        <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
      ) : (
        <rect width="512" height="512" fill={`url(#${bg})`} />
      )}
      <rect
        x="12"
        y="12"
        width="488"
        height="488"
        rx={rounded ? "108" : "0"}
        stroke="#FFFFFF"
        strokeOpacity="0.13"
        strokeWidth="2"
      />
      <circle cx="390" cy="110" r="230" fill={`url(#${glow})`} />

      <g stroke="#FFFFFF" strokeOpacity="0.07" strokeWidth="2">
        <path d="M96 390H416" />
        <path d="M96 330H416" />
        <path d="M150 132V390" />
        <path d="M256 132V390" />
        <path d="M362 132V390" />
      </g>

      <path
        d="M112 356 L198 258 L258 300 L352 190"
        stroke="#FFFFFF"
        strokeWidth="32"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M352 190 L286 196 L326 248 Z"
        fill={`url(#${arrow})`}
        stroke="#8ED8FF"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      <circle cx="198" cy="258" r="14" fill="#5FE0C4" stroke="#16233F" strokeWidth="6" />
      <circle cx="258" cy="300" r="11" fill="#5FE0C4" stroke="#16233F" strokeWidth="5" />
      <circle cx="112" cy="356" r="11" fill="#FFFFFF" stroke="#16233F" strokeWidth="5" />

      <path
        d="M392 92 C398 118 410 130 436 136 C410 142 398 154 392 180 C386 154 374 142 348 136 C374 130 386 118 392 92Z"
        fill="#5FE0C4"
        opacity="0.96"
      />
      <circle cx="146" cy="164" r="9" fill="#1E63C9" />
      <circle cx="132" cy="196" r="5" fill="#5FE0C4" opacity="0.8" />
    </svg>
  );
}

export function AiSpark({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <path
        d="M12 1.8c.75 5.1 2.1 6.45 7.2 7.2-5.1.75-6.45 2.1-7.2 7.2-.75-5.1-2.1-6.45-7.2-7.2 5.1-.75 6.45-2.1 7.2-7.2Z"
        fill="currentColor"
      />
      <path
        d="M19.2 15.6c.34 2.3.95 2.9 3.25 3.25-2.3.34-2.91.95-3.25 3.25-.34-2.3-.95-2.91-3.25-3.25 2.3-.34 2.91-.95 3.25-3.25Z"
        fill="currentColor"
        opacity="0.65"
      />
    </svg>
  );
}

export function BrandLockup({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="absolute -inset-1 rounded-[20px] bg-[#35c8ae]/25 blur-md" />
        <SalecAiIcon size={compact ? 36 : 42} className="relative" />
      </div>
      <div className="leading-none">
        <div
          className={cn(
            "text-[19px] font-extrabold tracking-[-0.04em]",
            dark ? "text-white" : "text-[var(--ai-text)]"
          )}
        >
          SALEC<span className="text-[#35c8ae]">.</span>
        </div>
        <div
          className={cn(
            "mt-1 text-[9px] font-semibold uppercase tracking-[0.22em]",
            dark ? "text-white/55" : "text-[var(--ai-faint)]"
          )}
        >
          AI Yordamchi
        </div>
      </div>
    </div>
  );
}
