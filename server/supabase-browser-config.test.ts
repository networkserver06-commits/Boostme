import { describe, expect, it } from "vitest";
import { resolveSupabaseBrowserConfig } from "../client/src/lib/supabaseConfig";

describe("resolveSupabaseBrowserConfig", () => {
  it("accepts the existing NEXT_PUBLIC Supabase names", () => {
    expect(resolveSupabaseBrowserConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    })).toEqual({ url: "https://example.supabase.co", key: "anon-key" });
  });

  it("prefers VITE names when both public naming conventions exist", () => {
    expect(resolveSupabaseBrowserConfig({
      VITE_SUPABASE_URL: "https://vite.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "vite-anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://next.supabase.co/",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "next-anon-key",
    })).toEqual({ url: "https://vite.supabase.co", key: "vite-anon-key" });
  });

  it("does not use server-only variables as browser credentials", () => {
    expect(resolveSupabaseBrowserConfig({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    })).toBeNull();
  });
});
