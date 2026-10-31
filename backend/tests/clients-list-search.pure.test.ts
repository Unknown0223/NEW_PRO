import { describe, expect, it } from "vitest";
import { buildClientListSearchOrClause } from "../src/modules/clients/clients.list.search";

function idClauses(search: string) {
  return buildClientListSearchOrClause(search).filter((c) => "id" in c);
}

describe("buildClientListSearchOrClause", () => {
  it("telefon raqami (INT4 dan katta) — id sharti qo‘shilmaydi, telefon bo‘yicha qidiradi", () => {
    const or = buildClientListSearchOrClause("998912418905");
    expect(idClauses("998912418905")).toEqual([]);
    expect(or).toContainEqual({ phone_normalized: { contains: "998912418905" } });
  });

  it("kichik raqam — ichki id bo‘yicha ham qidiradi", () => {
    expect(idClauses("29411")).toEqual([{ id: 29411 }]);
  });

  it("to‘liq ism — so‘zlar alohida, tartibdan qat’i nazar", () => {
    const or = buildClientListSearchOrClause("Ibroximov Hamdam");
    expect(or).toHaveLength(1);
    const and = (or[0] as { AND?: unknown[] }).AND;
    expect(and).toHaveLength(2);
  });

  it("tashqi kod qo‘shimchasi INT4 dan katta bo‘lsa — id sharti yo‘q", () => {
    expect(idClauses("ur_99999999999")).toEqual([]);
    expect(idClauses("ur_29411")).toEqual([{ id: 29411 }]);
  });
});
