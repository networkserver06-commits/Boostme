import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { friendlyErrorMessage } from "@shared/errorMessages";
import { CalendarDays, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const formatDate = (value?: Date | string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
  : "Not available";

export default function Account() {
  const { user, loading, error, refresh, logout } = useAuth();
  const [, setLocation] = useLocation();
  const initials = (user?.name || user?.email || "OG").split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  const signOut = async () => {
    try {
      await logout();
      toast.success("Signed out", { description: "You have been securely signed out." });
      setLocation("/");
    } catch (cause) {
      toast.error("Couldn't sign out", { description: friendlyErrorMessage(cause, "Please check your connection and try again."), duration: 6500 });
    }
  };

  return <DashboardLayout><div className="mx-auto min-w-0 max-w-5xl space-y-6">
    <header><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">Your account <span className="mx-1.5 text-slate-600">/</span> Details</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.045em] text-white sm:text-3xl">Account details</h1><p className="mt-2 text-sm leading-6 text-slate-400">Your profile and sign-in information, in one place.</p></header>
    {loading ? <div aria-live="polite" className="rounded-2xl border border-white/[.08] bg-[#0c131e] p-8 text-sm text-slate-400">Loading account details…</div> : error ? <section role="alert" className="rounded-2xl border border-rose-300/15 bg-[#0c131e] p-6"><h2 className="text-sm font-semibold text-white">We couldn't load your account details</h2><p className="mt-2 text-xs leading-5 text-slate-400">{friendlyErrorMessage(error, "Check your connection and try again.")}</p><Button size="sm" className="mt-4" onClick={() => void refresh()}>Try again</Button></section> : user ? <>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <section className="min-w-0 rounded-2xl border border-white/[.08] bg-[#0c131e] p-5 sm:p-6"><div className="flex items-center gap-3"><Avatar className="h-12 w-12 shrink-0 border border-white/10"><AvatarFallback className="bg-blue-300/10 text-sm font-semibold text-blue-100">{initials}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{user.name || "Your account"}</h2><p className="mt-1 break-all text-xs text-slate-400">{user.email}</p></div><span className="ml-auto shrink-0 rounded-full border border-blue-200/10 bg-blue-200/[.05] px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-blue-100">{user.role === "admin" ? "Administrator" : "Customer"}</span></div><div className="mt-5 divide-y divide-white/[.06] border-t border-white/[.06]"><DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Account created" value={formatDate(user.createdAt)} /></div></section>

        <section className="rounded-2xl border border-white/[.08] bg-[#0c131e] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300/[.07] text-emerald-100"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-white">Sign-in & security</h2><p className="mt-1 text-[10px] text-slate-500">How access is currently managed</p></div></div><div className="mt-5 space-y-3"><div className="rounded-xl border border-white/[.06] bg-white/[.015] p-3.5"><p className="text-xs font-medium text-white">Password sign-in</p><p className="mt-1.5 text-[10px] leading-5 text-slate-400">Sign in with the email address and password you used to create this account. Password reset by email is not currently available.</p></div><div className="rounded-xl border border-white/[.06] bg-white/[.015] p-3.5"><p className="text-xs font-medium text-white">Protected session</p><p className="mt-1.5 text-[10px] leading-5 text-slate-400">Your signed-in session uses a protected HTTP-only cookie. Sign out on shared devices.</p></div><div className="rounded-xl border border-amber-200/10 bg-amber-200/[.025] p-3.5"><p className="text-xs font-medium text-amber-100">Email verification</p><p className="mt-1.5 text-[10px] leading-5 text-slate-400">Email verification is temporarily not required. Register only with an email address you control.</p></div></div><Button variant="outline" className="mt-5 h-9 rounded-lg border-white/10 text-xs" onClick={signOut}><LogOut className="h-3.5 w-3.5" />Sign out</Button></section>
      </div>
    </> : <section className="rounded-2xl border border-white/[.08] bg-[#0c131e] p-6"><p className="text-sm text-slate-300">Sign in to view your account details.</p><Button size="sm" className="mt-4" onClick={() => setLocation("/auth?next=%2Fdashboard%2Faccount")}>Sign in</Button></section>}
  </div></DashboardLayout>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 py-3.5"><span className="text-slate-500">{icon}</span><dt className="w-32 shrink-0 text-[10px] text-slate-500">{label}</dt><dd className="min-w-0 truncate text-xs font-medium text-slate-200">{value}</dd></div>;
}
