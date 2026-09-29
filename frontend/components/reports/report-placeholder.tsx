"use client";

export function ReportPlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">Раздел пока в разработке. Функции будут добавляться поэтапно.</p>
    </div>
  );
}
