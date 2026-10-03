import { afterEach, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { initializeTursoSchema } from "./db";

describe("order lifecycle schema migration", () => {
  it("adds lifecycle columns to the old schema and recognizes only the documented provider domain", async () => {
    const client = createClient({ url: "file::memory:" });
    await client.batch([
      { sql: "CREATE TABLE smm_providers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, api_url TEXT NOT NULL, api_key TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, last_sync_at INTEGER, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))" },
      { sql: "CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, service_id INTEGER NOT NULL, provider_order_id TEXT, target_link TEXT NOT NULL, quantity INTEGER NOT NULL, charge TEXT NOT NULL, start_count INTEGER, remains INTEGER, status TEXT NOT NULL DEFAULT 'pending', error_message TEXT, created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))" },
      { sql: "INSERT INTO smm_providers (name, api_url, api_key) VALUES ('Known', 'https://shakergainske.com/api/v2', 'test-only')" },
      { sql: "INSERT INTO smm_providers (name, api_url, api_key) VALUES ('Other', 'https://provider.example/api', 'test-only')" },
    ], "write");

    try {
      await initializeTursoSchema(client);
      const providerRows = await client.execute("SELECT name, supports_cancel FROM smm_providers ORDER BY id");
      const orderColumns = await client.execute("PRAGMA table_info(orders)");
      expect(providerRows.rows.map((row) => Number(row.supports_cancel))).toEqual([1, 0]);
      expect(orderColumns.rows.map((row) => String(row.name))).toEqual(expect.arrayContaining(["cancel_requested_at", "cancel_request_status", "last_provider_check_at"]));
    } finally {
      client.close();
    }
  });
});
