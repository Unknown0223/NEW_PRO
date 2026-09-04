import { describe, expect, it } from "vitest";
import {
  isSessionJournalErrorCode,
  shouldPersistBackendError,
  shouldSkipErrorEventPath
} from "../src/lib/error-event";

describe("error-event persist rules", () => {
  it("skips login/refresh paths for ordinary errors", () => {
    expect(shouldSkipErrorEventPath("/api/auth/refresh")).toBe(true);
    expect(shouldSkipErrorEventPath("/api/auth/login")).toBe(true);
    expect(shouldPersistBackendError(401, "/api/auth/refresh")).toBe(false);
    expect(shouldPersistBackendError(401, "/api/auth/me")).toBe(false);
  });

  it("journals SESSION_REVOKED even as 401 on /auth/me", () => {
    expect(isSessionJournalErrorCode("SESSION_REVOKED")).toBe(true);
    expect(shouldPersistBackendError(401, "/api/auth/me", "SESSION_REVOKED")).toBe(true);
    expect(shouldPersistBackendError(401, "/api/test1/mobile/sync", "SESSION_REVOKED")).toBe(true);
  });

  it("journals INVALID_REFRESH even on skipped refresh path", () => {
    expect(shouldPersistBackendError(401, "/api/auth/refresh", "INVALID_REFRESH")).toBe(true);
    expect(shouldPersistBackendError(401, "/auth/refresh", "INVALID_REFRESH")).toBe(true);
  });

  it("does not journal generic 401", () => {
    expect(shouldPersistBackendError(401, "/api/test1/orders", "Unauthorized")).toBe(false);
  });
});
