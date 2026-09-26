import { describe, expect, it } from "vitest";
import { safeAuthReturnPath } from "../client/src/lib/authRouting";

describe("safe post-login routing", () => {
  it("preserves valid dashboard subroutes and query strings", () => {
    expect(safeAuthReturnPath("/dashboard/orders?status=pending")).toBe("/dashboard/orders?status=pending");
  });

  it("allows the admin page as an in-app destination", () => {
    expect(safeAuthReturnPath("/admin")).toBe("/admin");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/auth", "/unknown", null, ""]) (
    "falls back for unsafe or unsupported destination %s",
    (candidate) => {
      expect(safeAuthReturnPath(candidate)).toBe("/dashboard");
    },
  );
});
