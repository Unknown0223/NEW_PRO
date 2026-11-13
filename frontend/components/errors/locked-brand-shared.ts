export const NAVY = "#16233f";
export const BLUE = "#1e63c9";
export const SKY = "#6fa4f2";
export const RED = "#ef4444";
export const GREEN = "#16a34a";

export type LockedBrandFx = Record<"deny" | "tug" | "scan" | "key" | "ok", number>;

export const LOCKED_BRAND_PACKETS = [
  { side: "l", y: 118, delay: 0, dur: 3.4, s: 5 },
  { side: "l", y: 166, delay: 1.2, dur: 2.9, s: 4 },
  { side: "l", y: 214, delay: 2.1, dur: 3.8, s: 6 },
  { side: "l", y: 94, delay: 2.9, dur: 3.1, s: 3.5 },
  { side: "r", y: 140, delay: 0.6, dur: 3.2, s: 5 },
  { side: "r", y: 192, delay: 1.7, dur: 3.6, s: 4 },
  { side: "r", y: 236, delay: 2.6, dur: 3.0, s: 3.5 },
  { side: "r", y: 106, delay: 3.3, dur: 3.9, s: 6 }
] as const;

export const LOCKED_BRAND_SPARKS = [
  { x: 242, y: 128, angles: [190, 225, 260] },
  { x: 318, y: 128, angles: [280, 315, 350] }
] as const;

export type LockedBrandArtProps = {
  className?: string;
  label?: string;
  lockLabel?: string;
  intro?: boolean;
  motion?: boolean;
  fx?: Partial<LockedBrandFx>;
  sent?: boolean;
  onLock?: () => void;
};
