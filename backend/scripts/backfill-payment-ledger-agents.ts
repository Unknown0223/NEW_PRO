/**
 * To‘lovlarda ledger_agent_id ni to‘ldirish / moslashtirish:
 * 1) allocation orqali bitta order-agent → shu agent
 * 2) order_id orqali → order.agent_id
 * 3) qolgan NULL → client.agent_id (muzlatish)
 *
 *   npx tsx scripts/backfill-payment-ledger-agents.ts [slug|--all] [--dry-run]
 */
import { prisma } from "../src/config/database";

const dryRun = process.argv.includes("--dry-run");
const arg = process.argv.slice(2).find((a) => a !== "--dry-run");

async function auditTenant(tenantId: number) {
  const nullLeft = await prisma.payment.count({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      ledger_agent_id: null,
      entry_kind: { in: ["payment", "refund"] },
      NOT: { workflow_status: { in: ["pending_confirmation", "rejected", "deleted"] } }
    }
  });
  const mismatch = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM client_payments p
    JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.tenant_id = p.tenant_id
    JOIN orders o ON o.id = pa.order_id AND o.tenant_id = p.tenant_id
    WHERE p.tenant_id = ${tenantId}
      AND p.deleted_at IS NULL
      AND p.entry_kind IN ('payment', 'refund')
      AND COALESCE(p.workflow_status, 'confirmed') NOT IN ('pending_confirmation', 'rejected', 'deleted')
      AND o.agent_id IS NOT NULL
      AND p.ledger_agent_id IS DISTINCT FROM o.agent_id
      AND (
        SELECT COUNT(DISTINCT o2.agent_id)
        FROM payment_allocations pa2
        JOIN orders o2 ON o2.id = pa2.order_id
        WHERE pa2.payment_id = p.id AND o2.agent_id IS NOT NULL
      ) = 1
  `;
  return { nullLeft, mismatch: Number(mismatch[0]?.n ?? 0) };
}

async function runTenant(tenantId: number, slug: string) {
  const before = await auditTenant(tenantId);
  if (dryRun) {
    console.log(`✓ ${slug}: dry-run null=${before.nullLeft} mismatch_single_alloc=${before.mismatch}`);
    return;
  }

  const updatedAlloc = await prisma.$executeRaw`
    WITH per_pay AS (
      SELECT
        p.id AS payment_id,
        COUNT(DISTINCT o.agent_id) FILTER (WHERE o.agent_id IS NOT NULL) AS agent_cnt,
        MIN(o.agent_id) FILTER (WHERE o.agent_id IS NOT NULL) AS sole_agent
      FROM client_payments p
      JOIN payment_allocations pa ON pa.payment_id = p.id AND pa.tenant_id = p.tenant_id
      JOIN orders o ON o.id = pa.order_id AND o.tenant_id = p.tenant_id
      WHERE p.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND p.entry_kind IN ('payment', 'refund', 'discount_settlement')
        AND COALESCE(p.workflow_status, 'confirmed') NOT IN ('pending_confirmation', 'rejected', 'deleted')
      GROUP BY p.id
    ),
    fix AS (
      SELECT payment_id, sole_agent
      FROM per_pay
      WHERE agent_cnt = 1 AND sole_agent IS NOT NULL
    )
    UPDATE client_payments p
    SET ledger_agent_id = f.sole_agent
    FROM fix f
    WHERE p.id = f.payment_id
      AND p.tenant_id = ${tenantId}
      AND (p.ledger_agent_id IS NULL OR p.ledger_agent_id IS DISTINCT FROM f.sole_agent)
  `;

  const updatedOrder = await prisma.$executeRaw`
    UPDATE client_payments p
    SET ledger_agent_id = o.agent_id
    FROM orders o
    WHERE p.tenant_id = ${tenantId}
      AND o.id = p.order_id
      AND o.tenant_id = p.tenant_id
      AND p.deleted_at IS NULL
      AND p.entry_kind IN ('payment', 'refund', 'discount_settlement')
      AND COALESCE(p.workflow_status, 'confirmed') NOT IN ('pending_confirmation', 'rejected', 'deleted')
      AND o.agent_id IS NOT NULL
      AND (p.ledger_agent_id IS NULL OR p.ledger_agent_id IS DISTINCT FROM o.agent_id)
      AND NOT EXISTS (
        SELECT 1
        FROM payment_allocations pa
        JOIN orders o2 ON o2.id = pa.order_id
        WHERE pa.payment_id = p.id
          AND o2.agent_id IS NOT NULL
          AND o2.agent_id IS DISTINCT FROM o.agent_id
      )
  `;

  const updatedClient = await prisma.$executeRaw`
    UPDATE client_payments p
    SET ledger_agent_id = c.agent_id
    FROM clients c
    WHERE p.tenant_id = ${tenantId}
      AND c.id = p.client_id
      AND c.tenant_id = p.tenant_id
      AND p.deleted_at IS NULL
      AND p.ledger_agent_id IS NULL
      AND p.entry_kind IN ('payment', 'refund', 'discount_settlement', 'client_expense')
      AND COALESCE(p.workflow_status, 'confirmed') NOT IN ('pending_confirmation', 'rejected', 'deleted')
      AND c.agent_id IS NOT NULL
  `;

  const after = await auditTenant(tenantId);
  console.log(
    `✓ ${slug}: alloc=${updatedAlloc} order=${updatedOrder} client=${updatedClient}` +
      ` | before null=${before.nullLeft} mismatch=${before.mismatch}` +
      ` | after null=${after.nullLeft} mismatch=${after.mismatch}`
  );
}

async function main() {
  const tenants =
    arg && arg !== "--all"
      ? await prisma.tenant.findMany({ where: { slug: arg }, select: { id: true, slug: true } })
      : await prisma.tenant.findMany({ select: { id: true, slug: true } });
  if (!tenants.length) {
    console.error("Tenant topilmadi");
    process.exit(1);
  }
  for (const t of tenants) await runTenant(t.id, t.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
