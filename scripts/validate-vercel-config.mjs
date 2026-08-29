import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
if (config.builds) throw new Error("Legacy builds configuration must be absent");
if (config.functions?.["api/[...path].ts"]?.includeFiles !== "dist/app.js") throw new Error("API function must include dist/app.js as a string");
if (config.buildCommand !== "pnpm build") throw new Error("Expected pnpm build command");
if (config.outputDirectory !== "dist/public") throw new Error("Expected dist/public output directory");
if (!Array.isArray(config.rewrites) || config.rewrites.length < 5) {
  throw new Error("Expected explicit SPA route fallbacks");
}
if (config.rewrites[0]?.source !== "/api/(.*)" || config.rewrites[0]?.destination !== "/api/[...path]") {
  throw new Error("Expected API rewrite before SPA fallbacks");
}
for (const path of ["/auth", "/admin", "/dashboard", "/(.*)"]) {
  const rewrite = config.rewrites.find((entry) => entry.source === path);
  if (rewrite?.destination !== "/index.html") throw new Error(`Missing SPA fallback for ${path}`);
}
if (!Array.isArray(config.crons) || config.crons.length !== 1) throw new Error("Expected one Hobby-compatible daily cron declaration");
if (config.crons[0]?.schedule !== "0 3 * * *") throw new Error("Cron must run once daily at 03:00 UTC");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
if (!packageJson.scripts.build.includes("prepare-spa-routes.mjs")) throw new Error("Build must prepare physical SPA routes");
const apiSource = await readFile(new URL("../api/[...path].ts", import.meta.url), "utf8");
if (apiSource.includes("server/_core/index") || !apiSource.includes("../dist/app.js")) {
  throw new Error("API entrypoint must import the bundled dist/app.js artifact");
}
console.log("vercel-config-ok");
