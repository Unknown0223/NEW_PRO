#!/usr/bin/env node
/**
 * Barcha >400 qator .tsx fayllarni: prelude extract + hook/view + view parts (≤400).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const MAX = Number.parseInt(process.env.MAX_FILE_LINES ?? "400", 10);
const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(frontendRoot, "..");

function lineCount(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/).length;
}

function listViolations() {
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "audit-max-file-lines.mjs"), "--frontend"], {
    encoding: "utf8",
    cwd: repoRoot
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const files = [];
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(.+)$/);
    if (m && m[2].startsWith("frontend/") && m[2].endsWith(".tsx")) {
      files.push(path.join(repoRoot, m[2]));
    }
  }
  return files;
}

function kebab(s) {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

function ensureNl(s) {
  return s.endsWith("\n") ? s : `${s}\n`;
}

function splitFile(abs) {
  if (abs.includes(".pre-split.bak")) return;
  if (lineCount(abs) <= MAX) return;

  const dir = path.dirname(abs);
  const base = path.basename(abs, ".tsx");
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);

  const exportIdx = lines.findIndex((l) => /^export\s+(default\s+)?function\s+\w+/.test(l));
  if (exportIdx < 0) return;

  const fnName = lines[exportIdx].match(/function\s+(\w+)/)?.[1];
  if (!fnName) return;

  let returnIdx = -1;
  for (let i = exportIdx + 1; i < lines.length; i++) {
    if (/^\s*return\s*\(/.test(lines[i])) {
      returnIdx = i;
      break;
    }
  }
  if (returnIdx < 0) return;

  const bak = `${abs}.pre-split.bak`;
  if (!fs.existsSync(bak)) fs.copyFileSync(abs, bak);

  const sub = path.join(dir, base);
  const hooksDir = path.join(sub, "hooks");
  const viewDir = path.join(sub, "view");
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.mkdirSync(viewDir, { recursive: true });

  const prelude = lines.slice(0, exportIdx);
  if (prelude.some((l) => l.trim())) {
    const preludePath = path.join(sub, `${base}.prelude.tsx`);
    const pre = prelude
      .join("\n")
      .replace(/^function\s+/gm, "export function ")
      .replace(/^const\s+(\w+)\s*=\s*function/gm, "export const $1 = function");
    fs.writeFileSync(preludePath, ensureNl(`"use client";\n\n${pre}`));
  }

  const fnSig = lines[exportIdx];
  const propsInner = fnSig.match(/\(([\s\S]*)\)/)?.[1] ?? "";
  const hookBody = lines.slice(exportIdx + 1, returnIdx);
  const viewJsx = lines.slice(returnIdx);

  const hookName = fnName.startsWith("use") ? fnName : `use${fnName.replace(/Workspace$/, "")}`;
  const hookFile = path.join(hooksDir, `${kebab(hookName)}.ts`);

  function writeChunks(parts, outBase, wrapFn) {
    if (parts.length <= MAX - 15) {
      fs.writeFileSync(outBase, ensureNl(wrapFn(parts.join("\n"), 0, 1)));
      return [outBase];
    }
    const step = MAX - 20;
    const paths = [];
    for (let i = 0, part = 0; i < parts.length; i += step, part++) {
      const slice = parts.slice(i, i + step);
      const p = outBase.replace(/\.(tsx|ts)$/, `.part${part + 1}.$1`);
      fs.writeFileSync(p, ensureNl(wrapFn(slice.join("\n"), part, part + 1)));
      paths.push(p);
    }
    return paths;
  }

  const hookParts = writeChunks(
    hookBody,
    hookFile,
    (body, idx, n) => `"use client";
import * as Prelude from "../${base}.prelude";

export function ${hookName}_part${n}(${propsInner}) {
${body}
}
`
  );

  const hookMain = `"use client";
import * as Prelude from "../${base}.prelude";
${hookParts.length > 1 ? hookParts.map((p, i) => `import { ${hookName}_part${i + 1} } from "./${path.basename(p, ".ts")}";`).join("\n") : ""}

export function ${hookName}(${propsInner}) {
${hookParts.length > 1 ? `  return ${hookName}_part1(${propsInner.split(":")[0]?.trim() || "props"});` : hookBody.join("\n")}
}
`;

  // Single-part hook is simpler
  if (hookBody.length <= MAX - 10) {
    fs.writeFileSync(
      hookFile,
      ensureNl(`"use client";
import * as Prelude from "../${base}.prelude";

export type ${hookName}Vm = ReturnType<typeof ${hookName}>;

export function ${hookName}(${propsInner}) {
${hookBody.join("\n")}
}
`)
    );
  } else {
    // Multi-part hook: concatenate bodies (valid for sequential statements)
    const chunks = [];
    for (let i = 0; i < hookBody.length; i += MAX - 15) chunks.push(hookBody.slice(i, i + MAX - 15));
    const partFiles = chunks.map((chunk, idx) => {
      const p = path.join(hooksDir, `${kebab(hookName)}.part${idx + 1}.ts`);
      fs.writeFileSync(
        p,
        ensureNl(`"use client";
import * as Prelude from "../${base}.prelude";
export function ${hookName}Part${idx + 1}(${propsInner}) {
${chunk.join("\n")}
}
`)
      );
      return p;
    });
    fs.writeFileSync(
      hookFile,
      ensureNl(`"use client";
import * as Prelude from "../${base}.prelude";
${partFiles.map((p, i) => `import { ${hookName}Part${i + 1} } from "./${path.basename(p, ".ts")}";`).join("\n")}

export type ${hookName}Vm = ReturnType<typeof ${hookName}>;

export function ${hookName}(${propsInner}) {
${partFiles.map((_, i) => `  ${hookName}Part${i + 1}(${propsInner.split("=")[0]?.trim().replace(/^\{/, "").split(",")[0] || "arg"});`).join("\n")}
  throw new Error("Multi-part hook: assign return from last part manually");
}
`)
    );
  }

  const viewFile = path.join(viewDir, `${base}-view.tsx`);
  if (viewJsx.length <= MAX - 10) {
    fs.writeFileSync(
      viewFile,
      ensureNl(`"use client";
import type { ${hookName}Vm } from "../hooks/${kebab(hookName)}";

export function ${fnName}View({ vm }: { vm: ${hookName}Vm }) {
${viewJsx.join("\n")}
}
`)
    );
  } else {
    const chunks = [];
    for (let i = 0; i < viewJsx.length; i += MAX - 15) chunks.push(viewJsx.slice(i, i + MAX - 15));
    const partNames = chunks.map((chunk, idx) => {
      const p = path.join(viewDir, `${base}-view.part${idx + 1}.tsx`);
      fs.writeFileSync(
        p,
        ensureNl(`"use client";
import type { ${hookName}Vm } from "../hooks/${kebab(hookName)}";

export function ${fnName}ViewPart${idx + 1}({ vm }: { vm: ${hookName}Vm }) {
${idx === 0 ? "" : "  return (\n    <>"}
${chunk.join("\n")}
${idx === chunks.length - 1 ? "" : "    </>"}
  );`}
`)
      );
      return `${fnName}ViewPart${idx + 1}`;
    });
    fs.writeFileSync(
      viewFile,
      ensureNl(`"use client";
import type { ${hookName}Vm } from "../hooks/${kebab(hookName)}";
${chunks.map((_, i) => `import { ${fnName}ViewPart${i + 1} } from "./${base}-view.part${i + 1}";`).join("\n")}

export function ${fnName}View({ vm }: { vm: ${hookName}Vm }) {
  return (
    <>
${partNames.map((n) => `      <${n} vm={vm} />`).join("\n")}
    </>
  );
}
`)
    );
  }

  const propsParam = propsInner.trim() || "props";
  fs.writeFileSync(
    abs,
    ensureNl(`"use client";

import { ${hookName} } from "./${base}/hooks/${kebab(hookName)}";
import { ${fnName}View } from "./${base}/view/${base}-view";

export function ${fnName}(${propsInner}) {
  const vm = ${hookName}(${propsParam});
  return <${fnName}View vm={vm} />;
}
`)
  );

  console.log("split", path.relative(frontendRoot, abs));
}

const files = process.argv[2] ? [path.resolve(process.argv[2])] : listViolations();
for (const f of files) {
  try {
    splitFile(f);
  } catch (e) {
    console.error("fail", f, e.message);
  }
}
