import { describe, expect, it } from "vitest";
import { lalakuNewClientTemplateHeaders } from "./excel.js";

describe("excel import template", () => {
  it("matches SALEC Lalaku new-client headers and 10 agent slots", () => {
    const h = lalakuNewClientTemplateHeaders();
    expect(h[0]).toBe("ИД");
    expect(h[1]).toBe("Наименование");
    expect(h[9]).toBe("Торговый канал (код)");
    expect(h[14]).toBe("Широта");
    expect(h[15]).toBe("Долгота");
    expect(h[16]).toBe("Агент 1");
    expect(h[17]).toBe("Агент 1 день");
    expect(h[18]).toBe("Экспедитор 1");
    expect(h).toHaveLength(16 + 10 * 3);
  });
});
