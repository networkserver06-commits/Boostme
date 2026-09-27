import { ArrowLeft, BookOpen, CheckCircle2, FileText, Info, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

const content = {
  "/how-to-use": {
    title: "How to use Orbit Growth",
    eyebrow: "A simple growth workflow",
    icon: BookOpen,
    intro: "Choose a platform, compare services, and track every delivery from one clear account.",
    sections: [
      ["1. Create or access your account", "Sign in or create an account to access the order form, wallet, and My Orders tracking."],
      ["2. Choose a platform and category", "Select the platform you need, then choose a category such as Cheapest Services, High Speed, NON DROP, Organic, Likes, Views, or Followers. Use the search bar when you already know what you need."],
      ["3. Review the service", "Read the service description, minimum and maximum quantity, estimated delivery information, and charge before placing an order."],
      ["4. Place and follow your order", "Add a valid target link, enter the quantity, and place the order. Open My Orders to refresh progress, view counts, cancel eligible orders, or contact support."],
      ["5. Manage your wallet", "Add funds through the wallet page and review every credit, charge, refund, and balance change in the wallet history."],
    ],
  },
  "/terms": {
    title: "Terms of service",
    eyebrow: "Please read before ordering",
    icon: FileText,
    intro: "These terms describe the basic rules for using Orbit Growth services and your account.",
    sections: [
      ["Authorized use", "You may only submit links, accounts, and content that you own or are authorized to manage. You are responsible for complying with each platform's rules."],
      ["Orders and delivery", "Service availability, delivery speed, and results can vary by provider and platform. An order is considered complete when the provider reports completion or the configured delivery target is reached."],
      ["Payments and refunds", "Charges are shown before an order is placed. Eligible cancellations and provider refunds are returned to the account wallet according to the order status and provider response."],
      ["Account responsibility", "Keep your login details private and provide accurate information. Do not use the service for unlawful, abusive, deceptive, or unauthorized activity."],
      ["Service changes", "Orbit Growth may update, pause, or remove services when provider availability, platform rules, or operational conditions change."],
    ],
  },
  "/about": {
    title: "About Orbit Growth",
    eyebrow: "Social growth, simplified",
    icon: Info,
    intro: "Orbit Growth gives customers a clearer way to compare social growth services, place orders, and follow delivery progress.",
    sections: [
      ["One clear workspace", "Platform-first navigation, transparent KES pricing, wallet history, and My Orders tracking keep the full customer journey in one place."],
      ["Built for clarity", "The catalog is organized by platform and category so you can find the right service without searching through an unstructured provider list."],
      ["Designed for Kenya", "The experience prioritizes the platforms customers use most in Kenya and presents charges in KES for easier decision-making."],
    ],
  },
} as const;

export default function InfoPage() {
  const [location] = useLocation();
  const page = content[location as keyof typeof content] ?? content["/about"];
  const Icon = page.icon;

  return <div className="min-h-screen bg-[#080d15] text-white selection:bg-cyan-400/30"><div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(40,105,220,.18),transparent_37%),radial-gradient(ellipse_at_90%_20%,rgba(25,182,190,.09),transparent_28%)]" /><header className="relative z-10 border-b border-white/[.07] bg-[#080d15]/85 backdrop-blur-xl"><div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-5 lg:px-8"><Link href="/" className="flex items-center gap-2.5" aria-label="Orbit Growth home"><span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500"><Sparkles className="h-4 w-4" /></span><span className="text-sm font-semibold tracking-[-.03em]">orbit growth</span></Link><Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:border-cyan-200/25 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back home</Link></div></header><main className="relative z-10 mx-auto max-w-3xl px-5 py-14 sm:py-20 lg:px-8"><div className="rounded-[28px] border border-white/[.1] bg-[#0e1622]/90 p-6 shadow-[0_24px_100px_rgba(0,0,0,.32)] sm:p-10"><div className="grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/15 bg-cyan-300/[.08] text-cyan-100"><Icon className="h-5 w-5" /></div><p className="mt-7 text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">{page.eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.05em] sm:text-4xl">{page.title}</h1><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">{page.intro}</p><div className="mt-9 space-y-3">{page.sections.map(([heading, text]) => <section key={heading} className="rounded-2xl border border-white/[.08] bg-white/[.025] p-5"><h2 className="flex items-start gap-2 text-sm font-semibold text-white"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />{heading}</h2><p className="mt-2 pl-6 text-sm leading-6 text-slate-400">{text}</p></section>)}</div><div className="mt-9 flex flex-col gap-3 border-t border-white/[.08] pt-6 sm:flex-row"><Link href="/auth" className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-400">Create an account</Link><Link href="/" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 hover:border-white/20 hover:text-white">Explore the service catalog</Link></div></div></main></div>;
}
