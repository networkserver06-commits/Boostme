import { copyFile, mkdir } from "node:fs/promises";

const outputDir = new URL("../dist/public/", import.meta.url);
const source = new URL("index.html", outputDir);
const routes = [
  "auth",
  "admin",
  "how-to-use",
  "terms",
  "about",
  "dashboard",
  "dashboard/new-order",
  "dashboard/order",
  "dashboard/place-order",
  "dashboard/services",
  "dashboard/orders",
  "dashboard/wallet",
  "dashboard/account",
];

for (const route of routes) {
  const routeDir = new URL(`${route}/`, outputDir);
  await mkdir(routeDir, { recursive: true });
  await copyFile(source, new URL("index.html", routeDir));
  if (!route.includes("/")) await copyFile(source, new URL(`${route}.html`, outputDir));
}

console.log(`spa-route-artifacts-ok (${routes.length} routes)`);
