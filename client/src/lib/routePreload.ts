const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/how-to-use": () => import("@/pages/InfoPage"),
  "/terms": () => import("@/pages/InfoPage"),
  "/about": () => import("@/pages/InfoPage"),
  "/dashboard": () => import("@/pages/Dashboard"),
  "/dashboard/new-order": () => import("@/pages/Dashboard"),
  "/dashboard/orders": () => import("@/pages/Dashboard"),
  "/dashboard/wallet": () => import("@/pages/Dashboard"),
  "/dashboard/services": () => import("@/pages/Services"),
  "/dashboard/account": () => import("@/pages/Account"),
  "/admin": () => import("@/pages/Admin"),
};
const inFlightPreloads = new Map<string, Promise<unknown>>();

export function preloadRoute(path: string) {
  const route = path.split(/[?#]/, 1)[0];
  const preload = routePreloaders[route];
  if (!preload || inFlightPreloads.has(route)) return;
  const request = preload().catch(() => undefined);
  inFlightPreloads.set(route, request);
}
