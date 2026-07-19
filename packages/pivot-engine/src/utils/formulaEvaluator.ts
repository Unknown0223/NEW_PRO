/**
 * Xavfsiz formula baholovchi — eval() ishlatilmaydi.
 * Qo'llab-quvvatlanadi: +, -, *, /, ^, qavs, taqqoslash, AND/OR,
 * IF / ABS / MIN / MAX, maydon id va sonlar.
 */

type BinOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "="
  | "!="
  | "<"
  | ">"
  | "<="
  | ">="
  | "AND"
  | "OR";

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "op"; value: BinOp }
  | { type: "comma" }
  | { type: "lparen" }
  | { type: "rparen" };

type EvalFn = (row: Record<string, unknown>) => number | null;

const FUNCS = new Set(["IF", "ABS", "MIN", "MAX"]);

function isIdentStart(ch: string): boolean {
  return /[a-zA-Z_]/.test(ch);
}

function isIdentCont(ch: string): boolean {
  return /[a-zA-Z0-9_]/.test(ch);
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = formula.trim();

  while (i < s.length) {
    const ch = s[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }
    if (ch === "^") {
      tokens.push({ type: "op", value: "^" });
      i++;
      continue;
    }
    if (ch === "+") {
      tokens.push({ type: "op", value: "+" });
      i++;
      continue;
    }
    if (ch === "*") {
      tokens.push({ type: "op", value: "*" });
      i++;
      continue;
    }
    if (ch === "/") {
      tokens.push({ type: "op", value: "/" });
      i++;
      continue;
    }
    if (ch === "-") {
      tokens.push({ type: "op", value: "-" });
      i++;
      continue;
    }
    if (ch === "=") {
      tokens.push({ type: "op", value: "=" });
      i++;
      continue;
    }
    if (ch === "≠") {
      tokens.push({ type: "op", value: "!=" });
      i++;
      continue;
    }
    if (ch === "≤") {
      tokens.push({ type: "op", value: "<=" });
      i++;
      continue;
    }
    if (ch === "≥") {
      tokens.push({ type: "op", value: ">=" });
      i++;
      continue;
    }
    if (ch === "!" && s[i + 1] === "=") {
      tokens.push({ type: "op", value: "!=" });
      i += 2;
      continue;
    }
    if (ch === "<") {
      if (s[i + 1] === ">") {
        tokens.push({ type: "op", value: "!=" });
        i += 2;
        continue;
      }
      if (s[i + 1] === "=") {
        tokens.push({ type: "op", value: "<=" });
        i += 2;
        continue;
      }
      tokens.push({ type: "op", value: "<" });
      i++;
      continue;
    }
    if (ch === ">") {
      if (s[i + 1] === "=") {
        tokens.push({ type: "op", value: ">=" });
        i += 2;
        continue;
      }
      tokens.push({ type: "op", value: ">" });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < s.length && /[0-9.]/.test(s[i]!)) {
        num += s[i]!;
        i++;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) throw new Error(`Некорректное число: ${num}`);
      tokens.push({ type: "number", value });
      continue;
    }
    if (isIdentStart(ch)) {
      let ident = ch;
      i++;
      while (i < s.length && isIdentCont(s[i]!)) {
        ident += s[i]!;
        i++;
      }
      const upper = ident.toUpperCase();
      if (upper === "AND" || upper === "OR") {
        tokens.push({ type: "op", value: upper });
      } else {
        tokens.push({ type: "ident", value: ident });
      }
      continue;
    }
    throw new Error(`Недопустимый символ: ${ch}`);
  }

  return tokens;
}

function truthy(n: number): boolean {
  return n !== 0;
}

function compare(op: BinOp, a: number, b: number): number {
  switch (op) {
    case "=":
      return a === b ? 1 : 0;
    case "!=":
      return a !== b ? 1 : 0;
    case "<":
      return a < b ? 1 : 0;
    case ">":
      return a > b ? 1 : 0;
    case "<=":
      return a <= b ? 1 : 0;
    case ">=":
      return a >= b ? 1 : 0;
    default:
      return 0;
  }
}

