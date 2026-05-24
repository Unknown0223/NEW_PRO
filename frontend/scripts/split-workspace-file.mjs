#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAX = 400;
const CHUNK = 280;
const frontendRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(frontendRoot, "..");

function ensureNl(s) {
  return s.endsWith("\n") ? s : `${s}\n`;
}
function lineCount(p) {
  return fs.readFileSync(p, "utf8").split(/\r?\n/).length;
}
function kebab(s) {
  return s.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}
function extractImportBlock(lines, endIdx) {
  const out = [];
  let i = 0;
  if (lines[0]?.includes("use client")) {
    out.push(lines[0]);
    i = 1;
  }
  while (i < endIdx) {
    if (lines[i].startsWith("import ")) {
      let block = lines[i];
      i++;
      while (i < endIdx && !block.trimEnd().endsWith(";")) {
        block += `\n${lines[i]}`;
        i++;
      }
      out.push(block);
    } else if (lines[i].trim() === "") i++;
    else break;
  }
  return out.join("\n");
}

function splitAtBlank(lines, maxSize) {
  const chunks = [];
  let start = 0;
  while (start < lines.length) {
    if (lines.length - start <= maxSize) {
      chunks.push(lines.slice(start));
      break;
    }
    let end = Math.min(start + maxSize, lines.length);
    while (end > start + 40 && lines[end]?.trim() !== "") end--;
    if (end <= start + 40) end = start + maxSize;
    chunks.push(lines.slice(start, end));
    start = end;
  }
  return chunks;
}

function collectDefinedNames(hookLines) {
  const names = new Set();
  for (const l of hookLines) {
    let m = l.match(/^\s*const\s+(\w+)\s*=/);
    if (m) names.add(m[1]);
    m = l.match(/^\s*const\s+\[([^\]]+)\]/);
    if (m) {
      for (const part of m[1].split(",")) {
        const n = part.trim().split(":")[0]?.trim();
        if (n && /^\w+$/.test(n)) names.add(n);
      }
    }
    m = l.match(/^\s*function\s+(\w+)\s*\(/);
    if (m) names.add(m[1]);
  }
  return [...names];
}

function buildReturnBlock(keys) {
  return [`  return {`, ...keys.map((k) => `    ${k},`), `  } as const;`];
}

function rewriteViewJsxToVmAccess(jsxLines, vmKeys) {
  const sorted = [...vmKeys].sort((a, b) => b.length - a.length);
  return jsxLines.map((line) => {
    let out = line;
    for (const k of sorted) {
      if (k.length < 2) continue;
      out = out.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), (m, off, s) => {
        const before = s.slice(Math.max(0, off - 4), off);
        if (before.endsWith("vm.")) return m;
        return `vm.${k}`;
      });
    }
    return out;
  });
}

