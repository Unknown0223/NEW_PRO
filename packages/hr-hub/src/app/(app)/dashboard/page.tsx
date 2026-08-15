import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs, departments, employees, organizations } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.orgId))
    .limit(1);

  const [empCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(employees)
    .where(eq(employees.orgId, session.orgId));

  const [deptCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(departments)
    .where(eq(departments.orgId, session.orgId));

  const [attCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceLogs)
    .where(eq(attendanceLogs.orgId, session.orgId));

  const cards = [
    { label: "Xodimlar", value: empCount.count },
    { label: "Bo‘limlar", value: deptCount.count },
    { label: "Davomat yozuvlari", value: attCount.count },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {org?.name ?? "Tashkilot"} — mustaqil HR Hub paketi
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm"
          >
            <div className="text-sm text-[var(--muted)]">{c.label}</div>
            <div className="mt-2 text-3xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5 text-sm text-[var(--muted)]">
        <p>
          Bu paket <code className="text-[var(--ink)]">packages/hr-hub</code> ichida
          pivot kabi alohida ishlaydi. SALEC Arena bilan integratsiya (faqat xodimlar +
          tabel) keyinroq qo‘shiladi.
        </p>
      </div>
    </div>
  );
}
