import { describe, expect, it } from "vitest";
import { isEmailNotConfirmedError } from "../client/src/lib/authError";

describe("Supabase email confirmation errors", () => {
  it("recognizes the structured not-confirmed error code", () => {
    expect(isEmailNotConfirmedError({ error_code: "email_not_confirmed" })).toBe(true);
  });

  it("recognizes the human-readable Supabase message", () => {
    expect(isEmailNotConfirmedError({ message: "Email not confirmed" })).toBe(true);
  });

  it("does not classify invalid credentials as confirmation errors", () => {
    expect(isEmailNotConfirmedError({ error: "invalid_grant", error_description: "Invalid login credentials" })).toBe(false);
  });
});
