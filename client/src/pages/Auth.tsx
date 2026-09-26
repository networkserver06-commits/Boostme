import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { saveSupabaseSession, getSupabaseSession, captureSupabaseSessionFromHash } from "@/lib/supabaseAuth";
import { supabaseBrowserConfig } from "@/lib/supabaseConfig";
import { isEmailNotConfirmedError } from "@/lib/authError";
import { safeAuthReturnPath } from "@/lib/authRouting";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type AuthMode = "signin" | "signup" | "forgot" | "reset";
type AuthResponse = Record<string, unknown> & { access_token?: string; refresh_token?: string; expires_in?: number; expires_at?: number };

const supabaseUrl = supabaseBrowserConfig?.url;
const supabaseKey = supabaseBrowserConfig?.key;
const getErrorMessage = (body: AuthResponse, fallback: string) => {
  const code = String(body.error_code ?? body.error ?? "").toLowerCase();
  const message = String(body.error_description ?? body.msg ?? body.message ?? fallback);
  if (code.includes("invalid_credentials")) return "That email and password combination wasn’t recognized. Check them and try again.";
  if (code.includes("rate_limit")) return "Too many attempts in a short time. Wait a moment, then try again.";
  return message;
};

export default function Auth() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<AuthMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("mode") === "reset" || new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery" ? "reset" : "signin";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnTo] = useState(() => safeAuthReturnPath(new URLSearchParams(window.location.search).get("next")));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkType = captureSupabaseSessionFromHash();
    if (linkType === "recovery" || (params.get("mode") === "reset" && getSupabaseSession()?.access_token)) {
      setMode("reset");
      setMessage("Choose a new password for your account.");
      setMessageKind("success");
    } else if (linkType) {
      setMessage("Email confirmed. Opening your workspace…");
      setMessageKind("success");
      void utils.auth.me.invalidate().then(() => navigate(returnTo));
    }
  }, [navigate, returnTo, utils.auth.me]);

  useEffect(() => {
    if (auth.user && mode !== "reset") navigate(returnTo);
  }, [auth.user, mode, navigate, returnTo]);

  function setStatus(text: string, kind: "error" | "success" = "error") {
    setMessage(text);
    setMessageKind(kind);
  }

  async function requestRecovery() {
    setMessage("");
    if (!supabaseUrl || !supabaseKey) {
      setStatus("Sign-in is not configured yet. Add the public Supabase URL and publishable/anon key to the deployment environment, then redeploy.");
      return;
    }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth?mode=reset&next=${encodeURIComponent(returnTo)}`;
      const response = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: { apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok) throw new Error(getErrorMessage(body, "Unable to request a password reset."));
      setStatus("If an account uses that email, a password reset link is on its way. Check your inbox and spam folder.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to request a password reset.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    setMessage("");
    if (!supabaseUrl || !supabaseKey) {
      setStatus("Sign-in is not configured yet. Add the public Supabase URL and publishable/anon key to the deployment environment, then redeploy.");
      return;
    }
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth?next=${encodeURIComponent(returnTo)}`;
      const response = await fetch(`${supabaseUrl}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: { apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "signup", email }),
      });
      const body = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok) throw new Error(getErrorMessage(body, "Unable to resend the confirmation email."));
      setStatus("Confirmation email sent. Check your inbox and spam folder, then return here to sign in.", "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to resend the confirmation email.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setNeedsConfirmation(false);
    if (mode === "forgot") {
      await requestRecovery();
      return;
    }
    if (mode === "reset") {
      if (password !== confirmPassword) {
        setStatus("Those passwords don’t match. Please try again.");
        return;
      }
      const session = getSupabaseSession();
      if (!session?.access_token || !supabaseUrl || !supabaseKey) {
        setStatus("This reset link is missing or expired. Request a new password reset link to continue.");
        return;
      }
      setBusy(true);
      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
          method: "PUT",
          headers: { apikey: supabaseKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const body = await response.json().catch(() => ({})) as AuthResponse;
        if (!response.ok) throw new Error(getErrorMessage(body, "Unable to update the password."));
        setStatus("Password updated. You’re being signed in…", "success");
        await utils.auth.me.invalidate();
        navigate(returnTo);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to update the password.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      setStatus("Sign-in is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or the supported NEXT_PUBLIC equivalents) to the deployment environment, then redeploy.");
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === "signin" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
      const response = await fetch(`${supabaseUrl}${endpoint}`, {
        method: "POST",
        headers: { apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, ...(mode === "signup" ? { data: { full_name: name.trim() } } : {}) }),
      });
      const body = await response.json().catch(() => ({})) as AuthResponse;
      if (!response.ok) {
        if (isEmailNotConfirmedError(body)) {
          setNeedsConfirmation(true);
          setStatus("Your email isn’t confirmed yet. Check your inbox or resend the confirmation email below.");
        } else {
          setStatus(getErrorMessage(body, "Authentication failed."));
        }
        return;
      }
      if (mode === "signup" && !body.access_token) {
        setNeedsConfirmation(true);
        setMode("signin");
        setStatus("Account created. Check your email to confirm the address, then sign in.", "success");
        return;
      }
      const session = saveSupabaseSession(body as AuthResponse & { access_token: string });
      if (!session.access_token) throw new Error("The authentication service did not return a valid session.");
      await utils.auth.me.invalidate();
      navigate(returnTo);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Choose a new password";
  const description = mode === "signin"
    ? "Sign in to your creator workspace and pick up where you left off."
    : mode === "signup"
      ? "Create an account to manage orders, wallet activity, and delivery updates."
      : mode === "forgot"
        ? "We’ll email you a secure link if an account exists for that address."
        : "Use a new password you haven’t used for this account before.";

  return (
    <main className="min-h-screen bg-[#080d15] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-[#0b1220] p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_10%,rgba(56,189,248,.18),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(99,102,241,.16),transparent_34%)]" />
          <a href="/" className="relative inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-tight"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500"><Sparkles className="h-5 w-5" /></span> orbit growth</a>
          <div className="relative max-w-xl py-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-medium text-blue-200"><ShieldCheck className="h-3.5 w-3.5" /> Your work, in one clear place</p>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-[-.06em] xl:text-6xl">A calmer way to keep growth moving.</h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">Track orders, understand wallet activity, and get a clear view of what needs your attention next.</p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-xs text-slate-500">Workspace</p><p className="mt-2 text-sm font-medium">Orders and status in one view</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><p className="text-xs text-slate-500">Account access</p><p className="mt-2 text-sm font-medium">Protected with Supabase Auth</p></div>
            </div>
          </div>
          <p className="relative text-xs text-slate-600">© 2026 Orbit Growth</p>
        </aside>

        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12 xl:px-20">
          <header className="flex items-center justify-between">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight lg:hidden"><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500"><Sparkles className="h-4 w-4" /></span> orbit growth</a>
            <a href="/" className="ml-auto inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to site</a>
          </header>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-300">Secure workspace access</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
            </div>

            <form onSubmit={submit} className="grid gap-4">
              {mode === "signup" && <label className="grid gap-2 text-sm text-slate-300" htmlFor="auth-name">Full name<input id="auth-name" required autoComplete="name" value={name} onChange={event => setName(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-white/[.035] px-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15" placeholder="Your name" /></label>}
              {mode !== "reset" && <label className="grid gap-2 text-sm text-slate-300" htmlFor="auth-email">Email address<span className="relative"><Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input id="auth-email" required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[.035] pl-11 pr-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15" placeholder="you@example.com" /></span></label>}
              {mode !== "forgot" && <label className="grid gap-2 text-sm text-slate-300" htmlFor="auth-password">{mode === "reset" ? "New password" : "Password"}<span className="relative"><LockKeyhole className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" /><input id="auth-password" required minLength={mode === "reset" ? 8 : 6} type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[.035] pl-11 pr-12 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15" placeholder={mode === "reset" ? "At least 8 characters" : "Enter your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-2.5 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white/5 hover:text-white">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>}
              {mode === "reset" && <label className="grid gap-2 text-sm text-slate-300" htmlFor="auth-confirm-password">Confirm new password<input id="auth-confirm-password" required minLength={8} type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="h-12 rounded-xl border border-white/10 bg-white/[.035] px-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15" placeholder="Enter it once more" /></label>}

              {message && <p className={`rounded-xl px-4 py-3 text-sm leading-5 ${messageKind === "success" ? "border border-emerald-300/15 bg-emerald-300/10 text-emerald-100" : "border border-rose-300/15 bg-rose-300/10 text-rose-100"}`} role={messageKind === "error" ? "alert" : "status"}>{message}</p>}
              {needsConfirmation && mode === "signin" && <button type="button" disabled={busy || !email} onClick={resendConfirmation} className="rounded-xl border border-blue-300/25 bg-blue-300/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:bg-blue-300/15 disabled:opacity-60">{busy ? "Sending…" : "Resend confirmation email"}</button>}
              <button disabled={busy} className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}{!busy && <ArrowRight className="h-4 w-4" />}</button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              {mode === "signin" && <button type="button" onClick={() => { setMode("forgot"); setMessage(""); setNeedsConfirmation(false); }} className="text-blue-300 transition hover:text-blue-200">Forgot password?</button>}
              {mode === "forgot" && <button type="button" onClick={() => { setMode("signin"); setMessage(""); }} className="text-slate-400 transition hover:text-white">Back to sign in</button>}
              {mode === "reset" && <button type="button" onClick={() => { setMode("forgot"); setMessage(""); }} className="text-slate-400 transition hover:text-white">Request another reset link</button>}
              {(mode === "signin" || mode === "signup") && <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setNeedsConfirmation(false); }} className="ml-auto text-slate-400 transition hover:text-white">{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button>}
            </div>
            <p className="mt-8 inline-flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-600"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Your password is handled by Supabase Auth and is never stored by Orbit Growth.</p>
          </div>
          <footer className="pb-4 text-center text-xs text-slate-700">Need help? Contact your workspace administrator.</footer>
        </section>
      </div>
    </main>
  );
}
