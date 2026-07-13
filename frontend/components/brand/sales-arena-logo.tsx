import { cn } from "@/lib/utils";

type Props = {
  /** `dark` — qorong‘i fon (login panel, sidebar). `light` — och fon. */
  variant?: "dark" | "light";
  /** Faqat kvadrat ikonka (matnsiz). */
  iconOnly?: boolean;
  className?: string;
  height?: number;
};

/** Sales Arena brend logotipi (SVG, aniq balandlik). */
export function SalesArenaLogo({
  variant = "light",
  iconOnly = false,
  className,
  height = 48
}: Props) {
  if (iconOnly) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/brand/icon_transparent.svg"
        alt="Sales Arena"
        width={height}
        height={height}
        className={cn("shrink-0 object-contain", className)}
        style={{ width: height, height }}
      />
    );
  }

  const src = variant === "dark" ? "/brand/header_logo_dark.svg" : "/brand/header_logo.svg";
  const w = Math.round((height * 360) / 80);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Sales Arena"
      width={w}
      height={height}
      className={cn("shrink-0 object-contain object-left", className)}
      style={{ height, width: "auto", maxWidth: "100%" }}
    />
  );
}
