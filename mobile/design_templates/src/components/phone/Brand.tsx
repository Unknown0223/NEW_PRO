/**
 * Sales Arena — the real mobile brand from the project
 * (`appName = 'Sales Arena'`, assets/brand/app_icon.png, header_logo.png).
 * Mark: navy tile, white zig-zag, blue arrow shooting up-right.
 */
export const BRAND = {
  name: "Sales Arena",
  navy: "#14223F",
  blue: "#1F66D1",
  bright: "#6FA8FF",
} as const;

export function BrandMark({
  size = 40,
  draw = false,
  bare = false,
  radius,
}: {
  size?: number;
  /** animation: zig-zag draws, then the arrow shoots */
  draw?: boolean;
  /** no tile — white strokes only, for use on the brand colour */
  bare?: boolean;
  radius?: number;
}) {
  const arrow = bare ? "#FFFFFF" : BRAND.blue;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Sales Arena" style={{ display: "block", flexShrink: 0 }}>
      {!bare && <rect width="512" height="512" rx={radius ?? 116} fill={BRAND.navy} />}
      <path d="M148 330 L200 256 L248 290" fill="none" stroke="#FFFFFF" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className={draw ? "bm-zig" : undefined} />
      <path d="M248 292 L336 194" fill="none" stroke={arrow} strokeWidth="36" strokeLinecap="round" pathLength={1} className={draw ? "bm-arrow" : undefined} />
      <path d="M282 188 L356 174 L328 242 Z" fill={arrow} className={draw ? "bm-head" : undefined} />
    </svg>
  );
}

export function BrandWordmark({
  size = 16,
  tone = "light",
  suffix,
  suffixColor,
}: {
  size?: number;
  tone?: "light" | "dark" | "onBrand";
  /** role word shown after the name, e.g. "Dastavka" */
  suffix?: string;
  suffixColor?: string;
}) {
  const first = tone === "light" ? BRAND.navy : "#FFFFFF";
  const second = tone === "light" ? BRAND.blue : tone === "dark" ? BRAND.bright : "rgba(255,255,255,.82)";
  return (
    <span className="font-display font-bold leading-none tracking-[-0.03em]" style={{ fontSize: size }}>
      <span style={{ color: first }}>Sales</span>
      <span style={{ color: second }}>Arena</span>
      {suffix && (
        <span style={{ color: suffixColor ?? second, fontWeight: 600 }}>
          <span style={{ opacity: 0.45 }}> · </span>
          {suffix}
        </span>
      )}
    </span>
  );
}

/** Brand wave: left edge high, sweeping down to the right — rises to cover the screen. */
export function BrandWave({ top, children }: { top: string; children?: React.ReactNode }) {
  return (
    <div className="sa-wave pointer-events-none absolute inset-x-0 z-10 flex h-[150%] flex-col" style={{ top }}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="block h-[150px] w-full shrink-0" aria-hidden>
        <path d="M0 9 C 26 9, 60 17, 100 35 L100 41 L0 41 Z" fill={BRAND.bright} opacity="0.35" />
        <path d="M0 6 C 30 8, 62 18, 100 34 L100 41 L0 41 Z" fill={BRAND.blue} transform="translate(0 2)" />
      </svg>
      <div className="relative -mt-px flex-1" style={{ background: BRAND.blue }}>
        {children}
      </div>
    </div>
  );
}
