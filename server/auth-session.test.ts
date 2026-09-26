import { describe, expect, it } from "vitest";
import { hashPassword, normalizeEmail, readSessionToken, tokenDigest, verifyPassword } from "./_core/passwordAuth";
import type { Request } from "express";

function request(cookie?: string) {
  return { headers: { cookie } } as Request;
}

describe("app-managed password auth", () => {
  it("stores salted scrypt hashes and verifies them without storing plaintext", async () => {
    const first = await hashPassword("correct horse battery staple");
    const second = await hashPassword("correct horse battery staple");
    expect(first).not.toBe(second);
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    await expect(verifyPassword("correct horse battery staple", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", first)).resolves.toBe(false);
    await expect(verifyPassword("anything", undefined)).resolves.toBe(false);
  });

  it("normalizes email and hashes opaque cookie tokens before database storage", () => {
    expect(normalizeEmail("  Example@Example.COM ")).toBe("example@example.com");
    expect(tokenDigest("session-token")).not.toContain("session-token");
    expect(tokenDigest("session-token")).toHaveLength(64);
  });

  it("accepts only the application session cookie format", () => {
    expect(readSessionToken(request("other=value"))).toBeNull();
    expect(readSessionToken(request("boostme_session=short"))).toBeNull();
    expect(readSessionToken(request(`boostme_session=${"a".repeat(43)}`))).toBe("a".repeat(43));
  });
});