function splitHookLayers(hookPath, hookName, propsInner, propsTypeDecl, vmType) {
  const lines = fs.readFileSync(hookPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${hookName}`));
  let returnIdx = -1;
  let closeIdx = -1;
  for (let i = lines.length - 1; i > fnIdx; i--) {
    if (closeIdx < 0 && /^\s*\}\s*as const;\s*$/.test(lines[i])) closeIdx = i;
    if (closeIdx >= 0 && /^\s*return\s*\{/.test(lines[i])) {
      returnIdx = i;
      break;
    }
  }
  const importBlock = extractImportBlock(lines, fnIdx);
  let body;
  let returnBlock;
  let footer = [];
  if (returnIdx >= 0 && closeIdx >= 0) {
    body = lines.slice(fnIdx + 1, returnIdx);
    returnBlock = lines.slice(returnIdx, closeIdx + 1);
    footer = lines.slice(closeIdx + 1);
  } else {
    body = lines.slice(fnIdx + 1);
    const keys = collectDefinedNames(body);
    returnBlock = buildReturnBlock(keys);
  }

  const chunks = splitAtBlank(body, CHUNK);
  const hooksDir = path.dirname(hookPath);
  const priorDefined = new Set();
  const layerNames = [];
  const hasProps = propsInner.trim().length > 0;

  for (let i = 0; i < chunks.length; i++) {
    const partName = `${hookName}Part${i + 1}`;
    layerNames.push(partName);
    const bodyText = chunks[i].join("\n");
    const defined = new Set();
    for (const l of chunks[i]) {
      const m = l.match(/^\s*const\s+(\w+)\s*=/);
      if (m) defined.add(m[1]);
    }
    const keys = [...priorDefined].filter((k) => new RegExp(`\\b${k}\\b`).test(bodyText));
    for (const d of defined) priorDefined.add(d);

    const propsParam =
      i === 0
        ? propsInner.trim() || ""
        : hasProps
          ? `${propsInner}, prev: ReturnType<typeof ${layerNames[i - 1]}>`
          : `prev: ReturnType<typeof ${layerNames[i - 1]}>`;
    const destructure =
      keys.length > 0
        ? `  const {\n${keys.map((k) => `    ${k},`).join("\n")}\n  } = ${i === 0 ? (hasProps ? "props" : "prev") : "prev"};\n\n`
        : "";

    const partImports =
      i === 0
        ? importBlock
        : `${importBlock}
import { ${layerNames[i - 1]} } from "./${kebab(hookName)}.part${i}";`;

    fs.writeFileSync(
      path.join(hooksDir, `${kebab(hookName)}.part${i + 1}.ts`),
      ensureNl(`${partImports}
${propsTypeDecl && i === 0 ? `import type { ${propsTypeDecl} }\n` : ""}
export function ${partName}(${propsParam}) {
${destructure}${bodyText}

  return {
${[...defined].map((k) => `    ${k},`).join("\n")}
  } as const;
}
`)
    );
    console.log(`  part${i + 1}`, lineCount(path.join(hooksDir, `${kebab(hookName)}.part${i + 1}.ts`)));
  }

  const call = hasProps ? (propsInner.includes(":") ? propsInner.split(":")[0].trim() : propsInner.trim()) : "";
  const compose = `"use client";

${importBlock}
${layerNames.map((n, i) => `import { ${n} } from "./${kebab(hookName)}.part${i + 1}";`).join("\n")}

export function ${hookName}(${propsInner}) {
${layerNames.map((n, i) => `  const l${i + 1} = ${n}(${i === 0 ? call || "" : call ? `${call}, l${i}` : `l${i}`});`).join("\n")}
  return { ${layerNames.map((_, i) => `...l${i + 1}`).join(", ")} } as const;
}

export type ${vmType} = ReturnType<typeof ${hookName}>;
`;

  fs.writeFileSync(hookPath, ensureNl(compose));
}

function splitViewBySlices(viewPath, viewFn, vmType, vmImportPath, headerImports, slices, vmKeys) {
  const lines = fs.readFileSync(viewPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${viewFn}`));
  const retIdx = lines.findIndex((l, i) => i > fnIdx && /^\s*return\s*\(/.test(l));
  const sectionsDir = path.join(path.dirname(viewPath), "sections");
  fs.mkdirSync(sectionsDir, { recursive: true });
  const base = kebab(viewFn.replace(/View$/, ""));
  const names = [];

  for (let i = 0; i < slices.length; i++) {
    const s = slices[i];
    const name = s.name;
    names.push(name);
    const body = lines.slice(retIdx + s.start, retIdx + s.end).join("\n");
    const used = vmKeys.filter((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(body));
    const destructure =
      used.length > 0
        ? `  const {\n${used.map((k) => `    ${k},`).join("\n")}\n  } = vm;\n\n`
        : "";
    const fp = path.join(sectionsDir, `${kebab(name)}.tsx`);
    const wrapped = body.trimStart().startsWith("return")
      ? body
      : `  return (\n    <>\n${body}\n    </>\n  );`;
    fs.writeFileSync(
      fp,
      ensureNl(`"use client";

${headerImports}
import type { ${vmType} } from "${vmImportPath}";

export function ${name}({ vm }: { vm: ${vmType} }) {
${destructure}${wrapped}
}
`)
    );
    console.log(`  view ${s.name}`, lineCount(fp));
  }

  fs.writeFileSync(
    viewPath,
    ensureNl(`"use client";

${headerImports}
import type { ${vmType} } from "${vmImportPath}";
${names.map((n) => `import { ${n} } from "./sections/${kebab(n)}";`).join("\n")}

export function ${viewFn}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${names.map((n) => `      <${n} vm={vm} />`).join("\n")}
    </>
  );
}
`)
  );
}

/** Split view JSX into ≤MAX chunks; each section is a valid fragment (no mid-tag cuts). */
function splitViewIntoLineSections(viewPath, viewFn, vmType, vmImportPath, headerImports, _vmKeysUnused) {
  const lines = fs.readFileSync(viewPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${viewFn}`));
  const retIdx = lines.findIndex((l, i) => i > fnIdx && /^\s*return\s*\(/.test(l));
  const closeIdx = lines.length - 1;
  while (closeIdx > retIdx && !/^\s*\);\s*$/.test(lines[closeIdx])) {
    /* find closing ); of return */
  }
  const jsxInner = lines.slice(retIdx + 1, lines.findIndex((l, i) => i > retIdx && /^\s*\);\s*$/.test(l)));
  const chunks = splitAtBlank(jsxInner, CHUNK - 40);
  const sectionsDir = path.join(path.dirname(viewPath), "sections");
  fs.mkdirSync(sectionsDir, { recursive: true });
  const base = kebab(viewFn.replace(/View$/, ""));
  const names = [];
  for (let i = 0; i < chunks.length; i++) {
    const name = `${viewFn}Part${i + 1}`;
    names.push(name);
    const body = chunks[i].join("\n");
    const bodyVm = chunks[i].join("\n");
    fs.writeFileSync(
      path.join(sectionsDir, `${base}-part-${i + 1}.tsx`),
      ensureNl(`"use client";

${headerImports}
import type { ${vmType} } from "${vmImportPath}";

export function ${name}({ vm }: { vm: ${vmType} }) {
  return (\n    <>\n${bodyVm}\n    </>\n  );
}
`)
    );
    console.log(`  view part ${i + 1}`, lineCount(path.join(sectionsDir, `${base}-part-${i + 1}.tsx`)));
  }
  fs.writeFileSync(
    viewPath,
    ensureNl(`"use client";

${headerImports}
import type { ${vmType} } from "${vmImportPath}";
${names.map((n, i) => `import { ${n} } from "./sections/${base}-part-${i + 1}";`).join("\n")}

export function ${viewFn}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${names.map((n) => `      <${n} vm={vm} />`).join("\n")}
    </>
  );
}
`)
  );
}

function findReturnParenBlockInLines(lines, fromIdx) {
  const retIdx = lines.findIndex((l, i) => i >= fromIdx && /^\s*return\s*\(/.test(l));
  if (retIdx < 0) return null;
  let depth = 0;
  for (let i = retIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
    }
    if (i > retIdx && depth <= 0 && /^\s*\);\s*$/.test(lines[i])) {
      return { retIdx, endIdx: i, inner: lines.slice(retIdx + 1, i) };
    }
  }
  return null;
}

function splitViewSections(viewPath, viewFn, vmType, vmImportPath, allVmKeys = []) {
  if (lineCount(viewPath) <= MAX) return;
  const lines = fs.readFileSync(viewPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${viewFn}`));
  const block = findReturnParenBlockInLines(lines, fnIdx + 1);
  if (!block || block.inner.length <= CHUNK) return;
  const viewImports = extractImportBlock(lines, fnIdx);
  const sectionsDir = path.join(path.dirname(viewPath), "sections");
  fs.mkdirSync(sectionsDir, { recursive: true });
  const chunks = splitAtBlank(block.inner, CHUNK);
  const base = kebab(viewFn.replace(/View$/, ""));
  const names = [];

  for (let i = 0; i < chunks.length; i++) {
    const name = `${viewFn}Section${i + 1}`;
    names.push(name);
    const chunkText = chunks[i].join("\n");
    const used = allVmKeys.filter((k) => new RegExp(`\\b${k}\\b`).test(chunkText));
    const destructure =
      used.length > 0
        ? `  const {\n${used.map((k) => `    ${k},`).join("\n")}\n  } = vm;\n\n`
        : "";
    const fp = path.join(sectionsDir, `${base}-section-${i + 1}.tsx`);
    fs.writeFileSync(
      fp,
      ensureNl(`"use client";

${viewImports}
import type { ${vmType} } from "${vmImportPath}";

export function ${name}({ vm }: { vm: ${vmType} }) {
${destructure}  return (
    <>
${chunkText}
    </>
  );
}
`)
    );
    console.log(`  view section ${i + 1}`, lineCount(fp));
  }

  fs.writeFileSync(
    viewPath,
    ensureNl(`"use client";

${viewImports}
import type { ${vmType} } from "${vmImportPath}";
${names.map((n, i) => `import { ${n} } from "./sections/${base}-section-${i + 1}";`).join("\n")}

export function ${viewFn}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${names.map((n) => `      <${n} vm={vm} />`).join("\n")}
    </>
  );
}
`)
  );
}

