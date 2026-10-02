import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { friendlyErrorMessage } from "@shared/errorMessages";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  Globe2,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const formatDate = (value?: Date | string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not available";

type AccountTab = "profile" | "privacy";

const visibilityGuides: Array<[string, string]> = [
  ["Instagram", "Profile → ☰ → Settings and activity → Account privacy → turn off Private account."],
  ["TikTok", "Profile → ☰ → Settings and privacy → Privacy → turn off Private account."],
  ["Facebook", "Set the profile, page, or target post audience to Public. Use a public group only when the selected service supports it."],
  ["YouTube", "YouTube Studio → Content → choose the video → Visibility → Public. Check both video and channel visibility."],
  ["X", "Profile → Settings and privacy → Privacy and safety → turn off Protect your posts."],
  ["WhatsApp / Telegram", "Use a public channel, supported group, status, or invite/link. Private chats and restricted groups cannot be processed."],
];

export default function Account() {
  const { user, loading, error, refresh, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AccountTab>(() =>
    new URLSearchParams(window.location.search).get("tab") === "privacy" ? "privacy" : "profile"
  );
  const initials = (user?.name || user?.email || "OG").split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase();
  const selectTab = (tab: AccountTab) => {
    setActiveTab(tab);
    window.history.replaceState(null, "", tab === "privacy" ? "/dashboard/account?tab=privacy" : "/dashboard/account");
  };
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
    <header><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">Your account <span className="mx-1.5 text-slate-600">/</span> Settings</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.045em] text-white sm:text-3xl">Account settings</h1><p className="mt-2 text-sm leading-6 text-slate-400">Manage your account details and learn how to prepare public targets before ordering.</p></header>
    <nav aria-label="Account settings sections" role="tablist" className="flex w-full gap-2 overflow-x-auto rounded-2xl border border-white/[.08] bg-card p-2">
      <button type="button" role="tab" aria-selected={activeTab === "profile"} onClick={() => selectTab("profile")} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${activeTab === "profile" ? "bg-primary text-primary-foreground shadow-lg shadow-blue-500/15" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><ShieldCheck className="h-4 w-4" /> Profile & security</button>
      <button type="button" role="tab" aria-selected={activeTab === "privacy"} onClick={() => selectTab("privacy")} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${activeTab === "privacy" ? "bg-primary text-primary-foreground shadow-lg shadow-blue-500/15" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}><LockKeyhole className="h-4 w-4" /> Private-account help</button>
    </nav>
    {loading ? <div aria-live="polite" className="rounded-2xl border border-white/[.08] bg-card p-8 text-sm text-muted-foreground">Loading account details…</div> : error ? <section role="alert" className="rounded-2xl border border-rose-300/15 bg-card p-6"><h2 className="text-sm font-semibold text-white">We couldn't load your account details</h2><p className="mt-2 text-xs leading-5 text-slate-400">{friendlyErrorMessage(error, "Check your connection and try again.")}</p><Button size="sm" className="mt-4" onClick={() => void refresh()}>Try again</Button></section> : user ? activeTab === "privacy" ? <PrivacyHelp /> : <ProfilePanel user={user} initials={initials} onSignOut={signOut} /> : <section className="rounded-2xl border border-white/[.08] bg-card p-6"><p className="text-sm text-card-foreground">Sign in to view your account details.</p><Button size="sm" className="mt-4" onClick={() => setLocation("/auth?next=%2Fdashboard%2Faccount")}>Sign in</Button></section>}
  </div></DashboardLayout>;
}

function ProfilePanel({ user, initials, onSignOut }: { user: { name?: string | null; email?: string | null; role?: string | null; createdAt?: Date | string | null }; initials: string; onSignOut: () => void }) {
  return <div className="grid min-w-0 gap-5 lg:grid-cols-[1.05fr_.95fr]">
    <section className="min-w-0 rounded-2xl border border-white/[.08] bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><Avatar className="h-12 w-12 shrink-0 border border-white/10"><AvatarFallback className="bg-blue-300/10 text-sm font-semibold text-blue-100">{initials}</AvatarFallback></Avatar><div className="min-w-0"><h2 className="truncate text-base font-semibold text-white">{user.name || "Your account"}</h2><p className="mt-1 break-all text-xs text-slate-400">{user.email}</p></div><span className="ml-auto shrink-0 rounded-full border border-blue-200/10 bg-blue-200/[.05] px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider text-blue-100">{user.role === "admin" ? "Administrator" : "Customer"}</span></div><div className="mt-5 divide-y divide-white/[.06] border-t border-white/[.06]"><DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Account created" value={formatDate(user.createdAt)} /></div></section>
    <section className="rounded-2xl border border-white/[.08] bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300/[.07] text-emerald-100"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-white">Sign-in & security</h2><p className="mt-1 text-[10px] text-slate-500">How access is currently managed</p></div></div><div className="mt-5 space-y-3"><SecurityNote title="Password sign-in">Sign in with the email address and password you used to create this account. Password reset by email is not currently available.</SecurityNote><SecurityNote title="Protected session">Your signed-in session uses a protected HTTP-only cookie. Sign out on shared devices.</SecurityNote><div className="rounded-xl border border-amber-200/10 bg-amber-200/[.025] p-3.5"><p className="text-xs font-medium text-amber-100">Email verification</p><p className="mt-1.5 text-[10px] leading-5 text-slate-400">Email verification is temporarily not required. Register only with an email address you control.</p></div></div><Button variant="outline" className="mt-5 h-9 rounded-lg border-white/10 text-xs" onClick={onSignOut}><LogOut className="h-3.5 w-3.5" /> Sign out</Button></section>
  </div>;
}

function PrivacyHelp() {
  return <section role="tabpanel" aria-label="Private-account help" className="space-y-5">
    <div className="rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[.08] via-cyan-300/[.04] to-transparent p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200/20 bg-amber-200/[.10] text-amber-100"><Eye className="h-5 w-5" /></span><div><h2 className="text-base font-semibold text-white">Private targets cannot receive services</h2><p className="mt-2 text-xs leading-5 text-slate-300">Providers need to see the target publicly. Make the profile, post, video, channel, group, or status public before ordering and keep it public until delivery is complete.</p></div></div><div className="mt-4 rounded-xl border border-rose-200/15 bg-rose-300/[.05] p-3 text-[10px] leading-5 text-rose-50/90"><strong className="text-rose-100">Important:</strong> Never share your password with us. Only change the privacy or visibility setting on the platform itself.</div></div>
    <section className="rounded-2xl border border-white/[.08] bg-card p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-300/[.08] text-cyan-100"><Globe2 className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-white">How to make each platform public</h2><p className="mt-1 text-[10px] text-slate-500">Menu names can vary slightly by app version.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{visibilityGuides.map(([platform, steps]) => <article key={platform} className="rounded-xl border border-white/[.08] bg-white/[.025] p-4"><h3 className="text-xs font-semibold text-cyan-100">{platform}</h3><p className="mt-2 text-[10px] leading-5 text-slate-400">{steps}</p></article>)}</div></section>
    <section className="rounded-2xl border border-emerald-200/15 bg-emerald-300/[.04] p-5 sm:p-6"><h2 className="text-sm font-semibold text-white">Public visibility checklist</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{["Open the target link while logged out or in incognito mode.", "Confirm the exact post, video, profile, channel, or group is visible.", "Keep it public until the order is completed and checked."].map(step => <div key={step} className="flex gap-2 rounded-xl border border-emerald-200/10 bg-emerald-300/[.04] p-3 text-[10px] leading-5 text-slate-300"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />{step}</div>)}</div></section>
  </section>;
}

function SecurityNote({ title, children }: { title: string; children: string }) {
  return <div className="rounded-xl border border-white/[.06] bg-white/[.015] p-3.5"><p className="text-xs font-medium text-white">{title}</p><p className="mt-1.5 text-[10px] leading-5 text-slate-400">{children}</p></div>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 py-3.5"><span className="text-slate-500">{icon}</span><dt className="w-32 shrink-0 text-[10px] text-slate-500">{label}</dt><dd className="min-w-0 truncate text-xs font-medium text-slate-200">{value}</dd></div>;
}
