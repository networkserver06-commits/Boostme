import { describe, expect, it } from "vitest";
import { friendlyErrorMessage, isUnauthorizedError } from "../shared/errorMessages";

describe("user-facing API errors", () => {
  it("does not leak technical error details for internal failures", () => {
    const failure = Object.assign(new Error("SQLITE_BUSY at /var/private/db"), { data: { code: "INTERNAL_SERVER_ERROR" } });
    expect(friendlyErrorMessage(failure, "Try again later.")).toBe("Try again later.");
  });

  it("turns browser fetch errors into actionable connection guidance", () => {
    expect(friendlyErrorMessage(new TypeError("Failed to fetch"))).toContain("Check your internet");
  });

  it("preserves safe validation/conflict text and recognizes unauthorized API responses", () => {
    const conflict = Object.assign(new Error("An account with this email already exists. Sign in instead."), { data: { code: "CONFLICT" } });
    const denied = { data: { code: "UNAUTHORIZED" } };
    expect(friendlyErrorMessage(conflict)).toBe(conflict.message);
    expect(isUnauthorizedError(denied)).toBe(true);
    expect(isUnauthorizedError(new Error("socket reset"))).toBe(false);
  });
});
