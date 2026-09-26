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
