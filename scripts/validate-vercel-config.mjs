import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
if (config.functions) throw new Error("functions cannot be used with builds");
if (!Array.isArray(config.builds) || config.builds.length < 2) throw new Error("Expected Node and static build declarations");
const nodeBuild = config.builds.find((build) => build.use === "@vercel/node");
if (!Array.isArray(nodeBuild?.config?.includeFiles) || !nodeBuild.config.includeFiles.includes("dist/app.js")) {
  throw new Error("@vercel/node must include dist/app.js via build config");
}
if (!Array.isArray(config.crons) || config.crons.length !== 2) throw new Error("Expected catalog and order cron declarations");
console.log("vercel-config-ok");
