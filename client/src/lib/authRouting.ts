const DEFAULT_RETURN_PATH = "/dashboard";

/** Accept only in-app workspace routes; never allow an external/open redirect. */
export function safeAuthReturnPath(candidate: string | null | undefined) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DEFAULT_RETURN_PATH;
  }

  try {
    const parsed = new URL(candidate, "https://boostme.invalid");
    if (parsed.origin !== "https://boostme.invalid") return DEFAULT_RETURN_PATH;
    if (parsed.pathname === "/dashboard" || parsed.pathname.startsWith("/dashboard/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    if (parsed.pathname === "/admin") return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // Malformed paths fall back to the workspace overview.
  }

  return DEFAULT_RETURN_PATH;
}

/** Build the in-app callback URL Supabase should use for signup, resend, and recovery emails. */
export function buildSupabaseAuthRedirect(origin: string, returnTo: string, mode?: "reset") {
  const redirect = new URL("/auth", origin);
  redirect.searchParams.set("next", safeAuthReturnPath(returnTo));
  if (mode) redirect.searchParams.set("mode", mode);
  return redirect.toString();
}
