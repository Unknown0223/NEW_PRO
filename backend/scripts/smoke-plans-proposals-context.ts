import { prisma } from "../src/config/database";
import { buildProposalContext } from "../src/modules/plans/proposals/proposals.context";
import { calculateProposalLive } from "../src/modules/plans/proposals/proposals.calculate";
import { DEFAULT_CONFIG } from "@salec/plans-proposal";

async function main() {
  const direction = await prisma.tradeDirection.findFirst({
    where: { tenant_id: 1, is_active: true },
    orderBy: { id: "asc" }
  });
  if (!direction) throw new Error("No trade direction for tenant 1");
  const target = { year: 2026, month: 12 };
  const source = { year: 2026, month: 10 };
  const ctx = await buildProposalContext(1, direction.id, target, source);
  console.log(
    JSON.stringify(
      {
        direction: direction.name,
        directions: ctx.directions.length,
        kpis: ctx.kpi_groups.map((g) => g.name),
        agents: ctx.datasets.reduce((n, x) => n + x.employees.length, 0),
        meta: ctx.source_meta,
        hash: ctx.snapshot_hash
      },
      null,
      2
    )
  );
  const configs: Record<string, typeof DEFAULT_CONFIG> = {};
  for (const g of ctx.kpi_groups) configs[String(g.id)] = DEFAULT_CONFIG;
  const calc = await calculateProposalLive(1, {
    direction_id: direction.id,
    target,
    source,
    configs
  });
  console.log(
    JSON.stringify(
      {
        kpiResults: calc.result.kpis.length,
        readyRows: calc.result.kpis.reduce(
          (n, k) => n + k.result.rows.filter((r) => r.ready).length,
          0
        ),
        proposedTotal: calc.result.totals.proposed
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
