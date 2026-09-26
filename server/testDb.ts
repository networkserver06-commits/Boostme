import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../drizzle/schema";
import { initializeTursoSchema } from "./db";

export async function createTestDatabase() {
  const client = createClient({ url: "file::memory:" });
  await initializeTursoSchema(client);
  const db = drizzle(client, { schema: schema.drizzleSchema });
  return { client, db };
}

export async function createTestDb() {
  const { db } = await createTestDatabase();
  return db;
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;
export type TestDb = TestDatabase["db"];
export type TestClient = Client;
