import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  ensureCategory,
  ensureClient,
  ensureDefaultInterchangeableGroup,
  ensureWarehouse,
  mergeDefaultReasonReferences,
  prisma
} from "./helpers";
import { seedTest1ClientRefusals } from "./seed-test1-refusals";
import { syncDefaultPermissionMetadata } from "../../src/modules/access/permission-catalog.service";
import {
  ensureRoleByKey,
  ensureTenantRolesForRoleDefaults,
  syncTenantUserRolesFromProfile
} from "../../src/modules/access/rbac.roles";
import { setRolePermissions } from "../../src/modules/access/rbac.permissions";
import { buildRoleDefaultKeys } from "../../src/modules/access/role-permission-presets";

const MOBILE_ROLE_PERMISSION_KEYS = [
  "orders.view",
  "orders.create",
  "orders.zakaz.spisok_zakazov",
  "orders.zakaz.prosmotr_zakaza",
  "orders.zakaz.sozdanie_zakaza",
  "clients.spisok_klientov",
  "clients.prosmotr_profilya_klienta",
  "staff.agent.konfiguratsii",
  "staff.agent.prosmotr_agenta",
  "warehouse.view",
  "dashboard.view",
  "dashboard.supervayzer",
  "dashboard.prodazhi"
] as const;

/** Lokal dev: veb panelda qo‘yilgan majburiy yangilanish loginni bloklamasin. */
async function resetDevMobileAppReleasePolicy(tenantId: number) {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) return;
  const st = (row.settings ?? {}) as Record<string, unknown>;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...st,
        mobile_app_release: {
          min_version: "3.0.0",
          latest_version: "3.0.0",
          force_update: false,
          download_url: null,
          store_url_android: null,
          store_url_ios: null,
          release_notes: null
        }
      } as Prisma.InputJsonValue
    }
  });
}

async function seedMobileRolePermissions(tenantId: number) {
  await ensureTenantRolesForRoleDefaults(tenantId);
  await syncTenantUserRolesFromProfile(tenantId);
  await syncDefaultPermissionMetadata(tenantId);
  const allKeys = (
    await prisma.permission.findMany({
      where: { tenant_id: tenantId },
      select: { key: true }
    })
  ).map((p) => p.key);
  const adminRole = await ensureRoleByKey(tenantId, "admin");
  await setRolePermissions(tenantId, adminRole.id, allKeys);
  const operatorRole = await ensureRoleByKey(tenantId, "operator");
  await setRolePermissions(tenantId, operatorRole.id, buildRoleDefaultKeys("operator"));
  for (const roleKey of ["agent", "supervisor", "expeditor"] as const) {
    const role = await ensureRoleByKey(tenantId, roleKey);
    await setRolePermissions(tenantId, role.id, [...MOBILE_ROLE_PERMISSION_KEYS]);
  }
}

