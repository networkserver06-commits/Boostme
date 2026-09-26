import { describe, expect, it } from "vitest";
import { getSupabaseCallbackError, isEmailNotConfirmedError } from "../client/src/lib/authError";
import { buildSupabaseAuthRedirect } from "../client/src/lib/authRouting";

describe("Supabase email auth callbacks", () => {
  it("builds the confirmation URL with a safe dashboard return path", () => {
    expect(buildSupabaseAuthRedirect("https://boost.leetec.online", "/dashboard/orders?status=pending"))
      .toBe("https://boost.leetec.online/auth?next=%2Fdashboard%2Forders%3Fstatus%3Dpending");
  });

  it("adds reset mode while keeping recovery redirects on the auth page", () => {
    expect(buildSupabaseAuthRedirect("https://boost.leetec.online", "/dashboard", "reset"))
      .toBe("https://boost.leetec.online/auth?next=%2Fdashboard&mode=reset");
  });

  it("falls back to the workspace for an unsafe return destination", () => {
    expect(buildSupabaseAuthRedirect("https://boost.leetec.online", "https://evil.example"))
      .toBe("https://boost.leetec.online/auth?next=%2Fdashboard");
  });

  it("explains expired verification links without exposing callback tokens", () => {
    expect(getSupabaseCallbackError("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"))
      .toContain("expired or was already used");
    expect(getSupabaseCallbackError("?mode=reset", "#error=access_denied&error_code=otp_expired"))
      .toContain("expired or was already used");
    expect(getSupabaseCallbackError("?next=%2Fdashboard")).toBeNull();
    expect(getSupabaseCallbackError("?code=successful-confirmation-code")).toBeNull();
  });

  it("recognizes modern Supabase email-confirmation response codes", () => {
    expect(isEmailNotConfirmedError({ code: "email_not_verified" })).toBe(true);
    expect(isEmailNotConfirmedError({ error_code: "email_not_confirmed" })).toBe(true);
  });
});
