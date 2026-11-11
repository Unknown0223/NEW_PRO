import { describe, expect, it } from "vitest";
import { parseTrustProxyRaw } from "../src/lib/trust-proxy";

describe("parseTrustProxyRaw", () => {
  it("defaults by environment when empty", () => {
    expect(parseTrustProxyRaw(undefined, "test")).toBe(false);
    expect(parseTrustProxyRaw("", "development")).toBe(false);
    expect(parseTrustProxyRaw(undefined, "production")).toBe(1);
  });

  it("parses boolean-like and hop count", () => {
    expect(parseTrustProxyRaw("true", "test")).toBe(true);
    expect(parseTrustProxyRaw("false", "test")).toBe(false);
    expect(parseTrustProxyRaw("2", "test")).toBe(2);
  });

  it("parses CIDR / IP list", () => {
    expect(parseTrustProxyRaw("10.0.0.0/8, 192.168.0.1", "test")).toEqual([
      "10.0.0.0/8",
      "192.168.0.1"
    ]);
  });
});
