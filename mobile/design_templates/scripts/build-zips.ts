import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FLUTTER_FILES, PATCHES, PACKAGE_VERSION, MIGRATION_MAP, STACK_FILES, STACK_EXTRA, STACK_TESTS, STACK_API, STACK_VERSION, handoffReadme } from "../src/data/flutter";
import { screens, templates } from "../src/data/design";
import { buildZipBytes, textFile } from "../src/utils/zip";

const out = join(process.cwd(), "public", "downloads");
mkdirSync(out, { recursive: true });

/* ---------- design-system only ---------- */
const ds = buildZipBytes(FLUTTER_FILES.map((f) => textFile(f.path.replace(/^mobile\//, ""), f.code)));
writeFileSync(join(out, `sales-arena-design-system-v${PACKAGE_VERSION}.zip`), ds);

/* ---------- handoff ---------- */
const tokens = {
  version: PACKAGE_VERSION,
  colors: {
    brand: { navy: "#14223F", blue: "#1F66D1", bright: "#6FA8FF" },
    roles: { agent: "#1F66D1", expeditor: "#0E8A4F", supervisor: "#1FA855", cashier: "#0F766E" },
    surface: { light: "#F7F9FA", dark: "#0B1226" },
  },
  radius: { chip: 8, control: 12, card: 16, sheet: 20, panel: 28 },
  motion: { fast: 120, base: 240, emphatic: 420, standardCurve: [0.16, 1, 0.3, 1] },
};
const handoff = [
  ...FLUTTER_FILES.map((f) => textFile(f.path.replace(/^mobile\//, ""), f.code)),
  textFile("README.md", handoffReadme()),
  textFile("docs/tokens.json", JSON.stringify(tokens, null, 2)),
  textFile("docs/screens.json", JSON.stringify(screens.map((s) => ({ key: s.key, label: s.label, group: s.group, role: s.role, tags: s.tags })), null, 2)),
  textFile("docs/templates.json", JSON.stringify(templates.map((t) => ({ no: t.no, title: t.title, screen: t.screen ?? null })), null, 2)),
  textFile("docs/migration-map.json", JSON.stringify(MIGRATION_MAP, null, 2)),
  ...PATCHES.map((p, i) => textFile(`docs/patches/${String(i + 1).padStart(2, "0")}.md`, `# ${p.title}\n\nFayl: ${p.target}\nAmal: ${p.action}\n\n${p.desc}\n\n\`\`\`${p.lang}\n${p.code}\n\`\`\`\n`)),
];
const hb = buildZipBytes(handoff);
writeFileSync(join(out, `sales-arena-handoff-v${PACKAGE_VERSION}.zip`), hb);

/* ---------- full stack ---------- */
const all = [...STACK_FILES, ...STACK_EXTRA, ...STACK_TESTS];
const stack = [
  ...all.map((f) => textFile(f.path, f.code)),
  textFile("docs/api.json", JSON.stringify(STACK_API, null, 2)),
  textFile("docs/screens.json", JSON.stringify(screens.map((s) => ({ key: s.key, label: s.label, role: s.role })), null, 2)),
  textFile("README.md", `# Sales Arena — Full Stack v${STACK_VERSION}\n\nBackend (Fastify + Prisma + SQLite) va Flutter klient qatlami.\n\n## Ishga tushirish\n\n    cd backend\n    cp .env.example .env\n    npm install\n    npm run setup\n    npm run dev\n\nDemo: aziz.qodirov / Arena#2026 · PIN 1234\n\nBatafsil: backend/README.md, docs/api.json\n`),
];
const sb = buildZipBytes(stack);
writeFileSync(join(out, `sales-arena-fullstack-v${STACK_VERSION}.zip`), sb);

console.log("design-system", ds.length, "| handoff", hb.length, "| fullstack", sb.length);
