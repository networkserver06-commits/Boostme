type SupabaseSession = { access_token: string; refresh_token?: string; expires_at?: number };

const STORAGE_KEY = "supabase-auth-session";
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? (import.meta.env.VITE_SUPABASE_KEY as string | undefined);

export function getSupabaseSession(): SupabaseSession | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as SupabaseSession : null;
  } catch { return null; }
}

export function saveSupabaseSession(session: SupabaseSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  if (session.access_token) localStorage.setItem("supabase-access-token", session.access_token);
}

export function clearSupabaseSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("supabase-access-token");
}

export async function refreshSupabaseSession() {
  const current = getSupabaseSession();
  if (!url || !key || !current?.refresh_token) return current;
  if (current.expires_at && current.expires_at * 1000 > Date.now() + 60_000) return current;
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: current.refresh_token }) });
  if (!response.ok) { clearSupabaseSession(); return null; }
  const next = await response.json() as SupabaseSession;
  saveSupabaseSession(next);
  return next;
}
