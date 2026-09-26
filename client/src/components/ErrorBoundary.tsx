import { cn } from "@/lib/utils";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" className="flex min-h-screen items-center justify-center bg-[#080d15] p-5 text-white">
          <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.03] p-7 text-center shadow-2xl sm:p-9">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/[.08] text-rose-200"><AlertTriangle className="h-6 w-6" /></span>
            <h1 className="mt-5 text-xl font-semibold tracking-tight">We hit an unexpected problem</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Your information is safe. Reload the page or return to the home page and try again.</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => window.location.reload()} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 text-sm font-medium text-white hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-cyan-200")}><RotateCcw className="h-4 w-4" />Reload page</button>
              <a href="/" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-sm font-medium text-slate-200 hover:bg-white/[.05] focus-visible:ring-2 focus-visible:ring-cyan-200"><Home className="h-4 w-4" />Go to home</a>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
