export function isEmailNotConfirmedError(body: Record<string, unknown>) {
  const code = String(body.error_code ?? body.error ?? "").toLowerCase();
  const detail = String(body.error_description ?? body.msg ?? body.message ?? "").toLowerCase();
  return code.includes("not_confirmed") || detail.includes("email not confirmed");
}
