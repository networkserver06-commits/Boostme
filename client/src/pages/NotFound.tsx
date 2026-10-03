import { AlertCircle, ArrowLeft, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import ThemeToggle from "@/components/ThemeToggle";

export default function NotFound() {
  const [, setLocation] = useLocation();
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 text-foreground">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(40,105,220,.16),transparent_37%),radial-gradient(ellipse_at_90%_20%,rgba(25,182,190,.08),transparent_28%)]" />
      <div className="absolute right-5 top-5"><ThemeToggle compact /></div>
      <main className="relative z-10 w-full max-w-lg rounded-[28px] border border-border bg-card/90 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-400"><AlertCircle className="h-8 w-8" /></div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.2em] text-cyan-200">Orbit Growth</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-[-.06em]">404</h1>
        <h2 className="mt-2 text-xl font-semibold">Page not found</h2>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">This route may have moved, or the link may be out of date. Return to the catalog and continue from there.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={() => setLocation("/")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"><Home className="h-4 w-4" />Go home</button>
          <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium text-foreground hover:bg-accent"><ArrowLeft className="h-4 w-4" />Open dashboard</Link>
        </div>
      </main>
    </div>
  );
}
