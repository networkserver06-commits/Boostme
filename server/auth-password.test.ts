import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, getUserByEmail, profiles, setTursoClientForTesting, users } from "./db";
import { createTestDatabase } from "./testDb";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { clearAuthAttempts, consumeAuthAttempt, loadSessionUser } from "./_core/passwordAuth";

function createContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const context: TrpcContext = {
    user: null,
    req: { protocol: "https", ip: "192.0.2.5", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => { cookies.push({ name, value, options }); return context.res; },
      clearCookie: (name: string, options: Record<string, unknown>) => { cleared.push({ name, options }); return context.res; },
    } as unknown as TrpcContext["res"],
  };
  return { context, cookies, cleared };
}

let database: Awaited<ReturnType<typeof createTestDatabase>>;
async function setup() {
  database = await createTestDatabase();
  setTursoClientForTesting(database.client);
  return database.db;
}
afterEach(() => { setTursoClientForTesting(null); vi.unstubAllEnvs(); });

describe("Turso-backed authentication", () => {
  it("creates a user/profile, never returns the password hash, sets a secure cookie and promotes ADMIN_EMAIL", async () => {
    const db = await setup();
    vi.stubEnv("ADMIN_EMAIL", " Admin@Example.com ");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURSO_DATABASE_URL", "file::memory:");
    const session = createContext();
    const result = await appRouter.createCaller(session.context).auth.signup({ name: "Administrator", email: "ADMIN@example.com", password: "correct horse battery staple" });
    expect(result.user).toMatchObject({ email: "admin@example.com", role: "admin", loginMethod: "password" });
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(session.cookies).toHaveLength(1);
    expect(session.cookies[0]).toMatchObject({ name: "boostme_session", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
    const tokenUser = await loadSessionUser(session.cookies[0].value);
    expect(tokenUser.user).toMatchObject({ email: "admin@example.com", role: "admin" });
    expect(tokenUser.user).not.toHaveProperty("passwordHash");
    session.context.req.headers.cookie = `boostme_session=${session.cookies[0].value}`;
    await appRouter.createCaller(session.context).auth.logout();
    expect(session.cleared[0]).toMatchObject({ name: "boostme_session", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
    expect((await loadSessionUser(session.cookies[0].value)).user).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });

  it("signs in with the stored password and returns a generic error for wrong credentials", async () => {
    const db = await setup();
    const session = createContext();
    const caller = appRouter.createCaller(session.context);
    await caller.auth.signup({ name: "Member", email: "member@example.com", password: "correct horse battery staple" });
    const [stored] = await db.select().from(users);
    expect(await getUserByEmail("member@example.com")).toMatchObject({ id: stored.id });
    const signedIn = await caller.auth.signin({ email: "MEMBER@example.com", password: "correct horse battery staple" });
    expect(signedIn.user.email).toBe("member@example.com");
    await expect(caller.auth.signin({ email: "member@example.com", password: "incorrect password" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
  });

  it("rejects duplicate registrations without creating a second user", async () => {
    const db = await setup();
    const caller = appRouter.createCaller(createContext().context);
    await caller.auth.signup({ name: "Member", email: "member@example.com", password: "correct horse battery staple" });
    await expect(caller.auth.signup({ name: "Member 2", email: "MEMBER@example.com", password: "another secure password" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await db.select().from(users).where(eq(users.email, "member@example.com"))).toHaveLength(1);
  });

  it("keeps one user and one profile when equivalent-email signups race", async () => {
    const db = await setup();
    const callers = [createContext(), createContext()].map(({ context }) => appRouter.createCaller(context));
    const results = await Promise.allSettled([
      callers[0].auth.signup({ name: "First", email: "Race@example.com", password: "correct horse battery staple" }),
      callers[1].auth.signup({ name: "Second", email: " race@EXAMPLE.com ", password: "another secure password" }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : undefined).toMatchObject({ code: "CONFLICT" });
    expect(await db.select().from(users).where(eq(users.email, "race@example.com"))).toHaveLength(1);
    expect(await db.select().from(profiles)).toHaveLength(1);
  });

  it("enforces a persistent 15-minute login-attempt limit and resets it after the window", async () => {
    await setup();
    const now = Date.now();
    const allowed = await Promise.all(Array.from({ length: 10 }, () => consumeAuthAttempt("Member@example.com", "192.0.2.5", now)));
    expect(allowed.every(Boolean)).toBe(true);
    await expect(consumeAuthAttempt("member@example.com", "192.0.2.5", now)).resolves.toBe(false);
    await clearAuthAttempts("MEMBER@example.com", "192.0.2.5");
    await expect(consumeAuthAttempt("member@example.com", "192.0.2.5", now)).resolves.toBe(true);
    await expect(consumeAuthAttempt("member@example.com", "192.0.2.5", now + 16 * 60 * 1000)).resolves.toBe(true);
  });
});
