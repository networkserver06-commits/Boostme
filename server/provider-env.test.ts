import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, smmProviders } from "./db";
import { createTestDb } from "./testDb";
import { ensureEnvironmentProvider } from "./db";

afterEach(() => vi.unstubAllEnvs());

describe("ensureEnvironmentProvider using Turso", () => {
  it("creates ShakerGain from server-only BASE_URL and API_KEY when no provider is active", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2/");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const db = await createTestDb();
    await expect(ensureEnvironmentProvider(db)).resolves.toMatchObject({ name: "ShakerGain", apiUrl: "https://shakergainske.com/api/v2", apiKey: "server-only-provider-key", isActive: 1 });
    expect(await db.select().from(smmProviders)).toHaveLength(1);
  });

  it("keeps an existing active provider ahead of environment bootstrap", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const db = await createTestDb();
    const [existing] = await db.insert(smmProviders).values({ name: "Existing", apiUrl: "https://existing.example/api", apiKey: "existing-key", isActive: 1 }).returning();
    await expect(ensureEnvironmentProvider(db)).resolves.toMatchObject({ id: existing.id, name: "Existing" });
    expect(await db.select().from(smmProviders)).toHaveLength(1);
  });

  it("does not silently reactivate a paused matching provider", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const db = await createTestDb();
    await db.insert(smmProviders).values({ name: "ShakerGain", apiUrl: "https://shakergainske.com/api/v2", apiKey: "old-key", isActive: 0 });
    await expect(ensureEnvironmentProvider(db)).resolves.toBeNull();
    expect(await db.select().from(smmProviders).where(eq(smmProviders.isActive, 1))).toHaveLength(0);
  });
});
