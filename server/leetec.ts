const defaultBaseUrl = "https://leetec.online";

type LeeTecResponse = Record<string, unknown>;

function getConfig() {
  const apiKey = process.env.LEETEC_API_KEY?.trim();
  const baseUrl = (process.env.LEETEC_BASE_URL?.trim() || defaultBaseUrl).replace(/\/$/, "");
  if (!apiKey) throw new Error("LeeTec M-Pesa is not configured. Add LEETEC_API_KEY to the server environment.");
  try { new URL(baseUrl); } catch { throw new Error("LEETEC_BASE_URL is invalid."); }
  return { apiKey, baseUrl };
}

function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  throw new Error("Enter a valid Kenyan phone number, for example 254712345678.");
}

async function leetecRequest(path: string, init: RequestInit) {
  const { apiKey, baseUrl } = getConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const raw = await response.text();
    let body: LeeTecResponse = {};
    try { body = raw ? JSON.parse(raw) as LeeTecResponse : {}; } catch { body = { message: raw }; }
    if (!response.ok) throw new Error(String(body.message ?? body.error ?? `LeeTec request failed (${response.status})`));
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizePaymentStatus(value: unknown) {
  const status = String(value ?? "PENDING").toUpperCase();
  if (["SUCCESS", "COMPLETED", "PAID"].includes(status)) return "SUCCESS" as const;
  if (["FAILED", "CANCELLED", "CANCELED", "REJECTED"].includes(status)) return "FAILED" as const;
  return "PENDING" as const;
}

export async function createLeeTecStkPush(input: { phoneNumber: string; amount: number; accountReference: string }) {
  return leetecRequest("/api/v1/stkpush", { method: "POST", body: JSON.stringify({ phoneNumber: normalizeKenyanPhone(input.phoneNumber), amount: Math.round(input.amount), accountReference: input.accountReference, transactionDesc: "Orbit Growth wallet top-up" }) });
}

export async function findLeeTecTransaction(accountReference: string) {
  const body = await leetecRequest("/api/v1/transactions", { method: "GET" });
  const transactions = Array.isArray(body.data) ? body.data : Array.isArray(body.transactions) ? body.transactions : Array.isArray(body.results) ? body.results : [];
  const match = transactions.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return [row.accountReference, row.account_reference, row.reference, row.transactionDesc, row.transaction_desc].some((value) => String(value ?? "") === accountReference);
  }) as Record<string, unknown> | undefined;
  return match ? { status: normalizePaymentStatus(match.status ?? match.paymentStatus ?? match.payment_status), transaction: match } : { status: "PENDING" as const, transaction: null };
}
