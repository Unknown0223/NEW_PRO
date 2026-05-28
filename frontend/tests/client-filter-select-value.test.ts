import { describe, expect, it } from "vitest";
import {
  CLIENT_FILTER_MULTI_SEP,
  appendPositiveIntListParam,
  joinMultiFilterValues,
  parseTristateUi,
  splitMultiFilterValues,
  tristateToUi
} from "@/lib/client-filter-select-value";

describe("client-filter-select-value", () => {
  it("join/split multi with pipe separator", () => {
    expect(joinMultiFilterValues(["3", "1", "3"])).toBe(`1${CLIENT_FILTER_MULTI_SEP}3`);
    expect(splitMultiFilterValues(`1${CLIENT_FILTER_MULTI_SEP}3`)).toEqual(["1", "3"]);
  });

  it("split legacy comma-separated ids", () => {
    expect(splitMultiFilterValues("5,7")).toEqual(["5", "7"]);
  });

  it("tristate maps all/empty to filter off", () => {
    expect(parseTristateUi([])).toBe("");
    expect(parseTristateUi(["all"])).toBe("");
    expect(parseTristateUi(["yes"])).toBe("yes");
    expect(tristateToUi("")).toEqual([]);
    expect(tristateToUi("no")).toEqual(["no"]);
  });

  it("appendPositiveIntListParam uses single or multi query keys", () => {
    const one = new URLSearchParams();
    appendPositiveIntListParam(one, "agent_id", "agent_ids", "42");
    expect(one.get("agent_id")).toBe("42");
    expect(one.get("agent_ids")).toBeNull();

    const many = new URLSearchParams();
    appendPositiveIntListParam(many, "agent_id", "agent_ids", `1${CLIENT_FILTER_MULTI_SEP}2`);
    expect(many.get("agent_id")).toBeNull();
    expect(many.get("agent_ids")).toBe("1,2");
  });
});
