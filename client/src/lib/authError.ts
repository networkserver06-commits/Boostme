export function isEmailNotConfirmedError(body: Record<string, unknown>) {
  const code = String(body.error_code ?? body.error ?? body.code ?? "").toLowerCase();
  const detail = String(body.error_description ?? body.msg ?? body.message ?? "").toLowerCase();
  return code.includes("not_confirmed") || code.includes("email_not_verified") || detail.includes("email not confirmed");
}

export function getSupabaseCallbackError(search: string, hash = "") {
  const params = new URLSearchParams([search.replace(/^\?/, ""), hash.replace(/^#/, "")].filter(Boolean).join("&"));
  const error = params.get("error");
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!error && !code && !description) return null;

  const normalized = `${error ?? ""} ${code ?? ""} ${description ?? ""}`.toLowerCase();
  if (normalized.includes("otp_expired") || normalized.includes("expired") || normalized.includes("invalid_token")) {
    return "This email link has expired or was already used. Request a fresh confirmation or password-reset email and open its newest link.";
  }
  if (normalized.includes("access_denied")) {
    return "Email verification could not be completed. Request a fresh confirmation email and make sure it opens on this site.";
  }
  return description || "Email verification could not be completed. Request a fresh email link and try again.";
}
