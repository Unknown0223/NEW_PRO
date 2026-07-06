export function PaymentHistoryDetailSkeleton() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-6 shadow-sm">
      <div className="space-y-0 divide-y divide-slate-100 border border-slate-200">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="flex h-[38px] items-center gap-6 px-4">
            <div className="h-3 w-40 rounded bg-slate-200/80" />
            <div className="ml-auto h-3 w-32 rounded bg-slate-100" />
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
