import { describe, expect, it } from "vitest";
import { activityPathInfo } from "@/lib/activity-path-map";

describe("activityPathInfo — path → module/section/entity", () => {
  it("zakaz ro'yxati va detal", () => {
    expect(activityPathInfo("/orders")).toEqual({ module: "orders", section: "zakaz" });
    expect(activityPathInfo("/orders/123")).toEqual({
      module: "orders",
      section: "zakaz",
      entityType: "order",
      entityId: "123"
    });
    expect(activityPathInfo("/orders/123/history")).toEqual({
      module: "orders",
      section: "zakaz",
      entityType: "order",
      entityId: "123"
    });
  });

  it("mijozlar va xodimlar", () => {
    expect(activityPathInfo("/clients/45")).toMatchObject({ module: "clients", entityType: "client", entityId: "45" });
    expect(activityPathInfo("/staff")).toMatchObject({ module: "staff", section: "agent" });
    expect(activityPathInfo("/users/7")).toMatchObject({ module: "staff", entityType: "user", entityId: "7" });
  });

  it("kassa/sklad/postavshchik/dostup", () => {
    expect(activityPathInfo("/payments")).toMatchObject({ module: "cash" });
    expect(activityPathInfo("/payments/55")).toMatchObject({ module: "cash", entityType: "payment", entityId: "55" });
    expect(activityPathInfo("/stock")).toMatchObject({ module: "warehouse" });
    expect(activityPathInfo("/suppliers")).toMatchObject({ module: "suppliers" });
    expect(activityPathInfo("/access")).toMatchObject({ module: "access", section: "upravlenie" });
  });

  it("qaytarishlar sales_return entity bilan", () => {
    expect(activityPathInfo("/returns")).toMatchObject({ module: "orders", section: "vozvrat" });
    expect(activityPathInfo("/returns/12")).toMatchObject({
      module: "orders",
      section: "vozvrat",
      entityType: "sales_return",
      entityId: "12"
    });
  });

  it("ildiz → dashboard, noma'lum yo'l → null", () => {
    expect(activityPathInfo("/")).toEqual({ module: "dashboard", section: "prodazhi" });
    expect(activityPathInfo("/some-unknown-page")).toBeNull();
    expect(activityPathInfo("/finance/secret")).toBeNull();
  });

  it("query/hash inobatga olinmaydi", () => {
    expect(activityPathInfo("/orders/123?tab=items#top")).toMatchObject({ entityId: "123" });
  });
});
