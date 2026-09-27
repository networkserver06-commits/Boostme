import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import Auth from "@/pages/Auth";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Admin = lazy(() => import("@/pages/Admin"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Services = lazy(() => import("@/pages/Services"));
const Account = lazy(() => import("@/pages/Account"));
const InfoPage = lazy(() => import("@/pages/InfoPage"));

function Router() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center bg-[#080d15] text-sm text-slate-400">Loading your page…</div>}><Switch><Route path="/" component={Home} /><Route path="/auth" component={Auth} /><Route path="/how-to-use" component={InfoPage} /><Route path="/terms" component={InfoPage} /><Route path="/about" component={InfoPage} /><Route path="/dashboard" component={Dashboard} /><Route path="/dashboard/new-order" component={Dashboard} /><Route path="/dashboard/services" component={Services} /><Route path="/dashboard/orders" component={Dashboard} /><Route path="/dashboard/wallet" component={Dashboard} /><Route path="/dashboard/account" component={Account} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></Suspense>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
