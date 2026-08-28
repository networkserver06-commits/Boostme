import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const includeFiles = config.functions?.["api/[...path].ts"]?.includeFiles;
if (typeof includeFiles !== "string") throw new Error("functions.api/[...path].ts.includeFiles must be a string");
if (includeFiles !== "dist/app.js") throw new Error(`Unexpected includeFiles value: ${includeFiles}`);
if (!Array.isArray(config.crons) || config.crons.length !== 2) throw new Error("Expected catalog and order cron declarations");
console.log("vercel-config-ok");
