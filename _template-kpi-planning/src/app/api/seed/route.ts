import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  tradeDirections,
  kpiGroups,
  employees,
  plans,
  kpiTargets,
  approvals,
} from "@/db/schema";

export async function POST() {
  await db.delete(approvals);
  await db.delete(kpiTargets);
  await db.delete(plans);
  await db.delete(employees);
  await db.delete(kpiGroups);
  await db.delete(tradeDirections);

  const directions = await db
    .insert(tradeDirections)
    .values([
      { name: "GIGA", code: "GIGA", brand: "GIGA", employeeCount: 45 },
      { name: "DIELUX", code: "DIELUX", brand: "DIELUX", employeeCount: 32 },
      { name: "LALAKU", code: "LALAKU", brand: "LALAKU", employeeCount: 28 },
      { name: "MONNO", code: "MONNO", brand: "MONNO", employeeCount: 21 },
      { name: "SOF", code: "SOF", brand: "SOF", employeeCount: 18 },
      { name: "MAMA", code: "MAMA", brand: "MAMA", employeeCount: 15 },
      { name: "MARKET PLACE", code: "MP", brand: "MP", employeeCount: 12 },
    ])
    .returning();

  const groups = await db
    .insert(kpiGroups)
    .values([
      { name: "GIGA KPI 1", tradeDirectionId: directions[0].id, status: "in_progress" },
      { name: "GIGA KPI 2 ECONOM (LIP)", tradeDirectionId: directions[0].id, status: "in_progress" },
      { name: "GIGA KPI 3 MINNI LIP", tradeDirectionId: directions[0].id, status: "in_progress" },
      { name: "GIGA KPI 3 MONNO TR", tradeDirectionId: directions[0].id, status: "in_progress" },
      { name: "GIGA KPI 4 QOLGANLAR", tradeDirectionId: directions[0].id, status: "in_progress" },
    ])
    .returning();

  // Employees matching screenshot names and hierarchy
  const sodiqov = await db
    .insert(employees)
    .values({
      name: "SODIQOV TO'LQIN DIREKTOR_№1",
      code: "DIR001",
      role: "manager",
      parentId: null,
    })
    .returning();

  const yoldoshev = await db
    .insert(employees)
    .values({
      name: "YO'LDOSHEV IKROMJON SAVDO DIREKTORI",
      code: "SD001",
      role: "manager",
      parentId: sodiqov[0].id,
    })
    .returning();

  const mirjalol = await db
    .insert(employees)
    .values({
      name: "Mirjalol Kom_Dir",
      code: "CD001",
      role: "manager",
      parentId: yoldoshev[0].id,
    })
    .returning();

  const jamoliddin = await db
    .insert(employees)
    .values({
      name: "YO'LDASHEV JAMOLIDDIN SM GIGA",
      code: "M001",
      role: "manager",
      parentId: mirjalol[0].id,
    })
    .returning();

  const abdullayev = await db
    .insert(employees)
    .values({
      name: "ABDULLAYEV DILMUROD [GGNM]",
      code: "GGNM",
      role: "supervisor",
      parentId: jamoliddin[0].id,
    })
    .returning();

  const yakubov = await db
    .insert(employees)
    .values({
      name: "YAKUBOV ALIBEK TM SHAXRISABZ",
      code: "GGSM",
      role: "supervisor",
      parentId: jamoliddin[0].id,
    })
    .returning();

  const yoqubov = await db
    .insert(employees)
    .values({
      name: "YOQUBOV TEHRONBEK [GGSM] 01/04/26",
      code: "GGSM2",
      role: "supervisor",
      parentId: jamoliddin[0].id,
    })
    .returning();

  const yuldashev = await db
    .insert(employees)
    .values({
      name: "YULDASHEV FARXOD [GGTO]",
      code: "GGTO",
      role: "supervisor",
      parentId: jamoliddin[0].id,
    })
    .returning();

  const zuxriddinov = await db
    .insert(employees)
    .values({
      name: "ZUXRIDDINOV SHAXBOZ [GGAN]",
      code: "GGAN",
      role: "supervisor",
      parentId: jamoliddin[0].id,
    })
    .returning();

  // Agents under ABDULLAYEV
  await db.insert(employees).values([
    { name: "05 - GGNM006 - (D) [MAXMUDOV ISLOMBEK] AAAA 11/03", code: "GGNM006", role: "agent", parentId: abdullayev[0].id },
    { name: "06 - GGNM007 - (D) [RASHITOV ABDULBOSIT] AAAA 19/02/26", code: "GGNM007", role: "agent", parentId: abdullayev[0].id },
    { name: "07 - GGNM008 - (D) [ASRAROV ABDULLO] AAAA 05/08", code: "GGNM008", role: "agent", parentId: abdullayev[0].id },
  ]);

  // Create plans for all groups for all months of 2026
  const allPlans = [];
  for (let m = 1; m <= 12; m++) {
    for (const group of groups) {
      const plan = await db
        .insert(plans)
        .values({
          month: m,
          year: 2026,
          tradeDirectionId: directions[0].id,
          kpiGroupId: group.id,
          status: "in_progress",
          createdBy: sodiqov[0].id,
        })
        .returning();
      allPlans.push(plan[0]);
    }
  }

  // Get all employees
  const allEmps = await db.select().from(employees);

  // Create KPI targets for each plan x employee
  for (const plan of allPlans) {
    for (const emp of allEmps) {
      const statuses = ["approved", "in_progress", "rejected", "draft"];
      const empIdx = allEmps.indexOf(emp);
      let status = "in_progress";
      if (emp.name.includes("SODIQOV") && plan.kpiGroupId === groups[0].id) {
        status = "rejected"; // Возвращено для редактирования
      } else if (emp.name.includes("SODIQOV") && plan.kpiGroupId === groups[1].id) {
        status = "approved"; // Одобрено
      } else {
        status = "in_progress";
      }

      await db.insert(kpiTargets).values({
        planId: plan.id,
        employeeId: emp.id,
        cost: "0",
        count: "0",
        volume: "0",
        acb: "0",
        orderCount: 0,
        comment: "",
        status: status as "draft" | "in_progress" | "pending_approval" | "approved" | "rejected" | "archived",
        updatedBy: sodiqov[0].id,
      });
    }
  }

  return NextResponse.json({ success: true });
}
