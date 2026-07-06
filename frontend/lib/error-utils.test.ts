import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { getUserFacingError, isApiUnreachable, withApiSupportLine } from "./error-utils";

describe("isApiUnreachable", () => {
  it("true for network axios error", () => {
    const e = new AxiosError("Network Error", "ERR_NETWORK");
    expect(isApiUnreachable(e)).toBe(true);
  });

  it("false when response exists", () => {
    const e = new AxiosError("Server said no");
    e.response = {
      status: 500,
      data: {},
      statusText: "err",
      headers: {},
      config: {} as never
    };
    expect(isApiUnreachable(e)).toBe(false);
  });

  it("false for non-axios", () => {
    expect(isApiUnreachable(new Error("x"))).toBe(false);
  });
});

describe("getUserFacingError", () => {
  it("uses server message", () => {
    const e = new AxiosError("fail");
    e.response = {
      status: 400,
      data: { message: "Bad input" },
      statusText: "Bad",
      headers: {},
      config: {} as never
    };
    expect(getUserFacingError(e)).toBe("Bad input");
  });

  it("uses server error field when message absent", () => {
    const e = new AxiosError("Request failed with status code 400");
    e.response = {
      status: 400,
      data: { error: "Something went wrong" },
      statusText: "Bad",
      headers: {},
      config: {} as never
    };
    expect(getUserFacingError(e, "F")).toBe("Something went wrong");
  });

  it("401 mapping", () => {
    const e = new AxiosError("Unauthorized");
    e.response = {
      status: 401,
      data: {},
      statusText: "Unauthorized",
      headers: {},
      config: {} as never
    };
    expect(getUserFacingError(e)).toContain("Сессия");
  });

  it("fallback", () => {
    expect(getUserFacingError("x", "F")).toBe("F");
  });

  it("does NOT append support reference for user errors (4xx)", () => {
    const e = new AxiosError("fail");
    e.response = {
      status: 400,
      data: { message: "Bad input" },
      statusText: "Bad",
      headers: { "x-request-id": "abc-xyz" },
      config: {} as never
    };
    expect(getUserFacingError(e)).toBe("Bad input");
  });

  it("appends support reference for server errors (5xx) from headers", () => {
    const e = new AxiosError("fail");
    e.response = {
      status: 500,
      data: { message: "Server boom" },
      statusText: "Server Error",
      headers: { "x-request-id": "abc-xyz" },
      config: {} as never
    };
    expect(getUserFacingError(e)).toBe("Server boom — Код для поддержки: abc-xyz");
  });

  it("appends support reference for server errors from JSON requestId", () => {
    const e = new AxiosError("fail");
    e.response = {
      status: 500,
      data: { message: "Not valid", requestId: "json-rid-1" },
      statusText: "Server Error",
      headers: {},
      config: {} as never
    };
    expect(getUserFacingError(e)).toBe("Not valid — Код для поддержки: json-rid-1");
  });

  it("friendly message when server is unreachable", () => {
    const e = new AxiosError("Network Error", "ERR_NETWORK");
    expect(getUserFacingError(e)).toContain("Нет связи с сервером");
  });
});

describe("withApiSupportLine", () => {
  it("appends support line when requestId exists on axios error", () => {
    const e = new AxiosError("fail");
    e.response = {
      status: 400,
      data: {},
      statusText: "Bad",
      headers: { "x-request-id": "rid-99" },
      config: {} as never
    };
    expect(withApiSupportLine("Custom", e)).toBe("Custom — Код для поддержки: rid-99");
  });

  it("returns base unchanged when no requestId", () => {
    expect(withApiSupportLine("Only", new Error("x"))).toBe("Only");
  });
});
