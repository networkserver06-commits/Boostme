import { describe, expect, it, vi } from "vitest";
import { executeProviderSync } from "./scheduled";

const dbFixture = (provider: any, rows: any[] = []) => {
  const updates: any[] = [];
  return {
    updates,
    from: (table: string) => {
      if (table === "smm_providers") return { select: () => ({ where: () => ({ limit: async () => provider ? [provider] : [] }) }), update: (values: any) => ({ where: async () => updates.push({ table, values }) }) };
      if (table === "services") return { select: () => ({ where: () => ({ limit: async () => rows.filter((row) => row.providerServiceId) }) }), insert: async (values: any) => { updates.push({ table, values }); return [{ id: 7 }]; }, update: (values: any) => ({ where: async () => updates.push({ table, values }) }) };
      if (table === "sync_runs") return { insert: async () => [{ id: 12 }], update: (values: any) => ({ where: async () => updates.push({ table, values }) }) };
      return { insert: async () => [], update: () => ({ where: async () => undefined }), select: async () => [] };
    },
  };
};

describe("manual provider synchronization", () => {
  it("imports the provider catalog and closes the sync run", async () => {
    const db = dbFixture({ id: 3, apiUrl: "https://provider.example", apiKey: "secret" });
    const result = await executeProviderSync("catalog", { actorUserId: 9, getDb: vi.fn().mockResolvedValue(db), fetchProviderServices: vi.fn().mockResolvedValue([{ service: "42", name: "Views", category: "Instagram Views", rate: "10", min: "100", max: "100000" }]), recordAudit: vi.fn() });
    expect(result).toMatchObject({ runId: 12, processed: 1 });
    expect(db.updates.some((entry) => entry.table === "services")).toBe(true);
    expect(db.updates.some((entry) => entry.values?.status === "completed")).toBe(true);
  });

  it("returns a no-provider result without calling the provider API", async () => {
    const db = dbFixture(null);
    const fetchProviderServices = vi.fn();
    const result = await executeProviderSync("catalog", { getDb: vi.fn().mockResolvedValue(db), fetchProviderServices, recordAudit: vi.fn() });
    expect(result).toMatchObject({ runId: 12, processed: 0, skipped: "no-provider" });
    expect(fetchProviderServices).not.toHaveBeenCalled();
  });
});