function splitWorkspace(abs, opts) {
  const { hookName, vmType, propsTypeDecl } = opts;
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  const exportIdx = lines.findIndex((l) => /^export\s+(default\s+)?function\s+\w+/.test(l));
  const fnName = lines[exportIdx].match(/function\s+(\w+)/)?.[1];
  const isDefaultExport = /export\s+default\s+function/.test(lines[exportIdx]);
  let mainReturnIdx = -1;
  for (let i = exportIdx + 1; i < lines.length; i++) {
    if (/^\s*return\s*\(/.test(lines[i])) {
      const n = lines[i + 1]?.trim() ?? "";
      if (n.startsWith("<") || n.startsWith("<>")) {
        mainReturnIdx = i;
        break;
      }
    }
  }
  if (mainReturnIdx < 0) throw new Error(`return not found in ${abs}`);

  const dir = path.dirname(abs);
  const base = path.basename(abs, ".tsx");
  const sub = path.join(dir, base);
  fs.mkdirSync(path.join(sub, "hooks"), { recursive: true });
  fs.mkdirSync(path.join(sub, "view"), { recursive: true });

  const headerImports = extractImportBlock(lines, exportIdx);
  let preludeStart = headerImports.split("\n").length;
  if (lines[0]?.includes("use client")) preludeStart++;
  while (preludeStart < exportIdx && lines[preludeStart].trim() === "") preludeStart++;
  const preludeBody = lines.slice(preludeStart, exportIdx);
  if (preludeBody.some((l) => l.trim())) {
    const pre = preludeBody
      .join("\n")
      .replace(/^function\s+/gm, "export function ")
      .replace(/^const\s+(\w+)\s*=\s*function/gm, "export const $1 = function");
    fs.writeFileSync(
      path.join(sub, `${base}.prelude.tsx`),
      ensureNl(`"use client";\n\n${pre}`)
    );
    console.log("prelude", lineCount(path.join(sub, `${base}.prelude.tsx`)));
  }

  const fnSig = lines[exportIdx];
  const propsInner = fnSig.match(/\(([\s\S]*)\)/)?.[1] ?? "";
  const hookBody = lines.slice(exportIdx + 1, mainReturnIdx);
  const viewJsx = lines.slice(mainReturnIdx);
  const hookFile = path.join(sub, "hooks", `${kebab(hookName)}.ts`);
  const viewFile = path.join(sub, "view", `${base}-view.tsx`);

  const preludeImport = preludeBody.some((l) => l.trim()) ? `import * as Prelude from "../${base}.prelude";\n` : "";

  const hookReturnKeys = collectDefinedNames(hookBody);
  const hookReturn = buildReturnBlock(hookReturnKeys);

  fs.writeFileSync(
    hookFile,
    ensureNl(`"use client";

${headerImports}
${preludeImport}
export function ${hookName}(${propsInner}) {
${hookBody.join("\n")}
${hookReturn.join("\n")}
}

export type ${vmType} = ReturnType<typeof ${hookName}>;
`)
  );

  const viewKeys = collectDefinedNames(hookBody);
  const viewDestructure =
    viewKeys.length > 0
      ? `  const {\n${viewKeys.map((k) => `    ${k},`).join("\n")}\n  } = vm;\n\n`
      : "";

  const viewContent = ensureNl(`${headerImports}
import type { ${vmType} } from "../hooks/${kebab(hookName)}";

export function ${fnName}View({ vm }: { vm: ${vmType} }) {
${viewDestructure}${viewJsx.join("\n")}
}
`);
  fs.writeFileSync(viewFile, viewContent.includes('"use client"') ? viewContent : ensureNl(`"use client";\n\n${viewContent}`));

  const propsArg = propsInner.trim()
    ? propsInner.includes("{")
      ? propsInner.split(":")[0].trim()
      : propsInner.trim()
    : "";
  const exportLine = isDefaultExport
    ? `export default function ${fnName}(${propsInner}) {`
    : `export function ${fnName}(${propsInner}) {`;
  fs.writeFileSync(
    abs,
    ensureNl(`"use client";

import { ${hookName} } from "./${base}/hooks/${kebab(hookName)}";
import { ${fnName}View } from "./${base}/view/${base}-view";

${exportLine}
  const vm = ${hookName}(${propsArg});
  return <${fnName}View vm={vm} />;
}
`)
  );

  console.log("phase1 hook", lineCount(hookFile), "view", lineCount(viewFile));
  if (lineCount(hookFile) > MAX) splitHookLayers(hookFile, hookName, propsInner, propsTypeDecl, vmType);
  if (lineCount(viewFile) > MAX && opts.viewSlices?.length) {
    const rel = opts.viewSlices.map((s) => ({
      name: s.name,
      start: s.start - mainReturnIdx,
      end: s.end - mainReturnIdx
    }));
    splitViewBySlices(viewFile, `${fnName}View`, vmType, `../hooks/${kebab(hookName)}`, headerImports, rel, viewKeys);
  } else if (lineCount(viewFile) > MAX) {
    splitViewByTopLevelJsx(viewFile, `${fnName}View`, vmType, `../hooks/${kebab(hookName)}`);
  }
  console.log("final hook", lineCount(hookFile), "view", lineCount(viewFile));
}

function findFunctionEnd(lines, fnIdx) {
  let depth = 0;
  let started = false;
  for (let i = fnIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === "{") {
        depth++;
        started = true;
      } else if (ch === "}") depth--;
    }
    if (started && depth === 0) return i;
  }
  return lines.length - 1;
}

