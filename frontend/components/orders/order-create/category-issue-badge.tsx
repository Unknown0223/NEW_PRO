/** Kategoriya yorlig'i: miqdor > 0 bo'lgan qatorlarda narx/qoldiq muammolari soni. */

export function CategoryIssueCountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span
      className="pointer-events-none absolute right-1.5 top-1.5 z-[1] box-border flex h-5 min-h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-2 text-[11px] font-bold tabular-nums leading-none text-destructive-foreground shadow-md ring-2 ring-card"
      aria-label={`Muammo: ${count}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
