/**
 * Backend migratsiyasi qo‘llanmaganda (Prisma P2021/P2022 → 503 DatabaseSchemaMismatch).
 */
export function DatabaseSchemaMismatchCallout() {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <p className="font-medium">База данных не соответствует версии кода</p>
      <p className="mt-2 text-muted-foreground">
        Примените миграции: в корне проекта{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">npm run db:deploy</code>
        или{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">npx prisma migrate deploy</code>{" "}
        (в папке <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">backend</code>)
        . Затем перезапустите API.
      </p>
    </div>
  );
}
