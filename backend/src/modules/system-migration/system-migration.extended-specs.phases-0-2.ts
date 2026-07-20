import type { ExtendedTableSpec } from "./system-migration.extended-specs.types";

/** Katalog, spravochniklar, narxlar (import bosqichlari 0–2). */
export const EXTENDED_IMPORT_PHASES_0_2: ExtendedTableSpec[][] = [
  [
    {
      file: "product_categories",
      delegate: "productCategory",
      idMap: "productCategory",
      fk: { parent_id: "productCategory" },
      dates: ["created_at", "updated_at"]
    },
    {
      file: "product_brands",
      delegate: "productBrand",
      idMap: "productBrand",
      dates: ["created_at", "updated_at"]
    },
    {
      file: "product_manufacturers",
      delegate: "productManufacturer",
      idMap: "productManufacturer",
      dates: ["created_at", "updated_at"]
    },
    {
      file: "product_segments",
      delegate: "productSegment",
      idMap: "productSegment",
      dates: ["created_at", "updated_at"]
    },
    {
      file: "product_catalog_groups",
      delegate: "productCatalogGroup",
      idMap: "productCatalogGroup",
      dates: ["created_at", "updated_at"]
    },
    {
      file: "interchangeable_product_groups",
      delegate: "interchangeableProductGroup",
      idMap: "interchangeableGroup",
      dates: ["created_at", "updated_at"]
    }
  ],
  [
    {
      file: "suppliers",
      delegate: "supplier",
      idMap: "supplier",
      naturalKey: ["code"],
      dates: ["created_at", "updated_at"]
    },
    {
      file: "territories",
      delegate: "territory",
      idMap: "territory",
      naturalKey: ["code"],
      fk: { deleted_by_user_id: "user" },
      dates: ["created_at", "updated_at", "deleted_at"]
    },
    {
      file: "work_slots",
      delegate: "workSlot",
      idMap: "workSlot",
      naturalKey: ["slot_code"],
      fk: { direction_id: "tradeDirection" },
      dates: ["created_at", "updated_at"]
    },
    {
      file: "roles",
      delegate: "role",
      idMap: "role",
      naturalKey: ["key"],
      dates: ["created_at", "updated_at"]
    },
    {
      file: "permissions",
      delegate: "permission",
      idMap: "permission",
      naturalKey: ["key"],
      dates: ["created_at", "updated_at"]
    },
    {
      file: "currency_exchange_rates",
      delegate: "currencyExchangeRate",
      idMap: "currencyExchangeRate",
      fk: { created_by_user_id: "user" },
      decimals: ["rate"],
      dates: ["rate_date", "created_at", "updated_at"]
    },
    {
      file: "order_restriction_rules",
      delegate: "orderRestrictionRule",
      idMap: "orderRestrictionRule",
      fk: { created_by_user_id: "user", updated_by_user_id: "user" },
      intArrayFk: { scope_agent_user_ids: "user", scope_warehouse_ids: "warehouse" },
      decimals: ["amount_from", "amount_to"],
      dates: ["created_at", "updated_at"]
    },
    {
      file: "order_auto_confirm_rules",
      delegate: "orderAutoConfirmRule",
      idMap: "orderAutoConfirmRule",
      fk: { created_by_user_id: "user", updated_by_user_id: "user" },
      intArrayFk: { scope_agent_user_ids: "user", scope_warehouse_ids: "warehouse" },
      decimals: ["amount_from", "amount_to"],
      dates: ["execution_time", "created_at", "updated_at"]
    }
  ],
  [
    {
      file: "product_prices",
      delegate: "productPrice",
      idMap: "productPrice",
      naturalKey: ["product_id", "price_type"],
      fk: { product_id: "product" },
      requiredFk: ["product_id"],
      decimals: ["price"],
      dates: ["created_at", "updated_at"]
    },
    {
      file: "product_price_schedules",
      delegate: "productPriceSchedule",
      idMap: "productPriceSchedule",
      fk: { product_id: "product", created_by: "user" },
      requiredFk: ["product_id"],
      decimals: ["price"],
      dates: ["effective_at", "applied_at", "created_at", "updated_at"]
    },
    {
      file: "interchangeable_group_products",
      delegate: "interchangeableGroupProduct",
      noId: true,
      hasTenantId: false,
      scope: "group",
      fk: { group_id: "interchangeableGroup", product_id: "product" },
      requiredFk: ["group_id", "product_id"]
    },
    {
      file: "interchangeable_group_price_types",
      delegate: "interchangeableGroupPriceType",
      noId: true,
      hasTenantId: false,
      scope: "group",
      fk: { group_id: "interchangeableGroup" }
    }
  ]
];
