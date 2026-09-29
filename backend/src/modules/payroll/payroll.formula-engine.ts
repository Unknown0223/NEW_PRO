/**
 * Oylik formulalari dvigateli (Excel uslubi, rus funksiyalari).
 *
 *   [O'zgaruvchi] · 1 000 000 · 2.5 · + - * / ^ · > < >= <= = <> · ( )
 *   ЕСЛИ(шарт, a, b) · И(..) · ИЛИ(..) · НЕ(x) · ОКРУГЛ(x, n) · ОКРУГЛВВЕРХ · ОКРУГЛВНИЗ
 *   MIN/МИН · MAX/МАКС · ABS · СУММ
 *
 * Yuqori darajadagi `шарт , a , b` (ЕСЛИ yozilmagan) ham ЕСЛИ sifatida o'qiladi.
 * Nolga bo'lish → 0 (ogohlantirish bilan).
 */

export type FormulaAst =
  | { k: "num"; v: number }
  | { k: "var"; name: string }
  | { k: "neg"; e: FormulaAst }
  | { k: "bin"; op: string; a: FormulaAst; b: FormulaAst }
  | { k: "call"; fn: string; args: FormulaAst[] };

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    public pos: number
  ) {
    super(message);
  }
}

type Tok = { t: "num" | "var" | "id" | "op" | "sep" | "lp" | "rp"; v: string; pos: number };

const FN_ALIASES: Record<string, string> = {
  ЕСЛИ: "IF",
  IF: "IF",
  И: "AND",
  AND: "AND",
  ИЛИ: "OR",
  OR: "OR",
  НЕ: "NOT",
  NOT: "NOT",
  ОКРУГЛ: "ROUND",
  ROUND: "ROUND",
  ОКРУГЛВВЕРХ: "ROUNDUP",
  ROUNDUP: "ROUNDUP",
  ОКРУГЛВНИЗ: "ROUNDDOWN",
  ROUNDDOWN: "ROUNDDOWN",
  MIN: "MIN",
  МИН: "MIN",
  MAX: "MAX",
  МАКС: "MAX",
  ABS: "ABS",
  СУММ: "SUM",
  SUM: "SUM"
};

