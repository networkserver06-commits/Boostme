import { supabaseBrowserConfig } from "./supabaseConfig";

export type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
};

type SessionPayload = SupabaseSession & Record<string, unknown>;
const STORAGE_KEY = "supabase-auth-session";
const url = supabaseBrowserConfig?.url;
const key = supabaseBrowserConfig?.key;
let refreshInFlight: Promise<SupabaseSession | null> | null = null;

export function normalizeSupabaseSession(payload: SessionPayload): SupabaseSession | null {
  if (typeof payload.access_token !== "string" || !payload.access_token) return null;
  const expiresIn = Number(payload.expires_in);
  const expiresAt = Number(payload.expires_at);
  return {
    access_token: payload.access_token,
    ...(typeof payload.refresh_token === "string" ? { refresh_token: payload.refresh_token } : {}),
    ...(Number.isFinite(expiresAt) && expiresAt > 0
      ? { expires_at: expiresAt }
      : Number.isFinite(expiresIn) && expiresIn > 0
        ? { expires_at: Math.floor(Date.now() / 1000) + expiresIn }
        : {}),
    ...(typeof payload.token_type === "string" ? { token_type: payload.token_type } : {}),
  };
}

export function getSupabaseSession(): SupabaseSession | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as SessionPayload;
    return normalizeSupabaseSession(parsed);
  } catch {
    return null;
  }
}

export function saveSupabaseSession(payload: SessionPayload) {
  const session = normalizeSupabaseSession(payload);
  if (!session) throw new Error("The authentication service did not return a valid session.");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  localStorage.setItem("supabase-access-token", session.access_token);
  return session;
}

export function clearSupabaseSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("supabase-access-token");
}

/** Save tokens returned by Supabase's implicit recovery link and remove them from browser history. */
export function captureSupabaseSessionFromHash() {
  if (typeof window === "undefined" || !window.location.hash) return false;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const type = params.get("type");
  if (!type || !["recovery", "signup", "magiclink", "invite"].includes(type)) return false;

  const accessToken = params.get("access_token");
  if (!accessToken) return false;
  saveSupabaseSession({
    access_token: accessToken,
    refresh_token: params.get("refresh_token") ?? undefined,
    expires_in: Number(params.get("expires_in")) || undefined,
    token_type: params.get("token_type") ?? undefined,
  });
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  return type;
}

export async function refreshSupabaseSession(): Promise<SupabaseSession | null> {
  if (refreshInFlight) return refreshInFlight;
  const current = getSupabaseSession();
  if (!url || !key || !current?.refresh_token) return current;
  if (current.expires_at && current.expires_at * 1000 > Date.now() + 60_000) return current;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403) clearSupabaseSession();
        return response.status === 400 || response.status === 401 || response.status === 403 ? null : current;
      }
      const next = normalizeSupabaseSession(await response.json() as SessionPayload);
      if (!next) {
        clearSupabaseSession();
        return null;
      }
      return saveSupabaseSession(next);
    } catch {
      // A transient network failure should not erase a still-usable local session.
      return current;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function signOutSupabase() {
  const session = getSupabaseSession();
  if (url && key && session?.access_token) {
    try {
      await fetch(`${url}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // Local sign-out still completes if Supabase is unreachable.
    }
  }
  clearSupabaseSession();
}
