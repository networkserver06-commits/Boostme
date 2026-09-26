import { startLogin, startSignup } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Layers3,
  Instagram,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  Youtube,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

function serviceIcon(platform: string) {
  const normalized = platform.toLowerCase();
  if (normalized.includes("instagram")) return Instagram;
  if (normalized.includes("youtube")) return Youtube;
  if (normalized.includes("tiktok")) return Play;
  return Sparkles;
}

function money(value: number) {
  return `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PublicServiceCard({ service, onSelect }: { service: { id: number; platform: string; name: string; category: string; description: string | null; retailRatePer1k: string; minQuantity: number; maxQuantity: number }; onSelect: () => void }) {
  const Icon = serviceIcon(service.platform);
  return <article className="group flex min-h-[190px] flex-col rounded-2xl border border-white/[.08] bg-[#0d1420]/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-[#101b2a] sm:p-5"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[.06] bg-white/[.04] text-cyan-100"><Icon className="h-4 w-4" /></span><span className="rounded-full border border-white/[.08] px-2.5 py-1 text-[9px] font-medium text-slate-400">{service.category}</span></div><h4 className="mt-4 line-clamp-2 text-sm font-semibold leading-5 text-white">{service.name}</h4>{service.description && <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{service.description}</p>}<div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[.07] pt-4"><div><p className="text-[9px] text-slate-500">{service.minQuantity.toLocaleString()}–{service.maxQuantity.toLocaleString()} units</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{money(Number(service.retailRatePer1k))}<span className="ml-1 text-[9px] font-normal text-slate-500">/ 1k</span></p></div><button onClick={onSelect} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[10px] font-semibold text-cyan-200 hover:bg-cyan-200/10 hover:text-white">Order <ArrowUpRight className="h-3.5 w-3.5" /></button></div></article>;
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("All platforms");
  const [quantity, setQuantity] = useState(1000);
  const servicesQuery = trpc.public.services.useQuery(undefined, { retry: false });
  const services = servicesQuery.data ?? [];
  const selectedService = services.find((service) => service.id === Number(selectedServiceId)) ?? services[0];
  const platformNames = useMemo(() => Array.from(new Set(services.map((service) => service.platform))).sort((a, b) => {
    const priority = (name: string) => { const value = name.toLowerCase(); return value.includes("instagram") ? 0 : value.includes("tiktok") ? 1 : value.includes("youtube") ? 2 : 3; };
    return priority(a) - priority(b) || a.localeCompare(b);
  }), [services]);
  const orderedServices = useMemo(() => [...services].sort((a, b) => {
    const ai = platformNames.indexOf(a.platform); const bi = platformNames.indexOf(b.platform);
    return ai - bi || a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
  }), [services, platformNames]);
  const platformCount = platformNames.length;
  const estimate = selectedService ? Number((Number(selectedService.retailRatePer1k) * quantity / 1000).toFixed(2)) : 0;

  useEffect(() => {
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(String(services[0].id));
      setQuantity(services[0].minQuantity);
    }
  }, [selectedServiceId, services]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080d15] text-white selection:bg-cyan-400/30">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(40,105,220,.18),transparent_37%),radial-gradient(ellipse_at_90%_20%,rgba(25,182,190,.09),transparent_28%)]" />
      <header className="sticky top-0 z-40 border-b border-white/[.06] bg-[#080d15]/85 backdrop-blur-xl">
        <nav className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Main navigation">
          <Link href="/" className="group flex items-center gap-3" aria-label="Orbit Growth home">
            <span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/20 bg-gradient-to-br from-blue-500 to-cyan-500 shadow-[0_8px_30px_rgba(28,112,225,.3)]"><Sparkles className="h-[18px] w-[18px]" /></span>
            <span className="leading-tight"><span className="block text-[15px] font-semibold tracking-[-.04em]">orbit growth</span><span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[.19em] text-slate-500">Social growth, simplified</span></span>
          </Link>
          <div className="hidden items-center gap-8 text-[13px] font-medium text-slate-400 md:flex">
            <a href="#catalog" className="hover:text-white">Service catalog</a>
            <a href="#how-it-works" className="hover:text-white">How it works</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => startLogin()} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white">Sign in</button>
            <button onClick={() => startSignup()} className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-cyan-50">Create account <ArrowUpRight className="h-4 w-4" /></button>
          </div>
          <button type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="mobile-menu" onClick={() => setMenuOpen((open) => !open)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-slate-200 md:hidden">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        {menuOpen && <div id="mobile-menu" className="border-t border-white/[.07] bg-[#0b111c] px-5 py-4 md:hidden"><div className="mx-auto grid max-w-7xl gap-1 text-sm text-slate-300">
          <a href="#catalog" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-white/5">Service catalog</a>
          <a href="#how-it-works" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-white/5">How it works</a>
          <a href="#pricing" onClick={closeMenu} className="rounded-lg px-3 py-3 hover:bg-white/5">Pricing</a>
          <div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => startLogin()} className="rounded-lg border border-white/10 px-3 py-3 font-medium">Sign in</button><button onClick={() => startSignup()} className="rounded-lg bg-blue-500 px-3 py-3 font-semibold text-white">Create account <ArrowUpRight className="ml-1 inline h-4 w-4" /></button></div>
        </div></div>}
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:pt-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[.07] px-3.5 py-2 text-xs font-medium text-cyan-100"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,.8)]" /> A clearer way to run social growth</div>
            <h1 className="max-w-3xl text-[clamp(2.85rem,6vw,5.25rem)] font-semibold leading-[.99] tracking-[-.07em]">Growth services.<br /><span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-white bg-clip-text text-transparent">One clear account.</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">Find the right social growth service, see the price before checkout, and follow every order and wallet update from one simple dashboard.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => startSignup()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_34px_rgba(37,99,235,.25)] hover:-translate-y-0.5 hover:bg-blue-400">Create your account <ArrowRight className="h-4 w-4" /></button>
              <a href="#catalog" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.025] px-5 py-3.5 text-sm font-medium text-slate-200 hover:border-white/20 hover:bg-white/[.06]">Explore services <ArrowDownRight className="h-4 w-4" /></a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-white/[.08] pt-5 text-xs text-slate-400 sm:text-sm">
              <span><strong className="text-white">{services.length}</strong> active offers</span><span><strong className="text-white">{platformCount}</strong> {platformCount === 1 ? "platform" : "platforms"}</span><span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Secure account access</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[540px]">
            <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-blue-500/[.13] blur-3xl" />
            <div className="relative rounded-[26px] border border-white/[.11] bg-[#0e1622]/95 p-4 shadow-[0_24px_100px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-5">
              <div className="flex items-center justify-between border-b border-white/[.08] px-1 pb-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-slate-500">Orbit Growth account</p><p className="mt-1.5 text-base font-semibold tracking-tight">Everything in view</p></div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[.07] px-2.5 py-1.5 text-[10px] font-medium text-emerald-200"><ShieldCheck className="h-3.5 w-3.5" /> Private access</span>
              </div>
              <div className="grid grid-cols-2 gap-3 py-4">
                <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-400/10 text-blue-200"><CircleDollarSign className="h-4 w-4" /></span><p className="mt-4 text-xs text-slate-400">Clear pricing</p><p className="mt-1 text-sm font-semibold">Before you order</p></div>
                <div className="rounded-2xl border border-white/[.08] bg-white/[.035] p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-400/10 text-cyan-200"><Clock3 className="h-4 w-4" /></span><p className="mt-4 text-xs text-slate-400">Order updates</p><p className="mt-1 text-sm font-semibold">At a glance</p></div>
              </div>
              <div className="rounded-2xl border border-white/[.08] bg-[#0a1019] p-4">
                <div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-blue-200">Service catalog</p><p className="mt-1 text-xs text-slate-500">Live offers available now</p></div><a href="#catalog" className="text-xs font-medium text-cyan-200 hover:text-white">Browse <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" /></a></div>
                <div className="space-y-2">
                  {orderedServices.slice(0, 3).map((service) => {
                    const Icon = serviceIcon(service.platform);
                    return <div key={service.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[.06] text-cyan-100"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-100">{service.name}</p><p className="mt-1 text-[10px] text-slate-500">{service.platform} · {service.category}</p></div><span className="shrink-0 text-right text-[11px] font-semibold text-slate-200">{money(Number(service.retailRatePer1k))}<span className="block pt-0.5 text-[9px] font-normal text-slate-500">per 1k</span></span></div>;
                  })}
                  {services.length === 0 && <div className="rounded-xl border border-dashed border-white/10 px-4 py-7 text-center text-xs leading-5 text-slate-400">{servicesQuery.isLoading ? "Loading the current service catalog…" : "The service catalog is being prepared. Check back soon."}</div>}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 px-1 text-[10px] leading-5 text-slate-500"><WalletCards className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> Wallet requests are reviewed before account credit is applied.</div>
            </div>
          </div>
        </section>

        <section id="catalog" className="scroll-mt-24 border-y border-white/[.07] bg-white/[.012]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">The service catalog</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Find your platform. Compare offers.</h2></div><p className="max-w-md text-sm leading-6 text-slate-400">Services are grouped by social platform and category. Rates are per 1,000 units; exact totals are shown before you place an order.</p></div>
            <div className="mt-7 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Filter services by social platform"><button type="button" role="tab" aria-selected={selectedPlatform === "All platforms"} onClick={() => setSelectedPlatform("All platforms")} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${selectedPlatform === "All platforms" ? "border-cyan-200/20 bg-cyan-300/[.09] text-cyan-100" : "border-white/[.08] bg-white/[.02] text-slate-400 hover:text-white"}`}><Layers3 className="h-3.5 w-3.5" />All platforms<span className="text-[9px] opacity-70">{services.length}</span></button>{platformNames.map((platform) => { const Icon = serviceIcon(platform); const active = selectedPlatform === platform; const count = services.filter((service) => service.platform === platform).length; return <button type="button" role="tab" key={platform} aria-selected={active} onClick={() => setSelectedPlatform(platform)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${active ? "border-cyan-200/20 bg-cyan-300/[.09] text-cyan-100" : "border-white/[.08] bg-white/[.02] text-slate-400 hover:text-white"}`}><Icon className="h-3.5 w-3.5" />{platform}<span className="text-[9px] opacity-70">{count}</span></button>; })}</div>
            {services.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center"><p className="text-sm font-medium text-white">No active offers to display yet</p><p className="mt-2 text-xs text-slate-500">The service catalog will appear here as offers become available.</p></div> : selectedPlatform === "All platforms" ? <div className="mt-5 space-y-8">{platformNames.map((platform) => { const offers = orderedServices.filter((service) => service.platform === platform); const Icon = serviceIcon(platform); return <section key={platform} aria-label={`${platform} offers`}><div className="mb-4 flex items-center justify-between border-b border-white/[.07] pb-3"><h3 className="inline-flex items-center gap-2 text-base font-semibold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.04] text-cyan-100"><Icon className="h-4 w-4" /></span>{platform}<span className="text-[10px] font-normal text-slate-500">{offers.length} {offers.length === 1 ? "offer" : "offers"}</span></h3>{offers.length > 3 && <button onClick={() => setSelectedPlatform(platform)} className="text-[10px] font-medium text-cyan-200 hover:text-white">View all {platform} offers <ArrowUpRight className="ml-1 inline h-3 w-3" /></button>}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{offers.slice(0, 3).map((service) => <PublicServiceCard key={service.id} service={service} onSelect={() => startSignup(`/dashboard?serviceId=${service.id}`)} />)}</div></section>; })}</div> : <div className="mt-5"><div className="mb-4 flex items-center justify-between border-b border-white/[.07] pb-3"><h3 className="inline-flex items-center gap-2 text-base font-semibold text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.04] text-cyan-100">{(() => { const Icon = serviceIcon(selectedPlatform); return <Icon className="h-4 w-4" />; })()}</span>{selectedPlatform}</h3><button onClick={() => setSelectedPlatform("All platforms")} className="text-[10px] text-slate-400 hover:text-white">Show all platforms</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{orderedServices.filter((service) => service.platform === selectedPlatform).map((service) => <PublicServiceCard key={service.id} service={service} onSelect={() => startSignup(`/dashboard?serviceId=${service.id}`)} />)}</div></div>}
            {services.length > 0 && services.length > 6 && <p className="mt-7 text-center text-[10px] text-slate-500">Browse every active offer by platform above. Sign in to place orders and follow delivery status.</p>}
          </div>
        </section>

        <section id="pricing" className="scroll-mt-24 mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid overflow-hidden rounded-[26px] border border-blue-300/15 bg-[linear-gradient(135deg,rgba(45,95,191,.2),rgba(15,23,36,.96)_45%)] lg:grid-cols-[1.04fr_.96fr]">
            <div className="p-6 sm:p-9 lg:p-11"><p className="text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">Transparent pricing</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">Know the estimate before checkout.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-slate-400">Adjust the quantity for an active service to see an estimate based on its current listed rate. Your final order summary is confirmed in your account.</p>
              {selectedService ? <div className="mt-7 max-w-lg space-y-5">
                <label className="grid gap-2 text-xs font-medium text-slate-300">Service<select value={selectedServiceId || String(selectedService.id)} onChange={(event) => { const next = services.find((item) => item.id === Number(event.target.value)); setSelectedServiceId(event.target.value); if (next) setQuantity(next.minQuantity); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#0a111b] px-3 text-sm text-white"><optgroup label="Active services">{services.map((service) => <option key={service.id} value={service.id}>{service.platform} · {service.name}</option>)}</optgroup></select></label>
                <div><div className="mb-3 flex items-center justify-between gap-3 text-xs"><label htmlFor="quantity-range" className="font-medium text-slate-300">Quantity</label><span className="font-semibold tabular-nums text-white">{quantity.toLocaleString()} units</span></div><input id="quantity-range" aria-label="Quantity" type="range" min={selectedService.minQuantity} max={selectedService.maxQuantity} step={Math.max(1, Math.round((selectedService.maxQuantity - selectedService.minQuantity) / 100))} value={Math.min(Math.max(quantity, selectedService.minQuantity), selectedService.maxQuantity)} onChange={(event) => setQuantity(Number(event.target.value))} className="w-full accent-cyan-300" /><div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>Min {selectedService.minQuantity.toLocaleString()}</span><span>Max {selectedService.maxQuantity.toLocaleString()}</span></div></div>
                <div className="flex items-end justify-between border-t border-white/10 pt-4"><div><p className="text-xs text-slate-400">Estimated total</p><p className="mt-1 text-2xl font-semibold tracking-tight text-white">{money(estimate)}</p></div><p className="text-right text-[10px] leading-4 text-slate-500">{money(Number(selectedService.retailRatePer1k))}<br />per 1,000 units</p></div>
              </div> : <div className="mt-7 rounded-xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">Pricing estimates will be available when active services are published.</div>}
            </div>
            <div className="border-t border-white/[.08] bg-black/10 p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-11">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200"><WalletCards className="h-5 w-5" /></span><div><p className="text-sm font-semibold">A straightforward order flow</p><p className="mt-1 text-xs text-slate-500">Clear steps. No hidden calculator assumptions.</p></div></div>
              <div className="mt-7 grid gap-5">{[[Check, "Select a live service", "See its platform, limits, and current rate."], [CircleDollarSign, "Review the total", "Your order charge is shown before you confirm."], [Clock3, "Track order and wallet activity", "Check order status and account ledger from your dashboard."]].map(([Icon, title, detail]) => { const StepIcon = Icon as typeof Check; return <div key={title as string} className="flex gap-3"><span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.04] text-cyan-100"><StepIcon className="h-3.5 w-3.5" /></span><div><p className="text-sm font-medium text-slate-100">{title as string}</p><p className="mt-1 text-xs leading-5 text-slate-400">{detail as string}</p></div></div>; })}</div>
              <button onClick={() => startLogin("/dashboard")} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-50">Open your dashboard <ArrowRight className="h-4 w-4" /></button>
              <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">Wallet top-up requests are subject to administrator review.</p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 border-t border-white/[.07]">
          <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-200">Built for a smoother workflow</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">From selection to status, clearly.</h2></div><p className="max-w-sm text-sm leading-6 text-slate-400">The tools you need to place and monitor orders, without hunting through messages.</p></div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">{[["01", "Choose a service", "Browse active offers with platform, limits, and per-unit pricing."], ["02", "Submit your order", "Add a valid target link and quantity; check the total before placing it."], ["03", "Follow progress", "Return to your account to review order status and wallet activity."]].map(([number, title, description]) => <article key={number} className="rounded-2xl border border-white/[.08] bg-white/[.02] p-5 sm:p-6"><span className="text-xs font-semibold tracking-[.16em] text-cyan-200">STEP {number}</span><h3 className="mt-5 text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{description}</p></article>)}</div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16"><div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-blue-300/15 bg-blue-300/[.045] p-6 sm:flex-row sm:items-center sm:p-8"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-cyan-200">Ready when you are</p><h2 className="mt-2 text-xl font-semibold tracking-tight">Set up your account and see the catalog.</h2><p className="mt-2 text-sm text-slate-400">Orders, delivery updates, and wallet activity in one place.</p></div><button onClick={() => startSignup("/dashboard")} className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400 sm:w-auto">Create account <ArrowRight className="h-4 w-4" /></button></div></section>
      </main>

      <footer className="relative z-10 border-t border-white/[.07]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5 font-semibold text-slate-200"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500"><Sparkles className="h-3.5 w-3.5" /></span> orbit growth</Link>
          <span>Pricing and availability reflect the active service catalog. Wallet requests may require review.</span>
          <button onClick={() => startLogin()} className="inline-flex items-center gap-1 font-medium text-slate-300 hover:text-white">Sign in <ChevronDown className="h-3.5 w-3.5 -rotate-90" /></button>
        </div>
      </footer>
    </div>
  );
}
