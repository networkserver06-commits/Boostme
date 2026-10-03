import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { safeAuthReturnPath } from "@/lib/authRouting";
import {
  friendlyErrorMessage,
  isUnauthorizedError,
} from "@shared/errorMessages";
import { trpc } from "@/lib/trpc";

type AuthMode = "signin" | "signup" | "request-reset" | "reset";

export default function Auth() {
  const [, navigate] = useLocation();
  const auth = useAuth();
  const utils = trpc.useUtils();
  const signIn = trpc.auth.signin.useMutation();
  const signUp = trpc.auth.signup.useMutation();
  const requestReset = trpc.auth.requestPasswordReset.useMutation();
  const resetPassword = trpc.auth.resetPassword.useMutation();
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("token") ?? "";
  const [mode, setMode] = useState<AuthMode>(() =>
    params.get("mode") === "signup"
      ? "signup"
      : params.get("mode") === "reset" && resetToken
        ? "reset"
        : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnTo] = useState(() =>
    safeAuthReturnPath(new URLSearchParams(window.location.search).get("next"))
  );

  useEffect(() => {
    if (auth.user && (mode === "signin" || mode === "signup"))
      navigate(returnTo);
  }, [auth.user, mode, navigate, returnTo]);

  function setStatus(text: string, kind: "error" | "success" = "error") {
    setMessage(text);
    setMessageKind(kind);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      if (mode === "request-reset") {
        const result = await requestReset.mutateAsync({ email: email.trim() });
        setStatus(result.message, "success");
        return;
      }
      if (mode === "reset") {
        if (!resetToken)
          throw new Error(
            "This reset link is missing or invalid. Request a new one."
          );
        const result = await resetPassword.mutateAsync({
          token: resetToken,
          password,
        });
        setMode("signin");
        setPassword("");
        setStatus(result.message, "success");
        return;
      }
      const result =
        mode === "signin"
          ? await signIn.mutateAsync({ email: email.trim(), password })
          : await signUp.mutateAsync({
              name: name.trim(),
              email: email.trim(),
              password,
            });
      const refreshed = await auth.refresh();
      const user = refreshed.data ?? result.user;
      if (!user)
        throw new Error(
          "Your account was created, but your session could not be confirmed. Please sign in again."
        );
      utils.auth.me.setData(undefined, user);
      setStatus(
        mode === "signup"
          ? "Account created. Opening your dashboard…"
          : "Signed in. Opening your dashboard…",
        "success"
      );
      navigate(returnTo);
    } catch (error) {
      const fallback =
        mode === "request-reset"
          ? "We couldn't send the reset request. Check your email and try again."
          : mode === "reset"
            ? "We couldn't reset your password. The link may have expired."
            : "We couldn't complete sign-in. Check your connection and try again.";
      const message =
        mode === "signin" && isUnauthorizedError(error)
          ? "Email or password is incorrect. Check your details and try again."
          : friendlyErrorMessage(error, fallback);
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  const title =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "request-reset"
          ? "Reset your password"
          : "Choose a new password";
  const description =
    mode === "signin"
      ? "Sign in to manage your orders, wallet activity, and delivery updates."
      : mode === "signup"
        ? "Create an account to manage orders, wallet activity, and delivery updates."
        : mode === "request-reset"
          ? "Enter your account email and we’ll send a secure reset link if it exists."
          : "Use a new password with at least 8 characters. The reset link expires in 15 minutes.";

  return (
    <main className="min-h-screen bg-[#080d15] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden overflow-hidden border-r border-white/8 bg-[#0b1220] p-10 lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_15%_10%,rgba(56,189,248,.18),transparent_34%),radial-gradient(circle_at_80%_85%,rgba(99,102,241,.16),transparent_34%)]" />
          <Link
            href="/"
            className="relative inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-tight"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500">
              <Sparkles className="h-5 w-5" />
            </span>{" "}
            orbit growth
          </Link>
          <div className="relative max-w-xl py-16">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-300/10 px-3 py-1.5 text-xs font-medium text-blue-200">
              <ShieldCheck className="h-3.5 w-3.5" /> Your work, in one clear
              place
            </p>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.05] tracking-[-.06em] xl:text-6xl">
              A calmer way to keep growth moving.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
              Track orders, understand wallet activity, and get a clear view of
              what needs your attention next.
            </p>
            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
                <p className="text-xs text-slate-500">Your dashboard</p>
                <p className="mt-2 text-sm font-medium">
                  Orders and status in one view
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
                <p className="text-xs text-slate-500">Account access</p>
                <p className="mt-2 text-sm font-medium">
                  Private password and session
                </p>
              </div>
            </div>
          </div>
          <p className="relative text-xs text-slate-600">
            © 2026 Orbit Growth
          </p>
        </aside>

        <section className="flex min-h-screen flex-col px-5 py-6 sm:px-8 lg:px-12 xl:px-20">
          <header className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight lg:hidden"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500">
                <Sparkles className="h-4 w-4" />
              </span>{" "}
              orbit growth
            </Link>
            <Link
              href="/"
              className="ml-auto inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Back to site
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-300">
                Secure account access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {description}
              </p>
            </div>

            <form onSubmit={submit} className="grid gap-4">
              {mode === "signup" && (
                <label
                  className="grid gap-2 text-sm text-slate-300"
                  htmlFor="auth-name"
                >
                  Full name
                  <input
                    id="auth-name"
                    required
                    autoComplete="name"
                    maxLength={120}
                    value={name}
                    onChange={event => setName(event.target.value)}
                    className="h-12 rounded-xl border border-white/10 bg-white/[.035] px-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15"
                    placeholder="Your name"
                  />
                </label>
              )}
              {mode !== "reset" && (
                <label
                  className="grid gap-2 text-sm text-slate-300"
                  htmlFor="auth-email"
                >
                  Email address
                  <span className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="auth-email"
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[.035] pl-11 pr-4 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15"
                      placeholder="you@example.com"
                    />
                  </span>
                </label>
              )}
              {mode !== "request-reset" && (
                <label
                  className="grid gap-2 text-sm text-slate-300"
                  htmlFor="auth-password"
                >
                  {mode === "reset" ? "New password" : "Password"}
                  <span className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" />
                    <input
                      id="auth-password"
                      required
                      minLength={8}
                      maxLength={256}
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "signin" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[.035] pl-11 pr-12 text-white outline-none placeholder:text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/15"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword(value => !value)}
                      className="absolute right-3 top-2.5 grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-white/5 hover:text-white"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </span>
                </label>
              )}

              {message && (
                <p
                  className={`rounded-xl px-4 py-3 text-sm leading-5 ${messageKind === "success" ? "border border-emerald-300/15 bg-emerald-300/10 text-emerald-100" : "border border-rose-300/15 bg-rose-300/10 text-rose-100"}`}
                  role={messageKind === "error" ? "alert" : "status"}
                >
                  {message}
                </p>
              )}
              <button
                disabled={busy}
                className="mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-wait disabled:opacity-60"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create account"
                      : mode === "request-reset"
                        ? "Email reset link"
                        : "Reset password"}
                {!busy && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("request-reset");
                    setMessage("");
                  }}
                  className="text-slate-400 transition hover:text-white"
                >
                  Forgot password?
                </button>
              )}
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setMessage("");
                  }}
                  className="ml-auto text-slate-400 transition hover:text-white"
                >
                  New here? Create an account
                </button>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setMessage("");
                  }}
                  className="ml-auto text-slate-400 transition hover:text-white"
                >
                  Already have an account? Sign in
                </button>
              )}
              {(mode === "request-reset" || mode === "reset") && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setMessage("");
                  }}
                  className="ml-auto text-slate-400 transition hover:text-white"
                >
                  Back to sign in
                </button>
              )}
            </div>
            <p className="mt-8 inline-flex items-center justify-center gap-2 text-center text-xs leading-5 text-slate-600">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> Password reset
              links are single-use and expire after 15 minutes.
            </p>
          </div>
          <footer className="pb-4 text-center text-xs text-slate-700">
            Need help?{" "}
            <a href="tel:+254116553618" className="hover:text-slate-400">
              0116 553 618
            </a>{" "}
            ·{" "}
            <a
              href="https://wa.me/254116553618?text=Hello%20Orbit%20Growth%20support"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-400"
            >
              WhatsApp support
            </a>{" "}
            · Powered by Lee Tech.
          </footer>
        </section>
      </div>
    </main>
  );
}
