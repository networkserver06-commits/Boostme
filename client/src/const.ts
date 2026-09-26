import { safeAuthReturnPath } from "@/lib/authRouting";

export const startLogin = (returnTo?: string) => {
  if (typeof window === "undefined") return;
  const next = safeAuthReturnPath(returnTo ?? window.location.pathname + window.location.search);
  window.location.assign(`/auth?next=${encodeURIComponent(next)}`);
};
