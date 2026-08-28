import { describe, expect, it } from "vitest";
import { createOAuthStartUrl } from "./_core/oauth";
import type { Request } from "express";

function request(headers: Record<string, string>, protocol = "https") {
  return {
    protocol,
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as unknown as Request;
}

describe("OAuth start URL", () => {
  it("uses the forwarded custom-domain origin for the callback", () => {
    const url = createOAuthStartUrl(
      request({ host: "boost.leetec.online", "x-forwarded-proto": "https" }),
      "test-nonce"
    );
    expect(url.pathname).toBe("/app-auth");
    expect(url.origin).toBe(new URL(process.env.VITE_OAUTH_PORTAL_URL ?? process.env.OAUTH_SERVER_URL ?? "https://api.manus.im").origin);
    expect(url.searchParams.get("redirectUri")).toBe("https://boost.leetec.online/api/oauth/callback");
    expect(url.searchParams.get("type")).toBe("signIn");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("prefers the first forwarded protocol when a proxy sends a list", () => {
    const url = createOAuthStartUrl(
      request({ host: "boost.leetec.online", "x-forwarded-proto": "https, http" }),
      "test-nonce"
    );
    expect(url.searchParams.get("redirectUri")).toBe("https://boost.leetec.online/api/oauth/callback");
  });
});
