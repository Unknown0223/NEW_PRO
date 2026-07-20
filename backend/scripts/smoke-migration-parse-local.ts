/** Local parseBackupZip — server restart shartsiz. */
import { buildTenantBackupZip } from "../src/modules/system-migration/system-migration.export";
import { parseBackupZip } from "../src/modules/system-migration/system-migration.import";

async function main() {
  const buf = await buildTenantBackupZip({ tenantId: 1, tenantSlug: "test1" });
  console.log("export bytes", buf.length);
  const preview = await parseBackupZip(buf, 1);
  console.log("valid", preview.valid, "errors", preview.errors);
  console.log(
    "modules",
    preview.modules.map((m) => `${m.id}:${m.label_uz?.slice(0, 40)}`)
  );
  console.log("has_initial_setup_xlsx", preview.has_initial_setup_xlsx);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
