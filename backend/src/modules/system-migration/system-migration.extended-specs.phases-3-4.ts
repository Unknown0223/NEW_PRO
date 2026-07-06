import type { ExtendedTableSpec } from "./system-migration.extended-specs.types";

/** Bog‘lanishlar, moliya va qo‘shimcha tarix (import bosqichlari 3–4). */
export const EXTENDED_IMPORT_PHASES_3_4: ExtendedTableSpec[][] = [
  [
    {
      file: "territory_user_links",
      delegate: "territoryUserLink",
      idMap: "territoryUserLink",
      hasTenantId: false,
      scope: "territory",
      fk: { territory_id: "territory", user_id: "user", assigned_by: "user" },
      dates: ["assigned_at"]
    },
    {
      file: "slot_user_links",
      delegate: "slotUserLink",
      idMap: "slotUserLink",
      fk: { slot_id: "workSlot", user_id: "user", ended_by: "user" },
      dates: ["started_at", "ended_at", "created_at"]
    },
    {
      file: "slot_audit_entries",
      delegate: "slotAuditEntry",
      idMap: "slotAuditEntry",
      fk: { slot_id: "workSlot", prev_user_id: "user", next_user_id: "user", actor_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "cash_desk_user_links",
      delegate: "cashDeskUserLink",
      idMap: "cashDeskUserLink",
      hasTenantId: false,
      scope: "cash_desk",
      fk: { cash_desk_id: "cashDesk", user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "cash_desk_shifts",
      delegate: "cashDeskShift",
      idMap: "cashDeskShift",
      fk: { cash_desk_id: "cashDesk", opened_by_user_id: "user", closed_by_user_id: "user" },
      decimals: ["opening_float", "closing_float"],
      dates: ["opened_at", "closed_at"]
    },
    {
      file: "warehouse_user_links",
      delegate: "warehouseUserLink",
      idMap: "warehouseUserLink",
      hasTenantId: false,
      scope: "warehouse",
      fk: { warehouse_id: "warehouse", user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "warehouse_blocks",
      delegate: "warehouseBlock",
      idMap: "warehouseBlock",
      fk: { warehouse_id: "warehouse", gruzchik_user_id: "user" },
      dates: ["empty_stock_confirmed_at", "created_at", "updated_at"]
    },
    {
      file: "warehouse_block_expeditors",
      delegate: "warehouseBlockExpeditor",
      noId: true,
      hasTenantId: false,
      scope: "block",
      fk: { block_id: "warehouseBlock", user_id: "user" }
    },
    {
      file: "role_permissions",
      delegate: "rolePermission",
      noId: true,
      hasTenantId: false,
      scope: "role",
      fk: { role_id: "role", permission_id: "permission" },
      dates: ["created_at"]
    },
    {
      file: "user_roles",
      delegate: "userRole",
      noId: true,
      hasTenantId: false,
      scope: "user",
      fk: { user_id: "user", role_id: "role" },
      dates: ["assigned_at"]
    },
    {
      file: "user_permissions",
      delegate: "userPermission",
      noId: true,
      hasTenantId: false,
      scope: "user",
      fk: { user_id: "user", permission_id: "permission" },
      dates: ["assigned_at"]
    },
    {
      file: "user_branch_links",
      delegate: "userBranchLink",
      idMap: "userBranchLink",
      fk: { user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "user_payment_method_links",
      delegate: "userPaymentMethodLink",
      idMap: "userPaymentMethodLink",
      fk: { user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "user_trade_direction_links",
      delegate: "userTradeDirectionLink",
      idMap: "userTradeDirectionLink",
      fk: { user_id: "user", trade_direction_id: "tradeDirection" },
      dates: ["created_at"]
    },
    {
      file: "client_agent_assignments",
      delegate: "clientAgentAssignment",
      idMap: "clientAgentAssignment",
      fk: {
        client_id: "client",
        agent_id: "user",
        expeditor_user_id: "user",
        work_slot_id: "workSlot",
        lock_set_by: "user"
      },
      dates: ["visit_date", "created_at", "updated_at"]
    },
    {
      file: "client_balances",
      delegate: "clientBalance",
      idMap: "clientBalance",
      fk: { client_id: "client" },
      decimals: ["balance"],
      dates: ["updated_at"]
    }
  ],
  [
    {
      file: "supplier_payments",
      delegate: "supplierPayment",
      idMap: "supplierPayment",
      fk: {
        supplier_id: "supplier",
        created_by_user_id: "user",
        cash_desk_id: "cashDesk",
        reversed_by_user_id: "user"
      },
      decimals: ["amount"],
      dates: ["paid_at", "reversed_at", "created_at", "updated_at"]
    },
    {
      file: "warehouse_corrections",
      delegate: "warehouseCorrection",
      idMap: "warehouseCorrection",
      fk: { warehouse_id: "warehouse", created_by_user_id: "user" },
      decimals: ["total_qty_delta", "total_volume_m3", "total_amount"],
      dates: ["occurred_at", "created_at"]
    },
    {
      file: "warehouse_correction_lines",
      delegate: "warehouseCorrectionLine",
      idMap: "warehouseCorrectionLine",
      hasTenantId: false,
      scope: "correction",
      fk: { document_id: "warehouseCorrection", product_id: "product" },
      decimals: ["qty_before", "qty_delta", "price_unit", "line_amount", "volume_m3"]
    },
    {
      file: "stock_takes",
      delegate: "stockTake",
      idMap: "stockTake",
      fk: { warehouse_id: "warehouse", created_by_user_id: "user" },
      dates: ["posted_at", "created_at", "updated_at"]
    },
    {
      file: "stock_take_lines",
      delegate: "stockTakeLine",
      idMap: "stockTakeLine",
      hasTenantId: false,
      scope: "stock_take",
      fk: { stock_take_id: "stockTake", product_id: "product" },
      decimals: ["system_qty", "counted_qty"]
    },
    {
      file: "client_balance_movements",
      delegate: "clientBalanceMovement",
      idMap: "clientBalanceMovement",
      hasTenantId: false,
      scope: "client_balance",
      fk: { client_balance_id: "clientBalance", user_id: "user" },
      decimals: ["delta"],
      dates: ["created_at"]
    },
    {
      file: "client_opening_balance_entries",
      delegate: "clientOpeningBalanceEntry",
      idMap: "clientOpeningBalanceEntry",
      fk: {
        client_id: "client",
        cash_desk_id: "cashDesk",
        created_by_user_id: "user",
        deleted_by_user_id: "user"
      },
      decimals: ["amount"],
      dates: ["paid_at", "created_at", "deleted_at"]
    },
    {
      file: "payment_edit_grants",
      delegate: "paymentEditGrant",
      idMap: "paymentEditGrant",
      fk: { payment_id: "payment", access_user_id: "user", created_by_user_id: "user" },
      dates: ["expires_at", "completed_at", "created_at"]
    },
    {
      file: "order_auto_confirm_schedules",
      delegate: "orderAutoConfirmSchedule",
      idMap: "orderAutoConfirmSchedule",
      fk: { order_id: "order", rule_id: "orderAutoConfirmRule" },
      dates: ["run_at", "created_at", "updated_at"]
    },
    {
      file: "retail_outlet_stocks",
      delegate: "retailOutletStock",
      idMap: "retailOutletStock",
      fk: { client_id: "client", product_id: "product", agent_id: "user" },
      decimals: ["quantity", "sold_quantity", "amount"],
      dates: ["stock_date", "created_at", "updated_at"]
    },
    {
      file: "client_equipment",
      delegate: "clientEquipment",
      idMap: "clientEquipment",
      fk: { client_id: "client" },
      dates: ["assigned_at", "removed_at", "created_at", "updated_at"]
    },
    {
      file: "client_qr_codes",
      delegate: "clientQrCode",
      idMap: "clientQrCode",
      fk: {
        client_id: "client",
        created_by_user_id: "user",
        printed_by_user_id: "user",
        bound_by_user_id: "user",
        detached_by_user_id: "user"
      },
      dates: ["created_at", "updated_at", "printed_at", "bound_at", "detached_at"]
    },
    {
      file: "client_merge_logs",
      delegate: "clientMergeLog",
      idMap: "clientMergeLog",
      fk: { master_client_id: "client", merged_client_id: "client", merged_by_user_id: "user" },
      dates: ["merged_at"]
    },
    {
      file: "client_saved_duplicate_groups",
      delegate: "clientSavedDuplicateGroup",
      idMap: "clientSavedDuplicateGroup",
      fk: { master_client_id: "client", created_by_user_id: "user" },
      intArrayFk: { client_ids: "client" },
      dates: ["created_at"]
    },
    {
      file: "agent_consignment_month_status",
      delegate: "agentConsignmentMonthStatus",
      idMap: "agentConsignmentMonthStatus",
      fk: { agent_user_id: "user" },
      dates: ["period_closed_at", "debt_cleared_at", "created_at", "updated_at"]
    },
    {
      file: "agent_route_days",
      delegate: "agentRouteDay",
      idMap: "agentRouteDay",
      fk: { agent_id: "user" },
      dates: ["route_date", "created_at", "updated_at"]
    },
    {
      file: "tenant_tasks",
      delegate: "tenantTask",
      idMap: "tenantTask",
      fk: { assignee_user_id: "user", created_by_user_id: "user" },
      dates: ["due_at", "created_at", "updated_at"]
    },
    {
      file: "in_app_notifications",
      delegate: "inAppNotification",
      idMap: "inAppNotification",
      fk: { user_id: "user" },
      dates: ["read_at", "created_at"]
    },
    {
      file: "user_activity_events",
      delegate: "userActivityEvent",
      idMap: "userActivityEvent",
      fk: { actor_user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "access_logs",
      delegate: "accessLog",
      idMap: "accessLog",
      fk: { actor_user_id: "user", target_user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "stock_uploads",
      delegate: "stockUpload",
      idMap: "stockUpload",
      fk: { uploaded_by_user_id: "user" },
      dates: ["created_at"]
    },
    {
      file: "report_builder_saved_configs",
      delegate: "reportBuilderSavedConfig",
      idMap: "reportBuilderSavedConfig",
      fk: { user_id: "user" },
      dates: ["created_at", "updated_at"]
    }
  ]
];