function splitAppPage(abs) {
  const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
  let fnIdx = lines.findIndex((l) => /^function \w+PageContent\s*\(\s*\)\s*\{/.test(l));
  const exportIdx = lines.findLastIndex((l) => /^export\s+default\s+function\s+\w+/.test(l));
  if (fnIdx < 0) {
    if (exportIdx < 0) throw new Error("No PageContent or export default");
    fnIdx = exportIdx;
  }
  const fnName = lines[fnIdx].match(/function\s+(\w+)/)?.[1];
  if (!fnName) throw new Error("No function name");

  let mainReturnIdx = -1;
  const fnEnd = findFunctionEnd(lines, fnIdx);
  for (let i = fnIdx + 1; i <= fnEnd; i++) {
    if (/^\s*return\s*\(/.test(lines[i])) {
      const n = lines[i + 1]?.trim() ?? "";
      if (n.startsWith("<") || n.startsWith("<>")) {
        mainReturnIdx = i;
        break;
      }
    }
  }
  if (mainReturnIdx < 0) throw new Error("return ( not found");

  const dir = path.dirname(abs);
  const base = "page";
  const sub = path.join(dir, base);
  fs.mkdirSync(path.join(sub, "hooks"), { recursive: true });
  fs.mkdirSync(path.join(sub, "view"), { recursive: true });

  const prelude = lines.slice(0, fnIdx);
  const tail = lines.slice(fnEnd + 1);
  const hookBodyLines = lines.slice(fnIdx + 1, mainReturnIdx);
  const viewJsx = lines.slice(mainReturnIdx, fnEnd + 1);

  const hookName = `use${fnName.replace(/Content$/, "")}`;
  const vmType = `${fnName}Vm`;
  const viewFn = `${fnName}View`;
  const hookFile = path.join(sub, "hooks", `${kebab(hookName)}.ts`);
  const viewFile = path.join(sub, "view", `${base}-view.tsx`);

  const headerImports = extractImportBlock(lines, fnIdx);
  const preludeHelpers = prelude.filter(
    (l) => l.trim() && !l.includes("use client") && !l.startsWith("import ")
  );
  let hookLogic = hookBodyLines;
  let hookReturnBlock = "";
  const returnLineIdx = hookBodyLines.findIndex((l) => /^\s*return\s*\{/.test(l));
  if (returnLineIdx >= 0) {
    hookLogic = hookBodyLines.slice(0, returnLineIdx);
    hookReturnBlock = hookBodyLines.slice(returnLineIdx).join("\n");
  } else {
    const hookReturnKeys = collectDefinedNames(hookBodyLines);
    hookReturnBlock = buildReturnBlock(hookReturnKeys).join("\n");
  }
  const hookReturnKeys = collectDefinedNames(hookLogic);
  const hookBodyText = `${hookLogic.join("\n")}\n${hookReturnBlock}`;

  fs.writeFileSync(
    hookFile,
    ensureNl(`"use client";

${headerImports}
${preludeHelpers.join("\n")}

export type ${vmType} = ReturnType<typeof ${hookName}>;

export function ${hookName}() {
${hookBodyText}
}
`)
  );

  const viewImports = lines
    .slice(0, fnIdx)
    .filter((l) => l.includes("use client") || l.startsWith("import ") || l.trim() === "")
    .join("\n");
  fs.writeFileSync(
    viewFile,
    ensureNl(`"use client";

${viewImports}
import type { ${vmType} } from "../hooks/${kebab(hookName)}";

export function ${viewFn}({ vm }: { vm: ${vmType} }) {
${viewJsx.join("\n")}
}
`)
  );

  const pageImports = extractImportBlock(prelude, prelude.length);
  fs.writeFileSync(
    abs,
    ensureNl(`"use client";

${pageImports}
import { ${hookName} } from "./${base}/hooks/${kebab(hookName)}";
import { ${viewFn} } from "./${base}/view/${base}-view";

function ${fnName}() {
  const vm = ${hookName}();
  return <${viewFn} vm={vm} />;
}

${tail.join("\n")}
`)
  );

  console.log("page split", abs, "hook", lineCount(hookFile), "view", lineCount(viewFile));
  if (lineCount(hookFile) > MAX) splitHookLayers(hookFile, hookName, "", "", vmType);
  if (lineCount(viewFile) > MAX) splitViewByTopLevelJsx(viewFile, viewFn, vmType, `../hooks/${kebab(hookName)}`);
}

/** View ichidagi birinchi darajali JSX bolaklar bo‘yicha (PageShell ichidagi <Section / <div className=...>). */
function splitViewByTopLevelJsx(viewPath, viewFn, vmType, vmImportPath) {
  if (lineCount(viewPath) <= MAX) return;
  const lines = fs.readFileSync(viewPath, "utf8").split(/\r?\n/);
  const fnIdx = lines.findIndex((l) => l.includes(`export function ${viewFn}`));
  const block = findReturnParenBlockInLines(lines, fnIdx + 1);
  if (!block || block.inner.length <= CHUNK) return;

  const viewImports = extractImportBlock(lines, fnIdx);
  const inner = block.inner;
  const cuts = [0];
  for (let i = 1; i < inner.length; i++) {
    const line = inner[i];
    if (/^\s{4,12}<[A-Z][A-Za-z0-9]*/.test(line) || /^\s{4,12}<\w+/.test(line)) {
      if (i - cuts[cuts.length - 1] > 30) cuts.push(i);
    }
  }
  if (cuts[cuts.length - 1] !== inner.length) cuts.push(inner.length);

  const sectionsDir = path.join(path.dirname(viewPath), "sections");
  fs.mkdirSync(sectionsDir, { recursive: true });
  const base = kebab(viewFn.replace(/View$/, ""));
  const names = [];

  for (let i = 0; i < cuts.length - 1; i++) {
    const chunk = inner.slice(cuts[i], cuts[i + 1]);
    if (chunk.every((l) => !l.trim())) continue;
    const name = `${viewFn}Section${names.length + 1}`;
    names.push(name);
    fs.writeFileSync(
      path.join(sectionsDir, `${base}-section-${names.length}.tsx`),
      ensureNl(`"use client";

${viewImports}
import type { ${vmType} } from "${vmImportPath}";

export function ${name}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${chunk.join("\n")}
    </>
  );
}
`)
    );
    console.log(`  view jsx ${names.length}`, lineCount(path.join(sectionsDir, `${base}-section-${names.length}.tsx`)));
  }

  if (names.length === 0) return;

  fs.writeFileSync(
    viewPath,
    ensureNl(`"use client";

${viewImports}
import type { ${vmType} } from "${vmImportPath}";
${names.map((n, i) => `import { ${n} } from "./sections/${base}-section-${i + 1}";`).join("\n")}

export function ${viewFn}({ vm }: { vm: ${vmType} }) {
  return (
    <>
${names.map((n) => `      <${n} vm={vm} />`).join("\n")}
    </>
  );
}
`)
  );
}

const target = process.argv[2];
const map = {
  access: {
    file: path.join(frontendRoot, "components/access/access-workspace.tsx"),
    hookName: "useAccessWorkspace",
    vmType: "AccessWorkspaceVm",
    viewSlices: []
  },
  wdr: {
    file: path.join(frontendRoot, "components/reports/wdr-report-builder.tsx"),
    hookName: "useWdrReportBuilder",
    vmType: "WdrReportBuilderVm",
    viewSlices: []
  },
  dashboard: {
    file: path.join(frontendRoot, "components/dashboard/dashboard-sales-monitoring.tsx"),
    hookName: "useDashboardSalesMonitoring",
    vmType: "DashboardSalesMonitoringVm",
    viewSlices: []
  }
};

if (target === "file" && process.argv[3]) {
  const abs = path.resolve(process.argv[3]);
  if (abs.replace(/\\/g, "/").includes("/app/") && abs.endsWith("page.tsx")) {
    splitAppPage(abs);
  } else {
    const lines = fs.readFileSync(abs, "utf8").split(/\r?\n/);
    const exportIdx = lines.findIndex((l) => /^export\s+(default\s+)?function\s+\w+/.test(l));
    const fnName = lines[exportIdx]?.match(/function\s+(\w+)/)?.[1] ?? "Page";
    const hookName = fnName.startsWith("use") ? fnName : `use${fnName}`;
    const vmType = `${fnName}Vm`;
    splitWorkspace(abs, { hookName, vmType, propsTypeDecl: "" });
  }
} else if (target === "batch-pages") {
  const audit = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "audit-max-file-lines.mjs"), "--frontend"], {
    encoding: "utf8",
    cwd: repoRoot,
    env: { ...process.env, MAX_FILE_LINES: String(MAX) }
  });
  const files = [];
  for (const line of `${audit.stdout || ""}${audit.stderr || ""}`.split("\n")) {
    const m = line.trim().match(/^\d+\s+(frontend\/app\/.+\.tsx)$/);
    if (m) files.push(path.join(repoRoot, m[1]));
  }
  for (const f of files) {
    console.log("\n==>", f);
    try {
      splitAppPage(f);
    } catch (e) {
      console.error("FAIL", f, e.message);
    }
  }
} else if (!map[target]) {
  console.error("Usage: node split-workspace-file.mjs [access|wdr|dashboard|file <path>|batch-pages]");
  process.exit(2);
} else {
  splitWorkspace(map[target].file, map[target]);
}
