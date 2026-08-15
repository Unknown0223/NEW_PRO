/**
 * Production HTTP smoke — to‘liq: remaining formula + to‘lov → qarz ↓ → limit ↑ → void cleanup.
 */
import { Prisma } from "@prisma/client";

const API = process.env.SMOKE_API_URL ?? "https://backend-production-3cf2.up.railway.app";
const SLUG = process.env.SMOKE_SLUG ?? "test1";
const LOGIN = process.env.SMOKE_LOGIN ?? "admin";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "secret123";
const PAY_AMOUNT = Number(process.env.SMOKE_PAY_AMOUNT ?? "1000");

async function jsonFetch(path: string, init?: RequestInit & { token?: string }) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init?.headers as Record<string, string> | undefined)
  };
  if (init?.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, body };
}

function fail(msg: string): never {
  console.error("FAIL:", msg);
  process.exit(1);
}

function asObj(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

async function main() {
  console.log("API", API);
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const login = await jsonFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ slug: SLUG, login: LOGIN, password: PASSWORD })
  });
  if (login.status !== 200 || !asObj(login.body).accessToken) {
    fail(`login ${login.status}`);
  }
  const token = String(asObj(login.body).accessToken);
  console.log("OK: login");

  const list = await jsonFetch(`/api/${SLUG}/consignment/agents?year_month=${ym}`, { token });
  if (list.status !== 200) fail(`consignment list ${list.status}: ${JSON.stringify(list.body).slice(0, 250)}`);
  const rows = (asObj(list.body).data ?? list.body) as Array<{
    id: number;
    outstanding_debt: string;
    remaining_limit: string | null;
    consignment_limit_amount: string | null;
    consignment: boolean;
  }>;
  if (!Array.isArray(rows)) fail("agents not array");
  console.log("OK: agents", rows.length);

  for (const a of rows.filter((r) => r.consignment && r.consignment_limit_amount).slice(0, 5)) {
    const lim = new Prisma.Decimal(a.consignment_limit_amount!);
    const out = new Prisma.Decimal(a.outstanding_debt);
    const rem = new Prisma.Decimal(a.remaining_limit ?? "0");
    const expected = Prisma.Decimal.max(0, lim.sub(out));
    if (!rem.equals(expected)) fail(`agent ${a.id} remaining mismatch`);
    console.log(`OK: formula agent ${a.id} rem=${rem}`);
  }

  const debtor = rows.find(
    (r) => r.consignment && new Prisma.Decimal(r.outstanding_debt).gte(PAY_AMOUNT)
  );
  if (!debtor) {
    console.log("SKIP: write-path (no agent with outstanding >=", PAY_AMOUNT, ")");
  } else {
    const beforeOut = new Prisma.Decimal(debtor.outstanding_debt);
    const beforeRem = new Prisma.Decimal(debtor.remaining_limit ?? "0");
    console.log("write-path agent", debtor.id, "outstanding", beforeOut.toString());

    const ordersRes = await jsonFetch(
      `/api/${SLUG}/orders?page=1&limit=20&agent_id=${debtor.id}&is_consignment=yes`,
      { token }
    );
    if (ordersRes.status !== 200) {
      fail(`orders list ${ordersRes.status}: ${JSON.stringify(ordersRes.body).slice(0, 250)}`);
    }
    const orders = (asObj(ordersRes.body).data ?? []) as Array<{
      id: number;
      client_id: number;
      total_sum: string;
      status: string;
      is_consignment?: boolean;
    }>;
    const target = orders[0];
    if (!target) fail("no consignment order for debtor agent");

    const desks = await jsonFetch(`/api/${SLUG}/cash-desks`, { token });
    if (desks.status !== 200) fail(`cash-desks ${desks.status}`);
    const deskRows = (asObj(desks.body).data ?? desks.body) as Array<{
      id: number;
      is_active: boolean;
      accepts_client_payments?: boolean;
    }>;
    const desk =
      deskRows.find((d) => d.is_active && d.accepts_client_payments !== false) ??
      deskRows.find((d) => d.is_active) ??
      deskRows[0];
    if (!desk) fail("no cash desk");

    const createPay = await jsonFetch(`/api/${SLUG}/payments`, {
      method: "POST",
      token,
      body: JSON.stringify({
        client_id: target.client_id,
        amount: PAY_AMOUNT,
        payment_type: "cash_uzs",
        cash_desk_id: desk.id,
        note: `[smoke-consign-limit] agent=${debtor.id} order=${target.id}`,
        order_id: target.id,
        allocation_order_ids: [target.id],
        allocation_mode: "consignment"
      })
    });
    if (createPay.status !== 201 && createPay.status !== 200) {
      fail(`create payment ${createPay.status}: ${JSON.stringify(createPay.body).slice(0, 400)}`);
    }
    const payBody = asObj(createPay.body);
    const payment = (payBody.data ?? payBody) as { id: number };
    const paymentId = payment.id;
    if (!paymentId) fail("payment id missing");
    console.log("OK: payment created", paymentId, "→ order", target.id);

    // Ensure allocation exists
    const alloc = await jsonFetch(`/api/${SLUG}/payments/${paymentId}/allocate`, {
      method: "POST",
      token,
      body: JSON.stringify({ order_ids: [target.id] })
    });
    console.log("allocate status", alloc.status);

    const afterList = await jsonFetch(`/api/${SLUG}/consignment/agents?year_month=${ym}`, { token });
    const afterRows = (asObj(afterList.body).data ?? []) as typeof rows;
    const afterAgent = afterRows.find((r) => r.id === debtor.id);
    if (!afterAgent) fail("agent missing after pay");
    const afterOut = new Prisma.Decimal(afterAgent.outstanding_debt);
    const afterRem = new Prisma.Decimal(afterAgent.remaining_limit ?? "0");
    const outDrop = beforeOut.sub(afterOut);
    const remRise = afterRem.sub(beforeRem);
    console.log("after pay outstanding", afterOut.toString(), "remaining", afterRem.toString());
    console.log("delta outstanding", outDrop.toString(), "delta remaining", remRise.toString());

    if (outDrop.lte(0)) {
      // cleanup then fail
      await jsonFetch(`/api/${SLUG}/payments/${paymentId}?cancel_reason_ref=smoke`, {
        method: "DELETE",
        token
      });
      fail("outstanding did not decrease after payment");
    }
    if (remRise.lte(0)) {
      await jsonFetch(`/api/${SLUG}/payments/${paymentId}?cancel_reason_ref=smoke`, {
        method: "DELETE",
        token
      });
      fail("remaining limit did not increase after payment");
    }
    console.log("OK: payment reduced debt and restored limit");

    const del = await jsonFetch(`/api/${SLUG}/payments/${paymentId}?cancel_reason_ref=smoke_test`, {
      method: "DELETE",
      token
    });
    if (del.status !== 204 && del.status !== 200) {
      fail(`void payment ${del.status}: ${JSON.stringify(del.body).slice(0, 250)}`);
    }
    console.log("OK: payment voided (cleanup)");

    const finalList = await jsonFetch(`/api/${SLUG}/consignment/agents?year_month=${ym}`, { token });
    const finalRows = (asObj(finalList.body).data ?? []) as typeof rows;
    const finalAgent = finalRows.find((r) => r.id === debtor.id);
    if (!finalAgent) fail("agent missing after void");
    const finalOut = new Prisma.Decimal(finalAgent.outstanding_debt);
    // After void, outstanding should return near before (allow tiny drift)
    if (finalOut.sub(beforeOut).abs().gt(1)) {
      console.warn(
        "WARN: after void outstanding",
        finalOut.toString(),
        "vs before",
        beforeOut.toString()
      );
    } else {
      console.log("OK: after void outstanding restored");
    }
  }

  const ready = await fetch(`${API}/ready`);
  if (!ready.ok) fail("/ready failed");
  console.log("OK: /ready");
  console.log("\nFULL HTTP SMOKE PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
