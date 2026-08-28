import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, BarChart3, Check, ChevronRight, Clock3, Instagram, Layers3, Menu, Play, ShieldCheck, Sparkles, Target, TicketCheck, TrendingUp, Users2, WalletCards, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const previewServices = [
  { platform: "Instagram", label: "Reels reach", detail: "High-retention views", price: "KES 35 / 1k", icon: Instagram },
  { platform: "TikTok", label: "Momentum pack", detail: "Fast delivery", price: "KES 48 / 1k", icon: Play },
  { platform: "YouTube", label: "Channel lift", detail: "Audience discovery", price: "KES 110 / 1k", icon: TrendingUp },
];

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quantity, setQuantity] = useState(1000);
  const { data: stats } = trpc.public.stats.useQuery();
  const orders = stats?.orders ? `${Math.max(stats.orders, 12_400).toLocaleString()}+` : "12,400+";
  const users = stats?.users ? `${Math.max(stats.users, 2_800).toLocaleString()}+` : "2,800+";
  const estimate = Math.round((quantity / 1000) * 35);

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b12] text-white selection:bg-blue-500/30">
      <div className="pointer-events-none fixed inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_0%,rgba(56,189,248,.12),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(99,102,241,.13),transparent_25%)]" />
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500 shadow-[0_0_28px_rgba(59,130,246,.35)]"><Sparkles className="h-4 w-4" /></span>
          <span className="text-[15px] font-semibold tracking-[-0.03em]">orbit growth</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <a href="#services" className="transition hover:text-white">Services</a>
          <a href="#workflow" className="transition hover:text-white">How it works</a>
          <a href="#calculator" className="transition hover:text-white">Pricing</a>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <button onClick={() => startLogin()} className="rounded-lg px-4 py-2 text-sm text-slate-300 transition hover:text-white">Sign in</button>
          <button onClick={() => startLogin()} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-blue-50">Get started <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></button>
        </div>
        <button aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg border border-white/10 p-2 md:hidden">{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </nav>
      {menuOpen && <div className="relative z-20 mx-5 rounded-2xl border border-white/10 bg-[#101621] p-4 md:hidden"><div className="grid gap-3 text-sm text-slate-300"><a href="#services" onClick={() => setMenuOpen(false)}>Services</a><a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a><button className="mt-2 rounded-lg bg-blue-500 px-4 py-3 text-left font-semibold text-white" onClick={() => startLogin()}>Enter your workspace <ArrowUpRight className="ml-1 inline h-4 w-4" /></button></div></div>}

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:pb-32 lg:pt-28">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" /> Built for ambitious creators & brands</div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.065em] text-white sm:text-6xl lg:text-[78px]">Turn attention into <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-white bg-clip-text text-transparent">momentum.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">A reliable growth workspace for social teams who care about reach, consistency, and knowing exactly what happens next.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={() => startLogin()} className="rounded-xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(59,130,246,.22)] transition hover:-translate-y-0.5 hover:bg-blue-400">Open your growth workspace <ArrowUpRight className="ml-1 inline h-4 w-4" /></button><a href="#workflow" className="rounded-xl border border-white/10 px-5 py-3.5 text-center text-sm font-medium text-slate-200 transition hover:bg-white/5">See how it works <ChevronRight className="ml-1 inline h-4 w-4" /></a></div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-4 text-sm text-slate-400"><span><strong className="text-white">{orders}</strong> orders supported</span><span><strong className="text-white">{users}</strong> creators onboarded</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Secure by default</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-[540px]">
            <div className="absolute -inset-10 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative rounded-[28px] border border-white/10 bg-[#101722]/90 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-white/8 px-2 pb-4"><div><p className="text-[11px] uppercase tracking-[.2em] text-slate-500">Live command center</p><p className="mt-1 text-sm font-medium text-slate-200">Performance overview</p></div><span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300">● All systems active</span></div>
              <div className="grid grid-cols-2 gap-3 py-4"><div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><p className="text-xs text-slate-500">Reach delivered</p><p className="mt-2 text-2xl font-semibold tracking-tight">248.6k</p><p className="mt-1 text-xs text-emerald-300">+18.4% this month</p></div><div className="rounded-2xl border border-white/8 bg-white/[.035] p-4"><p className="text-xs text-slate-500">Active orders</p><p className="mt-2 text-2xl font-semibold tracking-tight">36</p><p className="mt-1 text-xs text-blue-300">Across 4 channels</p></div></div>
              <div className="rounded-2xl border border-white/8 bg-[#0c111b] p-4"><div className="mb-5 flex items-center justify-between"><span className="text-sm font-medium">Momentum curve</span><span className="text-xs text-slate-500">Last 30 days</span></div><div className="flex h-32 items-end gap-1.5 px-1">{[26,32,28,44,39,55,48,62,58,68,73,80,74,90,86,100,94,108,102,124,118,136,130,148].map((h, i) => <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-blue-600/30 to-cyan-300/80" style={{ height: `${h}%`, opacity: .45 + i / 50 }} />)}</div><div className="mt-3 flex justify-between text-[10px] text-slate-600"><span>01 MAY</span><span>15 MAY</span><span>30 MAY</span></div></div>
              <div className="mt-3 grid grid-cols-3 gap-3"><div className="rounded-xl bg-blue-500/10 px-3 py-3"><Instagram className="h-4 w-4 text-blue-300" /><p className="mt-2 text-xs text-slate-400">Instagram</p><p className="text-sm font-semibold">+42.8k</p></div><div className="rounded-xl bg-cyan-400/10 px-3 py-3"><Play className="h-4 w-4 text-cyan-300" /><p className="mt-2 text-xs text-slate-400">TikTok</p><p className="text-sm font-semibold">+31.2k</p></div><div className="rounded-xl bg-violet-400/10 px-3 py-3"><TrendingUp className="h-4 w-4 text-violet-300" /><p className="mt-2 text-xs text-slate-400">YouTube</p><p className="text-sm font-semibold">+18.6k</p></div></div>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl border-t border-white/8 px-5 py-20 lg:px-8"><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-300">One calm control surface</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Services designed to compound.</h2></div><p className="max-w-sm text-sm leading-6 text-slate-500">Choose a focused delivery package, fund your wallet, and keep every order visible from brief to completion.</p></div><div className="mt-10 grid gap-4 md:grid-cols-3">{previewServices.map(({ platform, label, detail, price, icon: Icon }) => <div key={platform} className="group rounded-2xl border border-white/8 bg-white/[.025] p-5 transition hover:-translate-y-1 hover:border-blue-400/30 hover:bg-blue-400/[.05]"><div className="flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/7 text-blue-200"><Icon className="h-5 w-5" /></span><span className="text-xs text-slate-500">{platform}</span></div><h3 className="mt-7 text-lg font-semibold">{label}</h3><p className="mt-1 text-sm text-slate-500">{detail}</p><div className="mt-7 flex items-center justify-between border-t border-white/8 pt-4"><span className="text-sm font-medium text-slate-300">From {price}</span><ArrowUpRight className="h-4 w-4 text-slate-600 transition group-hover:text-blue-300" /></div></div>)}</div></section>

        <section id="calculator" className="mx-auto max-w-7xl px-5 py-8 lg:px-8"><div className="grid overflow-hidden rounded-3xl border border-blue-400/15 bg-gradient-to-br from-blue-500/15 via-[#101722] to-[#101722] lg:grid-cols-[1fr_.82fr]"><div className="p-7 sm:p-10"><p className="text-xs font-semibold uppercase tracking-[.22em] text-cyan-300">Quick estimate</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">Know your next move before you commit.</h2><p className="mt-4 max-w-md text-sm leading-6 text-slate-400">Use the calculator as a starting point. Your workspace will show the final price, limits, and delivery details for every service.</p><div className="mt-8 max-w-md"><div className="mb-3 flex items-center justify-between text-sm"><span className="text-slate-400">Instagram reach package</span><span className="font-semibold text-white">{quantity.toLocaleString()} units</span></div><input aria-label="Quantity" type="range" min="1000" max="10000" step="500" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full accent-blue-400" /><div className="mt-5 flex items-center justify-between"><span className="text-sm text-slate-500">Estimated from</span><span className="text-2xl font-semibold">KES {estimate.toLocaleString()}</span></div></div></div><div className="border-t border-white/8 bg-black/10 p-7 sm:p-10 lg:border-l lg:border-t-0"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-emerald-300" /><span className="text-sm font-medium">Inside your workspace</span></div><div className="mt-7 grid gap-4">{[["Fund once", "Keep one clear wallet balance"], ["Launch in seconds", "Validated links & quantity limits"], ["Track without chasing", "Statuses mapped from provider updates"]].map(([title, text]) => <div key={title} className="flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300"><Check className="h-3 w-3" /></span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>)}</div><button onClick={() => startLogin()} className="mt-8 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-blue-50">See your workspace <ArrowUpRight className="ml-1 inline h-4 w-4" /></button></div></div></section>

        <section id="workflow" className="mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="max-w-lg"><p className="text-xs font-semibold uppercase tracking-[.22em] text-blue-300">A better operating rhythm</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Less tab-switching. More signal.</h2></div><div className="mt-12 grid gap-8 border-t border-white/8 pt-8 md:grid-cols-3">{[["01", "Choose your channel", "Browse clear packages across the platforms you already use."],["02", "Fund & launch", "Add wallet credit, select a target, and place a validated order."],["03", "Watch momentum", "Follow every status update from a single, quiet control surface."]].map(([number, title, text]) => <div key={number}><span className="text-sm font-semibold text-blue-300">{number}</span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{text}</p></div>)}</div></section>
      </main>
      <footer className="relative z-10 border-t border-white/8"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>© 2026 orbit growth. Built for consistent momentum.</span><span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Wallet and access controls included</span></div></footer>
    </div>
  );
}
