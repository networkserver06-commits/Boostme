import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
if (config.functions) throw new Error("functions cannot be used with builds");
if (!Array.isArray(config.builds) || config.builds.length < 2) throw new Error("Expected Node and static build declarations");
if (!Array.isArray(config.crons) || config.crons.length !== 2) throw new Error("Expected catalog and order cron declarations");
console.log("vercel-config-ok");