class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private allowedFields: Set<string>
  ) {}

  parse(): EvalFn {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new Error("В формуле лишние символы");
    }
    return (row) => {
      const value = expr(row);
      return value != null && Number.isFinite(value) ? value : null;
    };
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private peekOp(value: BinOp): boolean {
    const t = this.peek();
    return t?.type === "op" && t.value === value;
  }

  private parseOr(): EvalFn {
    let left = this.parseAnd();
    while (this.peekOp("OR")) {
      this.pos++;
      const right = this.parseAnd();
      const prev = left;
      left = (row) => {
        const a = prev(row);
        const b = right(row);
        if (a == null || b == null) return null;
        return truthy(a) || truthy(b) ? 1 : 0;
      };
    }
    return left;
  }

  private parseAnd(): EvalFn {
    let left = this.parseComparison();
    while (this.peekOp("AND")) {
      this.pos++;
      const right = this.parseComparison();
      const prev = left;
      left = (row) => {
        const a = prev(row);
        const b = right(row);
        if (a == null || b == null) return null;
        return truthy(a) && truthy(b) ? 1 : 0;
      };
    }
    return left;
  }

  private parseComparison(): EvalFn {
    let left = this.parseAdd();
    const t = this.peek();
    if (
      t?.type === "op" &&
      (t.value === "=" ||
        t.value === "!=" ||
        t.value === "<" ||
        t.value === ">" ||
        t.value === "<=" ||
        t.value === ">=")
    ) {
      this.pos++;
      const right = this.parseAdd();
      const op = t.value;
      const prev = left;
      left = (row) => {
        const a = prev(row);
        const b = right(row);
        if (a == null || b == null) return null;
        return compare(op, a, b);
      };
    }
    return left;
  }

  private parseAdd(): EvalFn {
    let left = this.parseMul();
    while (this.peek()?.type === "op") {
      const op = (this.peek() as { value: BinOp }).value;
      if (op !== "+" && op !== "-") break;
      this.pos++;
      const right = this.parseMul();
      const prev = left;
      left = (row) => {
        const a = prev(row);
        const b = right(row);
        if (a == null || b == null) return null;
        return op === "+" ? a + b : a - b;
      };
    }
    return left;
  }

  private parseMul(): EvalFn {
    let left = this.parsePow();
    while (this.peek()?.type === "op") {
      const op = (this.peek() as { value: BinOp }).value;
      if (op !== "*" && op !== "/") break;
      this.pos++;
      const right = this.parsePow();
      const prev = left;
      left = (row) => {
        const a = prev(row);
        const b = right(row);
        if (a == null || b == null) return null;
        if (op === "/" && b === 0) return null;
        return op === "*" ? a * b : a / b;
      };
    }
    return left;
  }

  /** Right-associative power. */
  private parsePow(): EvalFn {
    const left = this.parseUnary();
    if (this.peek()?.type === "op" && (this.peek() as { value: BinOp }).value === "^") {
      this.pos++;
      const right = this.parsePow();
      return (row) => {
        const a = left(row);
        const b = right(row);
        if (a == null || b == null) return null;
        const r = a ** b;
        return Number.isFinite(r) ? r : null;
      };
    }
    return left;
  }

  private parseUnary(): EvalFn {
    const t = this.peek();
    if (t?.type === "op" && t.value === "-") {
      this.pos++;
      const inner = this.parseUnary();
      return (row) => {
        const v = inner(row);
        return v == null ? null : -v;
      };
    }
    if (t?.type === "op" && t.value === "+") {
      this.pos++;
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): EvalFn {
    const t = this.peek();
    if (!t) throw new Error("Формула неполная");

    if (t.type === "number") {
      this.pos++;
      const value = t.value;
      return () => value;
    }

    if (t.type === "ident") {
      const name = t.value;
      const upper = name.toUpperCase();
      const next = this.tokens[this.pos + 1];
      if (next?.type === "lparen" && FUNCS.has(upper)) {
        this.pos++;
        return this.parseFuncCall(upper);
      }
      if (!this.allowedFields.has(name)) {
        throw new Error(`Недопустимое поле: ${name}`);
      }
      this.pos++;
      return (row) => {
        const v = row[name];
        if (typeof v === "number" && Number.isFinite(v)) return v;
        return null;
      };
    }

    if (t.type === "lparen") {
      this.pos++;
      const inner = this.parseOr();
      const close = this.peek();
      if (!close || close.type !== "rparen") throw new Error("Ожидается закрывающая скобка");
      this.pos++;
      return inner;
    }

    throw new Error("Неожиданный элемент формулы");
  }

  private expectLparen(): void {
    const t = this.peek();
    if (!t || t.type !== "lparen") throw new Error("Ожидается '('");
    this.pos++;
  }

  private expectRparen(): void {
    const t = this.peek();
    if (!t || t.type !== "rparen") throw new Error("Ожидается закрывающая скобка");
    this.pos++;
  }

  private expectComma(): void {
    const t = this.peek();
    if (!t || t.type !== "comma") throw new Error("Ожидается ','");
    this.pos++;
  }

  private parseFuncCall(name: string): EvalFn {
    this.expectLparen();
    if (name === "IF") {
      const cond = this.parseOr();
      this.expectComma();
      const a = this.parseOr();
      this.expectComma();
      const b = this.parseOr();
      this.expectRparen();
      return (row) => {
        const c = cond(row);
        if (c == null) return null;
        return truthy(c) ? a(row) : b(row);
      };
    }
    if (name === "ABS") {
      const arg = this.parseOr();
      this.expectRparen();
      return (row) => {
        const v = arg(row);
        return v == null ? null : Math.abs(v);
      };
    }
    // MIN / MAX — one or more args
    const args: EvalFn[] = [this.parseOr()];
    while (this.peek()?.type === "comma") {
      this.pos++;
      args.push(this.parseOr());
    }
    this.expectRparen();
    if (name === "MIN") {
      return (row) => {
        let best: number | null = null;
        for (const fn of args) {
          const v = fn(row);
          if (v == null) return null;
          best = best == null ? v : Math.min(best, v);
        }
        return best;
      };
    }
    return (row) => {
      let best: number | null = null;
      for (const fn of args) {
        const v = fn(row);
        if (v == null) return null;
        best = best == null ? v : Math.max(best, v);
      }
      return best;
    };
  }
}

/** Formula matnini xavfsiz AST orqali baholash funksiyasiga aylantiradi. */
export function compileFormula(
  formula: string,
  allowedFieldIds: string[]
): (row: Record<string, unknown>) => number | null {
  const trimmed = formula.trim();
  if (!trimmed) throw new Error("Формула пуста");
  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens, new Set(allowedFieldIds));
  return parser.parse();
}

/** Bir qator uchun formula qiymatini hisoblaydi. */
export function evaluateFormula(
  formula: string,
  row: Record<string, unknown>,
  allowedFieldIds: string[]
): number | null {
  const fn = compileFormula(formula, allowedFieldIds);
  return fn(row);
}
