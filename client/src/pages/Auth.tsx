import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { saveSupabaseSession } from "@/lib/supabaseAuth";
import { supabaseBrowserConfig } from "@/lib/supabaseConfig";

const supabaseUrl = supabaseBrowserConfig?.url;
const supabaseKey = supabaseBrowserConfig?.key;

export default function Auth() {
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!supabaseUrl || !supabaseKey) {
      setMessage("Supabase browser configuration is missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or use the supported NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY variables in Vercel, then redeploy.");
      return;
    }
    setBusy(true);
    try {
      const endpoint = mode === "signin" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
      const response = await fetch(`${supabaseUrl}${endpoint}`, {
        method: "POST",
        headers: { apikey: supabaseKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(mode === "signup" ? { data: { full_name: name } } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error_description ?? body.msg ?? body.message ?? "Authentication failed");
      if (mode === "signup" && !body.access_token) {
        setMessage("Account created. Check your email to confirm the address, then sign in.");
        setMode("signin");
        return;
      }
      saveSupabaseSession({ access_token: body.access_token, refresh_token: body.refresh_token, expires_at: body.expires_in ? Math.floor(Date.now() / 1000) + body.expires_in : undefined });
      navigate("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-[#080d15] px-5 py-12 text-white"><div className="mx-auto max-w-md"><button className="mb-10 text-sm text-slate-400 hover:text-white" onClick={() => navigate("/")}>← Back to Orbit Growth</button><div className="rounded-3xl border border-white/10 bg-white/[.035] p-7 shadow-2xl shadow-blue-950/20"><p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-300">Orbit Growth</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em]">{mode === "signin" ? "Welcome back." : "Create your workspace."}</h1><p className="mt-2 text-sm leading-6 text-slate-400">Use your Supabase account to access the reseller workspace.</p><form onSubmit={submit} className="mt-7 grid gap-4">{mode === "signup" && <label className="grid gap-2 text-sm text-slate-300">Full name<input required value={name} onChange={e => setName(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>}<label className="grid gap-2 text-sm text-slate-300">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-blue-400" /></label><label className="grid gap-2 text-sm text-slate-300">Password<input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none focus:border-blue-400" /></label>{message && <p className="rounded-xl bg-blue-400/10 px-4 py-3 text-sm leading-5 text-blue-100">{message}</p>}<button disabled={busy} className="rounded-xl bg-blue-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60">{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}</button></form><button className="mt-5 w-full text-sm text-slate-400 hover:text-white" onClick={() => { setMessage(""); setMode(mode === "signin" ? "signup" : "signin"); }}>{mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button></div></div></main>;
}
