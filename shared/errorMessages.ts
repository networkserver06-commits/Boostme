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
  if (/target url must be a valid (.+) link/i.test(message)) return message.replace(/^Target URL must be a valid (.+) link$/i, "Use a valid $1 link for the selected service.");
  if (/quantity must be between/i.test(message)) return `${message}. Check the service minimum and maximum.`;
  if (/insufficient wallet balance/i.test(message)) return "Your wallet balance is too low for this order. Add funds, then try again.";
  if (/leetec|m-pesa payment request failed|payment request failed/i.test(message)) return "The M-Pesa prompt could not be started. Confirm your number and try again.";
  if (/provider fulfillment failed/i.test(message)) return "The service provider could not accept this order. Your wallet charge was refunded.";
  if (/live provider pricing could not be verified/i.test(message)) return "This service price is being refreshed from the provider. No charge was made; wait a moment and try again.";
  if (/pricing update in progress/i.test(message)) return "This service price is being updated safely. No charge was made; wait a moment and try again.";
  if (/service .*not found|service .*no longer available/i.test(message)) return "That service is no longer available. Refresh the catalog and choose another service.";
  if (["BAD_REQUEST", "CONFLICT", "NOT_FOUND", "PRECONDITION_FAILED"].includes(code ?? "") && message) return message;
  if (code === "INTERNAL_SERVER_ERROR" || code === "SERVICE_UNAVAILABLE" || code === "TIMEOUT") return fallback;
  if (!message || message === "Error" || /internal server error|unexpected error|trpcclienterror/i.test(message)) return fallback;
  return message;
}
