import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureEnvironmentProvider } from "./db";

const makeDb = (rows: any[] = []) => {
  const inserted: any[] = [];
  const db = {
    from: (table: string) => ({
      select: () => ({
        where: (filter: any) => ({
          limit: async () => rows.filter((row) => row[filter.field] === filter.value).slice(0, 1),
        }),
      }),
      insert: async (values: any) => {
        inserted.push({ table, values });
        return [{ id: 9, ...values }];
      },
    }),
  };
  return { db: db as any, inserted };
};

afterEach(() => vi.unstubAllEnvs());

describe("ensureEnvironmentProvider", () => {
  it("creates ShakerGain from server-only BASE_URL and API_KEY when no provider is active", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2/");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const fixture = makeDb();

    await expect(ensureEnvironmentProvider(fixture.db)).resolves.toMatchObject({
      id: 9,
      name: "ShakerGain",
      apiUrl: "https://shakergainske.com/api/v2",
      apiKey: "server-only-provider-key",
      isActive: true,
    });
    expect(fixture.inserted).toHaveLength(1);
  });

  it("keeps an existing active provider ahead of environment bootstrap", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const fixture = makeDb([{ id: 2, name: "Existing", apiUrl: "https://existing.example/api", apiKey: "existing-key", isActive: true }]);

    await expect(ensureEnvironmentProvider(fixture.db)).resolves.toMatchObject({ id: 2, name: "Existing" });
    expect(fixture.inserted).toHaveLength(0);
  });

  it("does not silently reactivate a paused matching provider", async () => {
    vi.stubEnv("BASE_URL", "https://shakergainske.com/api/v2");
    vi.stubEnv("API_KEY", "server-only-provider-key");
    const paused = { id: 3, name: "ShakerGain", apiUrl: "https://shakergainske.com/api/v2", apiKey: "old-key", isActive: false };
    const fixture = makeDb([paused]);

    await expect(ensureEnvironmentProvider(fixture.db)).resolves.toBeNull();
    expect(fixture.inserted).toHaveLength(0);
  });
});
