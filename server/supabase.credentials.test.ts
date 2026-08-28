import { describe, expect, it } from "vitest";

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !key)("Supabase credentials", () => {
  it("authenticate against the application REST endpoint", async () => {
    const response = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key!, Authorization: `Bearer ${key!}` },
    });
    expect(response.ok, `Supabase REST credential check returned HTTP ${response.status}`).toBe(true);
  });
});
