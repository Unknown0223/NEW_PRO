import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "./index";
import {
  organizations,
  departments,
  employees,
  users,
  attendanceLogs,
  shifts,
  auditLogs,
} from "./schema";

function hashChain(prev: string | null, payload: string): string {
  return createHash("sha256").update(`${prev ?? "genesis"}:${payload}`).digest("hex");
}

async function seed() {
  const existing = await db.select().from(organizations).limit(1);
  if (existing.length > 0) {
    console.log("Seed skip: organization already exists");
    return;
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: "Demo Retail",
      domain: "demo.hrhub.local",
      industry: "retail",
      status: "trial",
    })
    .returning();

  const [salesDept, warehouseDept] = await db
    .insert(departments)
    .values([
      { orgId: org.id, name: "Savdo" },
      { orgId: org.id, name: "Ombor" },
    ])
    .returning();

  const [emp1, emp2, emp3] = await db
    .insert(employees)
    .values([
      {
        orgId: org.id,
        departmentId: salesDept.id,
        fullName: "Ali Valiyev",
        email: "ali@demo.local",
        phone: "+998901112233",
        position: "Sotuvchi",
        status: "active",
      },
      {
        orgId: org.id,
        departmentId: salesDept.id,
        fullName: "Dilnoza Karimova",
        email: "dilnoza@demo.local",
        phone: "+998901112244",
        position: "Katta sotuvchi",
        status: "active",
      },
      {
        orgId: org.id,
        departmentId: warehouseDept.id,
        fullName: "Jasur Toshmatov",
        email: "jasur@demo.local",
        phone: "+998901112255",
        position: "Omborchi",
        status: "active",
      },
    ])
    .returning();

  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(users).values([
    {
      orgId: org.id,
      email: "admin@demo.local",
      passwordHash,
      fullName: "HR Admin",
      role: "org_admin",
    },
    {
      orgId: org.id,
      email: "manager@demo.local",
      passwordHash: await bcrypt.hash("manager123", 10),
      fullName: "Savdo Manager",
      role: "manager",
      employeeId: emp2.id,
    },
    {
      orgId: org.id,
      email: "ali@demo.local",
      passwordHash: await bcrypt.hash("employee123", 10),
      fullName: "Ali Valiyev",
      role: "employee",
      employeeId: emp1.id,
    },
  ]);

  const now = new Date();
  const morningStart = new Date(now);
  morningStart.setHours(9, 0, 0, 0);
  const morningEnd = new Date(now);
  morningEnd.setHours(18, 0, 0, 0);

  await db.insert(shifts).values([
    {
      orgId: org.id,
      employeeId: emp1.id,
      shiftType: "morning",
      startAt: morningStart,
      endAt: morningEnd,
      isApproved: true,
    },
    {
      orgId: org.id,
      employeeId: emp2.id,
      shiftType: "morning",
      startAt: morningStart,
      endAt: morningEnd,
      isApproved: true,
    },
  ]);

  await db.insert(attendanceLogs).values([
    {
      orgId: org.id,
      employeeId: emp1.id,
      type: "check_in",
      method: "manual",
      location: { source: "seed" },
      note: "Demo check-in",
    },
  ]);

  const payload = JSON.stringify({ action: "seed", orgId: org.id });
  const hash = hashChain(null, payload);
  await db.insert(auditLogs).values({
    orgId: org.id,
    action: "seed.complete",
    actorId: "system",
    payload: { orgId: org.id, employees: 3 },
    hash,
    prevHash: null,
  });

  console.log("Seed OK");
  console.log("  Login: admin@demo.local / admin123");
  console.log("  Org:", org.name, org.id);
  console.log("  Employees:", emp1.fullName, emp2.fullName, emp3.fullName);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
