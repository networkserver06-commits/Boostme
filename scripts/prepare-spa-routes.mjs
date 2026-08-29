import { copyFile, mkdir } from "node:fs/promises";

const outputDir = new URL("../dist/public/", import.meta.url);
const source = new URL("index.html", outputDir);

for (const route of ["auth", "admin", "dashboard"]) {
  await mkdir(new URL(`${route}/`, outputDir), { recursive: true });
  await copyFile(source, new URL(`${route}/index.html`, outputDir));
  await copyFile(source, new URL(`${route}.html`, outputDir));
}

console.log("spa-route-artifacts-ok");
