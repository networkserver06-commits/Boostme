import { describe, expect, it } from "vitest";
import { normalizeSupabaseSession } from "../client/src/lib/supabaseAuth";

describe("Supabase session normalization", () => {
  it("derives an expiry timestamp from expires_in", () => {
    const now = Math.floor(Date.now() / 1000);
    const session = normalizeSupabaseSession({ access_token: "access", refresh_token: "refresh", expires_in: 3600 });
    expect(session?.access_token).toBe("access");
    expect(session?.refresh_token).toBe("refresh");
    expect(session?.expires_at).toBeGreaterThanOrEqual(now + 3599);
    expect(session?.expires_at).toBeLessThanOrEqual(now + 3601);
  });

  it("preserves an explicit expiry and rejects payloads without an access token", () => {
    expect(normalizeSupabaseSession({ access_token: "access", expires_at: 1_800_000_000 })?.expires_at).toBe(1_800_000_000);
    expect(normalizeSupabaseSession({})).toBeNull();
  });
});
