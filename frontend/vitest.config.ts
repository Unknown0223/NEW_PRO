import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    passWithNoTests: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/activity-path-map.ts",
        "lib/client-filter-select-value.ts",
        "lib/dashboard-supervisor-query.ts",
        "lib/error-utils.ts",
        "lib/geo-polygon.ts",
        "lib/history-labels.ts",
        "lib/loader-prefs.ts",
        "lib/price-matrix-percent.ts",
        "lib/report-builder-wdr-migrate.ts",
        "lib/return-filter-messages.ts",
        "lib/return-filter-settings-preview.ts",
        "lib/return-filter-settings.ts",
        "lib/routes.ts",
        "lib/utils.ts",
        "lib/uz-admin-regions.ts",
        "components/bonus-rules/rule-summary.ts",
        "components/orders/exchange-order-create-panel.tsx",
        "components/orders/order-create-agent-lock-hint.tsx",
        "components/orders/order-create/utils.ts",
        "components/orders/order-history/order-history-status-badge.tsx",
        "components/plans/approver-state.ts",
        "components/plans/approver-used-options.ts",
        "components/ui/button.tsx",
        "components/ui/empty-state.tsx",
        "components/ui/page-error.tsx",
        "components/work-slots/work-slots-utils.ts"
      ],
      exclude: [
        "node_modules/**",
        ".next/**",
        "e2e/**",
        "**/*.config.*",
        "**/*.setup.*",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}"
      ],
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 55,
        statements: 65
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@shared": path.resolve(__dirname, "../shared")
    }
  }
});