export async function seedTest1Tenant() {
  const password_hash = await bcrypt.hash("secret123", 10);
  /** Mobil agent + veb «Агент» demo: login `agent`, parol `111111` */
  const agent_password_hash = await bcrypt.hash("111111", 10);

  const test1 = await prisma.tenant.upsert({
    where: { slug: "test1" },
    update: { name: "Tizimdan foydalanish" },
    create: {
      slug: "test1",
      name: "Tizimdan foydalanish",
      plan: "basic",
      is_active: true
    }
  });

  const demo = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo Kompaniya",
      plan: "pro",
      is_active: true
    }
  });

  await mergeDefaultReasonReferences(test1.id);
  await mergeDefaultReasonReferences(demo.id);

  if (process.env.NODE_ENV !== "production") {
    await resetDevMobileAppReleasePolicy(test1.id);
    await resetDevMobileAppReleasePolicy(demo.id);
  }

  for (const tenant of [test1, demo]) {
    await prisma.user.upsert({
      where: { tenant_id_login: { tenant_id: tenant.id, login: "admin" } },
      /* `update`da ham is_active — aks holda eski DBda o‘chirilgan admin seeddan keyin ham kira olmaydi */
      update: { password_hash, is_active: true },
      create: {
        tenant_id: tenant.id,
        name: "Admin",
        login: "admin",
        password_hash,
        role: "admin",
        is_active: true
      }
    });
  }

  await prisma.user.upsert({
    where: { tenant_id_login: { tenant_id: test1.id, login: "operator" } },
    update: { password_hash, is_active: true },
    create: {
      tenant_id: test1.id,
      name: "Operator (seed)",
      login: "operator",
      password_hash,
      role: "operator",
      is_active: true
    }
  });

  await prisma.user.upsert({
    where: { tenant_id_login: { tenant_id: test1.id, login: "supervisor" } },
    update: { password_hash, is_active: true },
    create: {
      tenant_id: test1.id,
      name: "Supervizor (seed)",
      first_name: "Supervizor",
      last_name: "Seed",
      login: "supervisor",
      password_hash,
      role: "supervisor",
      is_active: true
    }
  });

  /** Yangi zakazlar uchun majburiy agent (`ORDER_REQUIRES_AGENT`) — integratsiya testlari va demo */
  const seedAgent = await prisma.user.upsert({
    where: { tenant_id_login: { tenant_id: test1.id, login: "agent" } },
    update: { password_hash: agent_password_hash, is_active: true, role: "agent" },
    create: {
      tenant_id: test1.id,
      name: "Agent (seed)",
      login: "agent",
      password_hash: agent_password_hash,
      role: "agent",
      is_active: true
    }
  });

  const whMain = await ensureWarehouse(test1.id, "Asosiy ombor", "main");
  const whBranch = await ensureWarehouse(test1.id, "Filial ombor", "branch");

  for (const wid of [whMain.id, whBranch.id]) {
    const agentLinkExisting = await prisma.warehouseUserLink.findFirst({
      where: { warehouse_id: wid, user_id: seedAgent.id }
    });
    if (!agentLinkExisting) {
      await prisma.warehouseUserLink.create({
        data: {
          warehouse_id: wid,
          user_id: seedAgent.id,
          link_role: "agent"
        }
      });
    }
  }

  const catDrinks = await ensureCategory(test1.id, "Ichimliklar");
  const catFood = await ensureCategory(test1.id, "Oziq-ovqat");

  await prisma.user.update({
    where: { id: seedAgent.id },
    data: {
      agent_entitlements: {
        price_types: ["default"],
        product_rules: [
          { category_id: catDrinks.id, all: true },
          { category_id: catFood.id, all: true }
        ],
        mobile_config: {
          schema_version: 1,
          client: {
            can_create: true,
            can_edit: true,
            can_change_client_location: true,
            show_balance: true,
            show_photos: true,
            phone_prefix: "+998",
            fields_visible: {
              name: true,
              legal_name: true,
              phone: true,
              category: true,
              territory: true,
              address: true,
              visit_day: true,
              coordinates: true
            }
          },
          gps: { tracking_enabled: true, tracking_interval_sec: 300 },
          photo: {
            required_for_order: true,
            jpeg_quality: 92,
            max_width_px: 4032,
            max_height_px: 4032
          },
          misc: { visit_start_end_enabled: true },
          product_list: { show_out_of_stock: true },
          orders: { bonus_fill_mode: "auto_fill_remaining" }
        }
      }
    }
  });

  const productDefs = [
    { sku: "SKU-001", name: "Mahsulot 1", unit: "quti", categoryId: catDrinks.id },
    { sku: "SKU-002", name: "Mahsulot 2", unit: "quti", categoryId: catDrinks.id },
    { sku: "SKU-003", name: "Mahsulot 3", unit: "dona", categoryId: catFood.id },
    { sku: "SKU-004", name: "Mahsulot 4", unit: "litr", categoryId: catFood.id },
    { sku: "SKU-005", name: "Mahsulot 5", unit: "kg", categoryId: catFood.id }
  ];

  for (const p of productDefs) {
    await prisma.product.upsert({
      where: { tenant_id_sku: { tenant_id: test1.id, sku: p.sku } },
      update: { name: p.name, unit: p.unit, category_id: p.categoryId },
      create: {
        tenant_id: test1.id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        category_id: p.categoryId,
        is_active: true
      }
    });
  }

  const products = await prisma.product.findMany({
    where: { tenant_id: test1.id },
    orderBy: { sku: "asc" }
  });

  for (const product of products) {
    await prisma.stock.upsert({
      where: {
        tenant_id_warehouse_id_product_id: {
          tenant_id: test1.id,
          warehouse_id: whMain.id,
          product_id: product.id
        }
      },
      update: { qty: 100, reserved_qty: 0 },
      create: {
        tenant_id: test1.id,
        warehouse_id: whMain.id,
        product_id: product.id,
        qty: 100,
        reserved_qty: 0
      }
    });
  }

  const retailBySku: Record<string, number> = {
    "SKU-001": 25000,
    "SKU-002": 60000,
    "SKU-003": 15000,
    "SKU-004": 8000,
    "SKU-005": 45000
  };
  for (const product of products) {
    const retail = retailBySku[product.sku] ?? 10000;
    const wholesale = Math.round(retail * 0.88 * 100) / 100;
    for (const [priceType, amount] of [
      ["retail", retail],
      ["wholesale", wholesale]
    ] as const) {
      await prisma.productPrice.upsert({
        where: {
          tenant_id_product_id_price_type: {
            tenant_id: test1.id,
            product_id: product.id,
            price_type: priceType
          }
        },
        create: {
          tenant_id: test1.id,
          product_id: product.id,
          price_type: priceType,
          price: new Prisma.Decimal(amount)
        },
        update: { price: new Prisma.Decimal(amount) }
      });
    }
  }

  await ensureDefaultInterchangeableGroup(
    test1.id,
    products.map((p) => p.id)
  );

  await ensureClient(test1.id, "Asosiy mijoz (seed)", "+998901000001", {
    category: "retail",
    address: "Toshkent",
    /** 0 = zakazda kredit tekshiruvi o‘chiq; >0 bo‘lsa ochiq zakazlar + yangi summa limitdan oshmasin */
    credit_limit: new Prisma.Decimal(0)
  });
  await prisma.client.updateMany({
    where: { tenant_id: test1.id, name: "Asosiy mijoz (seed)" },
    data: { credit_limit: new Prisma.Decimal(0) }
  });
  await ensureClient(test1.id, "Optom mijoz (seed)", "+998901000002", {
    category: "wholesale",
    credit_limit: new Prisma.Decimal("20000000")
  });
  await prisma.client.updateMany({
    where: {
      tenant_id: test1.id,
      name: { in: ["Asosiy mijoz (seed)", "Optom mijoz (seed)"] }
    },
    data: { agent_id: seedAgent.id }
  });

  const dupPhone = "+998901112233";
  const dupNorm = dupPhone.replace(/\D/g, "");
  for (const name of ["Mijoz A (dublikat)", "Mijoz B (dublikat)"]) {
    const ex = await prisma.client.findFirst({
      where: { tenant_id: test1.id, name }
    });
    if (!ex) {
      const c = await prisma.client.create({
        data: {
          tenant_id: test1.id,
          name,
          phone: dupPhone,
          category: "retail"
        }
      });
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "clients" SET "phone_normalized" = ${dupNorm} WHERE "id" = ${c.id}
      `);
    } else {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE "clients"
        SET "phone_normalized" = ${dupNorm}
        WHERE "id" = ${ex.id} AND ("phone_normalized" IS NULL OR "phone_normalized" = '')
      `);
    }
  }

  const existingBonus = await prisma.bonusRule.findFirst({
    where: { tenant_id: test1.id, name: "6+1 aksiya" }
  });
  if (!existingBonus) {
    await prisma.bonusRule.create({
      data: {
        tenant_id: test1.id,
        name: "6+1 aksiya",
        type: "qty",
        buy_qty: 6,
        free_qty: 1,
        in_blocks: true,
        priority: 10,
        is_active: true
      }
    });
  }
  await prisma.bonusRule.updateMany({
    where: { tenant_id: test1.id, name: "6+1 aksiya", type: "qty" },
    data: { in_blocks: true, buy_qty: 6, free_qty: 1 }
  });

  if (
    !(await prisma.bonusRule.findFirst({
      where: { tenant_id: test1.id, name: "[seed] Min summa 500 000" }
    }))
  ) {
    await prisma.bonusRule.create({
      data: {
        tenant_id: test1.id,
        name: "[seed] Min summa 500 000",
        type: "sum",
        min_sum: new Prisma.Decimal("500000"),
        priority: 8,
        is_active: true,
        client_category: null
      }
    });
  }

  if (
    !(await prisma.bonusRule.findFirst({
      where: { tenant_id: test1.id, name: "[seed] Chegirma 10%" }
    }))
  ) {
    await prisma.bonusRule.create({
      data: {
        tenant_id: test1.id,
        name: "[seed] Chegirma 10%",
        type: "discount",
        discount_pct: new Prisma.Decimal("10"),
        priority: 5,
        is_active: true
      }
    });
  }

  if (
    !(await prisma.bonusRule.findFirst({
      where: { tenant_id: test1.id, name: "[seed] Oraliq 10–30 dona (qadam + cheklov)" }
    }))
  ) {
    await prisma.bonusRule.create({
      data: {
        tenant_id: test1.id,
        name: "[seed] Oraliq 10–30 dona (qadam + cheklov)",
        type: "qty",
        priority: 7,
        is_active: true,
        in_blocks: true,
        conditions: {
          create: [
            {
              min_qty: new Prisma.Decimal(10),
              max_qty: new Prisma.Decimal(30),
              step_qty: new Prisma.Decimal(10),
              bonus_qty: new Prisma.Decimal(1),
              max_bonus_qty: new Prisma.Decimal(2),
              sort_order: 0
            }
          ]
        }
      }
    });
  }

  const p2ForDisc = await prisma.product.findFirst({
    where: { tenant_id: test1.id, sku: "SKU-002" }
  });
  const p3ForSum = await prisma.product.findFirst({
    where: { tenant_id: test1.id, sku: "SKU-003" }
  });
  if (p2ForDisc) {
    await prisma.bonusRule.updateMany({
      where: { tenant_id: test1.id, name: "[seed] Chegirma 10%" },
      data: { product_ids: [p2ForDisc.id] }
    });
  }
  if (p3ForSum) {
    await prisma.bonusRule.updateMany({
      where: { tenant_id: test1.id, name: "[seed] Min summa 500 000" },
      data: {
        discount_pct: new Prisma.Decimal("10"),
        bonus_product_ids: [],
        free_qty: null
      }
    });
  }

  const mainClient = await prisma.client.findFirst({
    where: { tenant_id: test1.id, name: "Asosiy mijoz (seed)" }
  });
  const p1 = await prisma.product.findFirst({
    where: { tenant_id: test1.id, sku: "SKU-001" }
  });
  const p2 = await prisma.product.findFirst({
    where: { tenant_id: test1.id, sku: "SKU-002" }
  });

  if (mainClient && p1 && p2) {
    const ord = await prisma.order.findFirst({
      where: { tenant_id: test1.id, number: "ORD-SEED-001" }
    });
    if (!ord) {
      await prisma.order.create({
        data: {
          tenant_id: test1.id,
          number: "ORD-SEED-001",
          client_id: mainClient.id,
          warehouse_id: whMain.id,
          agent_id: seedAgent.id,
          status: "new",
          total_sum: new Prisma.Decimal("550000.00"),
          bonus_sum: new Prisma.Decimal("0"),
          items: {
            create: [
              {
                product_id: p1.id,
                qty: new Prisma.Decimal(10),
                price: new Prisma.Decimal("25000"),
                total: new Prisma.Decimal("250000"),
                is_bonus: false
              },
              {
                product_id: p2.id,
                qty: new Prisma.Decimal(5),
                price: new Prisma.Decimal("60000"),
                total: new Prisma.Decimal("300000"),
                is_bonus: false
              }
            ]
          }
        }
      });
    }
  }

  await seedTest1ClientRefusals(test1.id, seedAgent.id);

  await seedMobileRolePermissions(test1.id);
  await seedMobileRolePermissions(demo.id);
}
