/**
 * Xavfsiz formula baholovchi — eval() ishlatilmaydi.
 * Qo'llab-quvvatlanadi: fieldId + fieldId, fieldId * 0.12, fieldId / fieldId
 */
function tokenize(formula) {
    const tokens = [];
    let i = 0;
    const s = formula.trim();
    while (i < s.length) {
        const ch = s[i];
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
        if ("+-*/".includes(ch)) {
            tokens.push({ type: "op", value: ch });
            i++;
            continue;
        }
        if (/[0-9.]/.test(ch)) {
            let num = ch;
            i++;
            while (i < s.length && /[0-9.]/.test(s[i])) {
                num += s[i];
                i++;
            }
            const value = Number(num);
            if (!Number.isFinite(value))
                throw new Error(`Noto'g'ri son: ${num}`);
            tokens.push({ type: "number", value });
            continue;
        }
        if (/[a-zA-Z_][a-zA-Z0-9_]*/.test(ch)) {
            let ident = ch;
            i++;
            while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) {
                ident += s[i];
                i++;
            }
            tokens.push({ type: "ident", value: ident });
            continue;
        }
        throw new Error(`Noto'g'ri belgi: ${ch}`);
    }
    return tokens;
}
class Parser {
    constructor(tokens, allowedFields) {
        this.tokens = tokens;
        this.allowedFields = allowedFields;
        this.pos = 0;
    }
    parse() {
        const expr = this.parseExpr();
        if (this.pos < this.tokens.length) {
            throw new Error("Formula ortiqcha belgilar bilan tugadi");
        }
        return (row) => {
            const value = expr(row);
            return value != null && Number.isFinite(value) ? value : null;
        };
    }
    parseExpr() {
        let left = this.parseTerm();
        while (this.pos < this.tokens.length) {
            const t = this.tokens[this.pos];
            if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-"))
                break;
            this.pos++;
            const right = this.parseTerm();
            const op = t.value;
            const prevLeft = left;
            left = (row) => {
                const a = prevLeft(row);
                const b = right(row);
                if (a == null || b == null)
                    return null;
                return op === "+" ? a + b : a - b;
            };
        }
        return left;
    }
    parseTerm() {
        let left = this.parseFactor();
        while (this.pos < this.tokens.length) {
            const t = this.tokens[this.pos];
            if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/"))
                break;
            this.pos++;
            const right = this.parseFactor();
            const op = t.value;
            const prevLeft = left;
            left = (row) => {
                const a = prevLeft(row);
                const b = right(row);
                if (a == null || b == null)
                    return null;
                if (op === "/" && b === 0)
                    return null;
                return op === "*" ? a * b : a / b;
            };
        }
        return left;
    }
    parseFactor() {
        const t = this.tokens[this.pos];
        if (!t)
            throw new Error("Formula to'liq emas");
        if (t.type === "number") {
            this.pos++;
            const value = t.value;
            return () => value;
        }
        if (t.type === "ident") {
            if (!this.allowedFields.has(t.value)) {
                throw new Error(`Ruxsat etilmagan maydon: ${t.value}`);
            }
            this.pos++;
            const fieldId = t.value;
            return (row) => {
                const v = row[fieldId];
                if (typeof v === "number" && Number.isFinite(v))
                    return v;
                return null;
            };
        }
        if (t.type === "lparen") {
            this.pos++;
            const inner = this.parseExpr();
            const close = this.tokens[this.pos];
            if (!close || close.type !== "rparen")
                throw new Error("Yopuvchi qavs kutilgan");
            this.pos++;
            return inner;
        }
        throw new Error("Kutilmagan token");
    }
}
/** Formula matnini xavfsiz AST orqali baholash funksiyasiga aylantiradi. */
export function compileFormula(formula, allowedFieldIds) {
    const trimmed = formula.trim();
    if (!trimmed)
        throw new Error("Formula bo'sh");
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, new Set(allowedFieldIds));
    return parser.parse();
}
/** Bir qator uchun formula qiymatini hisoblaydi. */
export function evaluateFormula(formula, row, allowedFieldIds) {
    const fn = compileFormula(formula, allowedFieldIds);
    return fn(row);
}
