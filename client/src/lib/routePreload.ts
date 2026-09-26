const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/dashboard/orders": () => import("@/pages/Dashboard"),
  "/dashboard/wallet": () => import("@/pages/Dashboard"),
  "/dashboard/services": () => import("@/pages/Services"),
  "/dashboard/account": () => import("@/pages/Account"),
  "/admin": () => import("@/pages/Admin"),
};

export function preloadRoute(path: string) {
  const route = path.split(/[?#]/, 1)[0];
  const preload = routePreloaders[route];
  if (preload) void preload().catch(() => undefined);
}
