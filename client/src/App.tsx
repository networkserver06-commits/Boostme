import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Admin from "@/pages/Admin";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/dashboard" component={Dashboard} /><Route path="/dashboard/orders" component={Dashboard} /><Route path="/dashboard/wallet" component={Dashboard} /><Route path="/admin" component={Admin} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster theme="dark" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
