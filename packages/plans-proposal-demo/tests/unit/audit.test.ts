import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, cloneConfig } from "@salec/plans-proposal";
import { buildMultiDemoInput, INITIAL_CONTEXT } from "../../src/data/demo-data";
import type { ConfigMap } from "../../src/lib/selection";
import {
  AUDIT_ACTOR,
  ACTION_LABELS,
  auditCsv,
  auditTime,
  cellAudit,
  describeFormula,
  diffConfigs,
  makeAuditEntries
} from "../../src/lib/audit";
import {
  createSharedDraft,
  draftKey,
  parseSharedDraft,
  type SharedDraft
} from "../../src/lib/storage";

function setup() {
  const configs: ConfigMap = {
    "1": cloneConfig(DEFAULT_CONFIG),
    "2": cloneConfig(DEFAULT_CONFIG),
    "3": cloneConfig(DEFAULT_CONFIG)
  };
  const input = buildMultiDemoInput(INITIAL_CONTEXT, configs, [1, 2, 3]);
  return { configs, datasets: input.datasets };
}

describe("audit tarixi", () => {
  it("faqat o‘zgargan xodim×KPI kataklari uchun yozuv chiqaradi", () => {
    const { configs, datasets } = setup();
    const after: ConfigMap = {
      "1": cloneConfig(configs["1"]!),
      "2": cloneConfig(configs["2"]!),
      "3": cloneConfig(configs["3"]!)
    };
    after["1"]!.cellFormulas = {
      "1:1001": { basis: "fact", mode: "percent", value: 20 }
    };
    after["1"]!.excluded = ["2:1002"];
    after["2"]!.defaultFormula = { basis: "previous_plan", mode: "percent", value: 0 };
    after["3"]!.overrides["3:1003"] = { value: "500000000", reason: "Hudud rejasi" };
    const changes = diffConfigs(configs, after, datasets);
    expect(changes.filter((c) => c.action === "formula")).toHaveLength(1);
    expect(changes.filter((c) => c.action === "excluded")).toHaveLength(1);
    expect(changes.filter((c) => c.action === "settings")).toHaveLength(1);
    expect(changes.filter((c) => c.action === "manual")).toHaveLength(1);
    const formula = changes.find((c) => c.action === "formula")!;
    expect(formula.kpiGroupId).toBe(1);
    expect(formula.cellKey).toBe("1:1001");
    expect(formula.employeeName).toBe("Aziz Karimov");
    expect(formula.before).toBe(describeFormula(null));
    expect(formula.after).toContain("+ 20%");
    expect(diffConfigs(after, after, datasets)).toEqual([]);
  });

  it("yozuvlarga kim, qachon va qaysi davr yoziladi", () => {
    const { configs, datasets } = setup();
    const after = { ...configs, "1": cloneConfig(configs["1"]!) };
    after["1"]!.cellFormulas = {
      "1:1001": { basis: "fact", mode: "percent", value: 7 }
    };
    let n = 0;
    const entries = makeAuditEntries(diffConfigs(configs, after, datasets), "1:1:2026-12", {
      at: "2026-11-14T10:00:00.000Z",
      makeId: () => `id-${++n}`
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "id-1",
      actor: AUDIT_ACTOR,
      contextKey: "1:1:2026-12",
      at: "2026-11-14T10:00:00.000Z",
      kpiGroupId: 1,
      cellKey: "1:1001"
    });
    expect(ACTION_LABELS[entries[0]!.action]).toBe("Formula o‘zgartirildi");
  });

  it("bitta katak tarixi eng yangisidan boshlab qaytadi", () => {
    const entries = [
      ...makeAuditEntries(
        [
          {
            action: "formula",
            kpiGroupId: 1,
            cellKey: "1:1001",
            employeeName: "Aziz Karimov",
            field: "Formula",
            before: "+10%",
            after: "+12%",
            summary: "birinchi"
          }
        ],
        "k",
        { at: "2026-11-14T09:00:00.000Z" }
      ),
      ...makeAuditEntries(
        [
          {
            action: "formula",
            kpiGroupId: 2,
            cellKey: "1:1001",
            employeeName: "Aziz Karimov",
            field: "Formula",
            before: "+10%",
            after: "+12%",
            summary: "boshqa KPI"
          }
        ],
        "k",
        { at: "2026-11-14T11:00:00.000Z" }
      ),
      ...makeAuditEntries(
        [
          {
            action: "formula",
            kpiGroupId: 1,
            cellKey: "1:1001",
            employeeName: "Aziz Karimov",
            field: "Formula",
            before: "+12%",
            after: "+15%",
            summary: "ikkinchi"
          }
        ],
        "k",
        { at: "2026-11-14T10:00:00.000Z" }
      )
    ];
    const history = cellAudit(entries, 1, "1:1001");
    expect(history.map((e) => e.summary)).toEqual(["ikkinchi", "birinchi"]);
  });

  it("sana va vaqtni barqaror o‘zbekcha formatlaydi", () => {
    expect(auditTime("2026-11-14T10:05:00.000Z")).toBe("14 Noyabr 2026, 10:05");
    expect(auditTime("not-a-date")).toBe("—");
  });

  it("audit jadvali CSVga barcha ustunlar bilan chiqariladi", () => {
    const entries = makeAuditEntries(
      [
        {
          action: "delete",
          kpiGroupId: 1,
          cellKey: "1:1001",
          employeeName: "Aziz Karimov",
          field: "Qator",
          before: "Bor",
          after: "O‘chirildi",
          summary: "Qator o‘chirildi"
        }
      ],
      "k",
      { at: "2026-11-14T10:00:00.000Z" }
    );
    const csv = auditCsv(entries);
    expect(csv).toContain("Sana va vaqt");
    expect(csv).toContain("Planlovchi");
    expect(csv).toContain("Qator o‘chirildi");
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("umumiy draft storage v3", () => {
  it("davr + yo‘nalish bo‘yicha bitta kalit hosil qiladi", () => {
    expect(draftKey(INITIAL_CONTEXT)).toBe("1:1:2026-12");
    expect(draftKey({ ...INITIAL_CONTEXT, target: { year: 2026, month: 10 } })).toBe("1:1:2026-10");
  });

  it("v3 draft JSONga va qayta o‘qishga yaroqli, eski v2 ham import qilinadi", () => {
    const { configs } = setup();
    const draft: SharedDraft = createSharedDraft(INITIAL_CONTEXT, configs, [1, 2, 3]);
    expect(draft.audit).toHaveLength(1);
    expect(draft.audit[0]!.action).toBe("created");
    const parsed = parseSharedDraft(JSON.stringify(draft));
    expect(parsed.key).toBe(draft.key);
    expect(parsed.configs["1"]!.defaultFormula.value).toBe(10);
    const legacy = {
      version: 2,
      id: "old",
      name: "Eski draft",
      savedAt: "2026-10-01T10:00:00.000Z",
      input: { context: INITIAL_CONTEXT, configs },
      visibleKpiIds: [1, 2],
      scenarios: []
    };
    const migrated = parseSharedDraft(JSON.stringify(legacy));
    expect(migrated.version).toBe(3);
    expect(migrated.name).toBe("Eski draft");
    expect(migrated.audit[0]!.action).toBe("import");
    expect(migrated.removed).toEqual([]);
    expect(() => parseSharedDraft("{not json")).toThrow("haqiqiy JSON");
    expect(() => parseSharedDraft('{"version":9}')).toThrow("formati");
  });
});