export function normalizeVarName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLocaleLowerCase("ru");
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "[") {
      const end = src.indexOf("]", i + 1);
      if (end < 0) throw new FormulaSyntaxError("Не закрыта скобка [", i);
      const name = src.slice(i + 1, end).trim();
      if (!name) throw new FormulaSyntaxError("Пустое имя переменной", i);
      out.push({ t: "var", v: name, pos: i });
      i = end + 1;
      continue;
    }
    const num = /^\d+(?:[ \u00a0]\d{3})*(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: "num", v: num[0].replace(/[ \u00a0]/g, ""), pos: i });
      i += num[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if ([">=", "<=", "<>", "!=", "=="].includes(two)) {
      out.push({ t: "op", v: two === "!=" ? "<>" : two === "==" ? "=" : two, pos: i });
      i += 2;
      continue;
    }
    if ("+-*/^<>=".includes(ch)) {
      out.push({ t: "op", v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === "," || ch === ";") {
      out.push({ t: "sep", v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === "(") {
      out.push({ t: "lp", v: ch, pos: i });
      i++;
      continue;
    }
    if (ch === ")") {
      out.push({ t: "rp", v: ch, pos: i });
      i++;
      continue;
    }
    const id = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё_0-9]*/.exec(src.slice(i));
    if (id) {
      out.push({ t: "id", v: id[0].toUpperCase(), pos: i });
      i += id[0].length;
      continue;
    }
    throw new FormulaSyntaxError(`Недопустимый символ «${ch}»`, i);
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  private peek(): Tok | undefined {
    return this.toks[this.i];
  }
  private next(): Tok {
    const t = this.toks[this.i++];
    if (!t) throw new FormulaSyntaxError("Неожиданный конец формулы", Number.MAX_SAFE_INTEGER);
    return t;
  }
  private isOp(...ops: string[]): boolean {
    const t = this.peek();
    return Boolean(t && t.t === "op" && ops.includes(t.v));
  }

  parseTop(): FormulaAst {
    const parts = [this.parseCompare()];
    while (this.peek()?.t === "sep") {
      this.next();
      parts.push(this.parseCompare());
    }
    const rest = this.peek();
    if (rest) throw new FormulaSyntaxError(`Лишний символ «${rest.v}»`, rest.pos);
    if (parts.length === 1) return parts[0]!;
    if (parts.length > 3) throw new FormulaSyntaxError("Слишком много аргументов верхнего уровня", 0);
    return { k: "call", fn: "IF", args: parts };
  }

  private parseCompare(): FormulaAst {
    let a = this.parseAdd();
    while (this.isOp(">", "<", ">=", "<=", "=", "<>")) {
      const op = this.next().v;
      a = { k: "bin", op, a, b: this.parseAdd() };
    }
    return a;
  }
  private parseAdd(): FormulaAst {
    let a = this.parseMul();
    while (this.isOp("+", "-")) {
      const op = this.next().v;
      a = { k: "bin", op, a, b: this.parseMul() };
    }
    return a;
  }
  private parseMul(): FormulaAst {
    let a = this.parsePow();
    while (this.isOp("*", "/")) {
      const op = this.next().v;
      a = { k: "bin", op, a, b: this.parsePow() };
    }
    return a;
  }
  private parsePow(): FormulaAst {
    const a = this.parseUnary();
    if (this.isOp("^")) {
      this.next();
      return { k: "bin", op: "^", a, b: this.parsePow() };
    }
    return a;
  }
  private parseUnary(): FormulaAst {
    if (this.isOp("-")) {
      this.next();
      return { k: "neg", e: this.parseUnary() };
    }
    if (this.isOp("+")) {
      this.next();
      return this.parseUnary();
    }
    return this.parseAtom();
  }
  private parseAtom(): FormulaAst {
    const t = this.next();
    if (t.t === "num") return { k: "num", v: Number(t.v) };
    if (t.t === "var") return { k: "var", name: t.v };
    if (t.t === "lp") {
      const e = this.parseCompare();
      const r = this.next();
      if (r.t !== "rp") throw new FormulaSyntaxError("Ожидалась «)»", r.pos);
      return e;
    }
    if (t.t === "id") {
      const fn = FN_ALIASES[t.v];
      if (!fn) throw new FormulaSyntaxError(`Неизвестная функция «${t.v}»`, t.pos);
      const lp = this.next();
      if (lp.t !== "lp") throw new FormulaSyntaxError(`После ${t.v} ожидалась «(»`, lp.pos);
      const args: FormulaAst[] = [];
      if (this.peek()?.t !== "rp") {
        args.push(this.parseCompare());
        while (this.peek()?.t === "sep") {
          this.next();
          args.push(this.parseCompare());
        }
      }
      const rp = this.next();
      if (rp.t !== "rp") throw new FormulaSyntaxError("Ожидалась «)»", rp.pos);
      checkArity(fn, args.length, t.pos);
      return { k: "call", fn, args };
    }
    throw new FormulaSyntaxError(`Неожиданный символ «${t.v}»`, t.pos);
  }
}

function checkArity(fn: string, n: number, pos: number) {
  const bad =
    (fn === "IF" && (n < 2 || n > 3)) ||
    (fn === "NOT" && n !== 1) ||
    (fn === "ABS" && n !== 1) ||
    (["ROUND", "ROUNDUP", "ROUNDDOWN"].includes(fn) && (n < 1 || n > 2)) ||
    (["AND", "OR", "MIN", "MAX", "SUM"].includes(fn) && n < 1);
  if (bad) throw new FormulaSyntaxError(`Неверное число аргументов для ${fn}`, pos);
}

export function parseFormula(text: string): FormulaAst {
  const src = text.trim();
  if (!src) throw new FormulaSyntaxError("Формула пустая", 0);
  return new Parser(tokenize(src)).parseTop();
}

export function collectVariables(ast: FormulaAst, out = new Set<string>()): Set<string> {
  if (ast.k === "var") out.add(ast.name);
  else if (ast.k === "neg") collectVariables(ast.e, out);
  else if (ast.k === "bin") {
    collectVariables(ast.a, out);
    collectVariables(ast.b, out);
  } else if (ast.k === "call") ast.args.forEach((a) => collectVariables(a, out));
  return out;
}

function roundTo(x: number, n: number, mode: "round" | "up" | "down"): number {
  const f = 10 ** Math.trunc(n);
  const v = x * f;
  const r = mode === "round" ? Math.sign(v) * Math.round(Math.abs(v)) : mode === "up" ? Math.sign(v) * Math.ceil(Math.abs(v)) : Math.trunc(v);
  return r / f;
}

export type EvalResult = { value: number; warnings: string[] };

export function evaluateFormula(ast: FormulaAst, vars: Map<string, number>): EvalResult {
  const warnings = new Set<string>();
  const ev = (n: FormulaAst): number => {
    switch (n.k) {
      case "num":
        return n.v;
      case "var": {
        const v = vars.get(normalizeVarName(n.name));
        if (v === undefined) throw new FormulaSyntaxError(`Неизвестная переменная [${n.name}]`, 0);
        return v;
      }
      case "neg":
        return -ev(n.e);
      case "bin": {
        const a = ev(n.a);
        const b = ev(n.b);
        switch (n.op) {
          case "+": return a + b;
          case "-": return a - b;
          case "*": return a * b;
          case "/":
            if (b === 0) {
              warnings.add("division_by_zero");
              return 0;
            }
            return a / b;
          case "^": return a ** b;
          case ">": return a > b ? 1 : 0;
          case "<": return a < b ? 1 : 0;
          case ">=": return a >= b ? 1 : 0;
          case "<=": return a <= b ? 1 : 0;
          case "=": return Math.abs(a - b) < 1e-9 ? 1 : 0;
          case "<>": return Math.abs(a - b) >= 1e-9 ? 1 : 0;
        }
        return 0;
      }
      case "call": {
        const A = n.args;
        switch (n.fn) {
          case "IF": return ev(A[0]!) !== 0 ? ev(A[1]!) : A[2] ? ev(A[2]) : 0;
          case "AND": return A.every((x) => ev(x) !== 0) ? 1 : 0;
          case "OR": return A.some((x) => ev(x) !== 0) ? 1 : 0;
          case "NOT": return ev(A[0]!) === 0 ? 1 : 0;
          case "ABS": return Math.abs(ev(A[0]!));
          case "ROUND": return roundTo(ev(A[0]!), A[1] ? ev(A[1]) : 0, "round");
          case "ROUNDUP": return roundTo(ev(A[0]!), A[1] ? ev(A[1]) : 0, "up");
          case "ROUNDDOWN": return roundTo(ev(A[0]!), A[1] ? ev(A[1]) : 0, "down");
          case "MIN": return Math.min(...A.map(ev));
          case "MAX": return Math.max(...A.map(ev));
          case "SUM": return A.map(ev).reduce((s, x) => s + x, 0);
        }
        return 0;
      }
    }
  };
  const value = ev(ast);
  if (!Number.isFinite(value)) return { value: 0, warnings: [...warnings, "not_finite"] };
  return { value: Math.round(value * 100) / 100, warnings: [...warnings] };
}

export type FormulaValidation = {
  ok: boolean;
  error?: string;
  pos?: number;
  variables: string[];
  unknown: string[];
};

export function validateFormula(text: string, known: Set<string>): FormulaValidation {
  try {
    const ast = parseFormula(text);
    const variables = [...collectVariables(ast)];
    const unknown = variables.filter((v) => !known.has(normalizeVarName(v)));
    return unknown.length
      ? { ok: false, error: `Неизвестные переменные: ${unknown.map((u) => `[${u}]`).join(", ")}`, variables, unknown }
      : { ok: true, variables, unknown: [] };
  } catch (e) {
    const err = e as FormulaSyntaxError;
    return { ok: false, error: err.message, pos: err.pos, variables: [], unknown: [] };
  }
}
