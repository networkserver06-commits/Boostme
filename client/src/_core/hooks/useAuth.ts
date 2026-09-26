import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { signOutSupabase } from "@/lib/supabaseAuth";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = { redirectOnUnauthenticated?: boolean; redirectPath?: string };

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const refresh = useCallback(() => meQuery.refetch(), [meQuery.refetch]);
  const logout = useCallback(async () => {
    await signOutSupabase();
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [meQuery.data, meQuery.error, meQuery.isLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || meQuery.isLoading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.href = redirectPath;
    else startLogin(window.location.pathname + window.location.search);
  }, [redirectOnUnauthenticated, redirectPath, meQuery.isLoading, state.user]);

  return { ...state, refresh, logout };
}
