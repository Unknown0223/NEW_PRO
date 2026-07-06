#!/usr/bin/env tsx
/**
 * Production deploy oldidan tekshiruv ro‘yxati (avtomatik emas — operator uchun).
 */
const checklist = [
  "1. DB: npm run db:deploy",
  "2. RBAC: npm run rbac:migrate-crud -- --all (har tenant)",
  "3. Work slots: npm run backfill:work-slots -- --all (prod bir marta)",
  "4. .env: RBAC_ENFORCE_PERMISSIONS=1 (staging/prod, migratsiyadan keyin)",
  "5. Smoke: npm run prod:verify (root)",
  "6. Grafana dashboard import (docs/grafana/IMPORT.md)"
];

console.log("=== SALEC prod deploy checklist ===\n");
for (const line of checklist) console.log(line);
console.log("\nBatafsil: docs/PROD_DEPLOY_YAKUNLANDI.md");
