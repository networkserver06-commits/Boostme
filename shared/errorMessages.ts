type ErrorEnvelope = {
  message?: string;
  data?: { code?: string };
  shape?: { message?: string; data?: { code?: string } };
};

export function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const envelope = error as ErrorEnvelope;
  return envelope.data?.code === "UNAUTHORIZED"
    || envelope.shape?.data?.code === "UNAUTHORIZED"
    || envelope.message === "UNAUTHORIZED";
}

export function friendlyErrorMessage(error: unknown, fallback = "Please try again.") {
  const envelope = error && typeof error === "object" ? error as ErrorEnvelope : undefined;
  const code = envelope?.data?.code ?? envelope?.shape?.data?.code;
  const message = (error instanceof Error ? error.message : envelope?.message ?? "").trim();

  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)) {
    return "Connection problem. Check your internet and try again.";
  }
  if (code === "UNAUTHORIZED" || message === "UNAUTHORIZED") return "Your session has ended. Sign in again to continue.";
  if (code === "FORBIDDEN") return "You do not have permission to do that.";
  if (code === "TOO_MANY_REQUESTS") return "Too many attempts. Wait a moment, then try again.";
  if (["BAD_REQUEST", "CONFLICT", "NOT_FOUND", "PRECONDITION_FAILED"].includes(code ?? "") && message) return message;
  if (code === "INTERNAL_SERVER_ERROR" || code === "SERVICE_UNAVAILABLE" || code === "TIMEOUT") return fallback;
  if (!message || message === "Error" || /internal server error|unexpected error|trpcclienterror/i.test(message)) return fallback;
  return message;
}
