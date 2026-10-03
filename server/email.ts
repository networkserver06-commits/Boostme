import { createHash, randomBytes } from "node:crypto";

const RESET_TTL_MS = 15 * 60 * 1000;

function appBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ||
    process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    "https://boost.leetec.online"
  );
}

function fromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Orbit Growth <onboarding@resend.dev>"
  );
}

export function createPasswordResetToken() {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  return {
    rawToken,
    tokenHash,
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  };
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function sendResendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY is not configured; email was not sent"
    );
    return false;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail(), ...input }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Resend email failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ""}`
    );
  }
  return true;
}

export async function sendPasswordResetEmail(
  to: string,
  name: string | null | undefined,
  rawToken: string
) {
  const resetUrl = `${appBaseUrl()}/auth?mode=reset&token=${encodeURIComponent(rawToken)}`;
  const greeting = name?.trim() || "there";
  return sendResendEmail({
    to,
    subject: "Reset your Orbit Growth password",
    text: `Hi ${greeting},\n\nReset your password within 15 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px"><h2>Reset your Orbit Growth password</h2><p>Hi ${escapeHtml(greeting)},</p><p>Use the button below to choose a new password. This link expires in 15 minutes.</p><p><a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p><p style="font-size:13px;color:#667085">If you did not request this, you can ignore this email.</p></div>`,
  });
}

export async function sendTopupConfirmationEmail(input: {
  to: string;
  name?: string | null;
  amount: string;
  reference: string;
  balanceAfter?: string | null;
}) {
  const greeting = input.name?.trim() || "there";
  return sendResendEmail({
    to: input.to,
    subject: `Top-up confirmed — KSh ${input.amount}`,
    text: `Hi ${greeting},\n\nYour wallet top-up of KSh ${input.amount} was confirmed. Reference: ${input.reference}. Your new balance is KSh ${input.balanceAfter ?? "updated"}.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:560px"><h2>Top-up confirmed</h2><p>Hi ${escapeHtml(greeting)},</p><p>Your wallet top-up was successfully confirmed.</p><p><strong>Amount:</strong> KSh ${escapeHtml(input.amount)}<br><strong>Reference:</strong> ${escapeHtml(input.reference)}<br><strong>New balance:</strong> KSh ${escapeHtml(input.balanceAfter ?? "updated")}</p><p>You can now use your updated wallet balance for orders.</p></div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    character =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] ?? character
  );
}
