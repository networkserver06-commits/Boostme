import { defineConfig } from "drizzle-kit";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required to run Drizzle commands");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/turso",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN ?? "",
  },
});
