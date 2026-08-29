import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
if (config.builds || config.functions) throw new Error("Legacy builds/functions configuration must be absent");
if (config.buildCommand !== "pnpm build") throw new Error("Expected pnpm build command");
if (config.outputDirectory !== "dist/public") throw new Error("Expected dist/public output directory");
if (!Array.isArray(config.rewrites) || config.rewrites[0]?.destination !== "/index.html") {
  throw new Error("Expected SPA fallback rewrite");
}
if (!Array.isArray(config.crons) || config.crons.length !== 2) throw new Error("Expected catalog and order cron declarations");
const apiSource = await readFile(new URL("../api/[...path].ts", import.meta.url), "utf8");
if (apiSource.includes("server/_core/index") || !apiSource.includes("../server/app.ts")) {
  throw new Error("API entrypoint must bundle server/app.ts directly");
}
console.log("vercel-config-ok");
