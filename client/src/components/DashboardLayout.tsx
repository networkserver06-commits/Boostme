import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { preloadRoute } from "@/lib/routePreload";
import { friendlyErrorMessage } from "@shared/errorMessages";
import { showErrorToast } from "@/lib/toasts";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import { cn } from "@/lib/utils";
import { ArrowUpRight, BookOpen, CircleUserRound, CreditCard, FileText, Home, Info, LayoutDashboard, LogOut, Menu, PlusCircle, Settings2, ShoppingBag, Sparkles, Store, WalletCards, X } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const accountItems = [
  { icon: LayoutDashboard, label: "Home", path: "/dashboard" },
  { icon: Store, label: "Services", path: "/dashboard/services" },
  { icon: PlusCircle, label: "Place order", path: "/dashboard/new-order" },
  { icon: ShoppingBag, label: "Orders", path: "/dashboard/orders" },
  { icon: CreditCard, label: "Wallet", path: "/dashboard/wallet" },
  { icon: CircleUserRound, label: "Account details", path: "/dashboard/account" },
  { icon: BookOpen, label: "How to use", path: "/how-to-use" },
  { icon: FileText, label: "Terms of service", path: "/terms" },
  { icon: Info, label: "About", path: "/about" },
];
const adminItems = [{ icon: Settings2, label: "Admin console", path: "/admin" }];
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 264;
const MIN_WIDTH = 216;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const value = saved ? Number.parseInt(saved, 10) : DEFAULT_WIDTH;
    return Number.isFinite(value) && value >= MIN_WIDTH && value <= MAX_WIDTH ? value : DEFAULT_WIDTH;
  });
  const { loading, user, error, refresh } = useAuth();
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()); }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (error) return <div role="alert" className="grid min-h-screen place-items-center bg-[#080d15] px-5 text-white"><section className="w-full max-w-md rounded-3xl border border-rose-300/15 bg-white/[.03] p-8 text-center"><h1 className="text-xl font-semibold">We couldn't confirm your session</h1><p className="mt-3 text-sm leading-6 text-slate-400">{friendlyErrorMessage(error, "Check your connection and try again.")}</p><Button className="mt-5 w-full" onClick={() => void refresh()}>Retry</Button></section></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-[#080d15] px-5 text-white"><div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-white/10 bg-white/[.03] p-8 text-center shadow-2xl sm:p-10"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-blue-200"><Sparkles className="h-6 w-6" /></span><div><h1 className="text-2xl font-semibold tracking-tight">Your account is waiting</h1><p className="mt-3 text-sm leading-6 text-slate-400">Sign in to manage orders, review wallet activity, and follow delivery updates.</p></div><Button onClick={() => startLogin(window.location.pathname + window.location.search)} size="lg" className="w-full">Sign in to continue <ArrowUpRight className="h-4 w-4" /></Button></div></div>;

  return <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

type DashboardLayoutContentProps = { children: React.ReactNode; setSidebarWidth: (width: number) => void };
function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const items = [...accountItems, ...(isAdmin ? adminItems : [])];
  const activeItem = items.find((item) => item.path === location) ?? items.find((item) => item.path !== "/dashboard" && location.startsWith(`${item.path}/`));
  const title = activeItem?.label ?? (location.startsWith("/admin") ? "Admin console" : "Overview");

  useEffect(() => { if (isCollapsed) setIsResizing(false); }, [isCollapsed]);
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => { document.removeEventListener("mousemove", handleMouseMove); document.removeEventListener("mouseup", handleMouseUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
  }, [isResizing, setSidebarWidth]);

  const signOut = async () => {
    try { await logout(); toast.success("Signed out"); setLocation("/"); }
    catch (error) { showErrorToast(error, "Couldn't sign out", "Please check your connection and try again."); }
  };

  const renderItems = (menuItems: typeof accountItems) => menuItems.map((item) => {
    const isActive = location === item.path || (item.path !== "/dashboard" && location.startsWith(`${item.path}/`));
    return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} aria-current={isActive ? "page" : undefined} onPointerEnter={() => preloadRoute(item.path)} onFocus={() => preloadRoute(item.path)} onClick={() => { setLocation(item.path); setOpenMobile(false); }} tooltip={item.label} className={cn("h-11 rounded-xl font-medium transition-all hover:bg-cyan-200/[.06]", isActive && "bg-gradient-to-r from-cyan-300/[.16] to-blue-400/[.10] text-cyan-50 shadow-[inset_3px_0_0_rgba(103,232,249,.9)] ring-1 ring-cyan-200/10")}><item.icon className={cn("h-4 w-4", isActive ? "text-blue-200" : "text-slate-400")} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>;
  });

  const mobilePrimary = [{ icon: Home, label: "Home", path: "/dashboard" }, { icon: PlusCircle, label: "Place order", path: "/dashboard/new-order" }, { icon: WalletCards, label: "Add funds", path: "/dashboard/wallet" }, { icon: ShoppingBag, label: "My orders", path: "/dashboard/orders" }, { icon: Menu, label: "Main menu", path: "#menu" }];

  return <>
    <div className="relative shrink-0" ref={sidebarRef}>
      <Sidebar collapsible="icon" className="border-r border-cyan-200/10 bg-[#0a1422] shadow-[8px_0_30px_rgba(8,13,21,.2)]" disableTransition={isResizing}>
        <SidebarHeader className="h-[72px] justify-center border-b border-white/[.06] px-3"><div className="flex w-full items-center gap-2">{!isCollapsed && <button type="button" onClick={() => setLocation("/")} className="flex min-w-0 items-center gap-2.5 text-left" aria-label="Go to Orbit Growth home"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white"><Sparkles className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold tracking-[-.03em] text-white">orbit growth</span><span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-[.16em] text-slate-500">Growth account</span></span></button>}</div></SidebarHeader>
        <SidebarContent className="gap-0 px-2 py-4"><p className="px-3 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[.18em] text-slate-600 group-data-[collapsible=icon]:sr-only">Your account</p><SidebarMenu className="gap-1">{renderItems(accountItems)}</SidebarMenu>{isAdmin && <><div className="my-4 h-px bg-white/[.07] group-data-[collapsible=icon]:mx-1" /><p className="px-3 pb-2 text-[9px] font-semibold uppercase tracking-[.18em] text-slate-600 group-data-[collapsible=icon]:sr-only">Manage</p><SidebarMenu className="gap-1">{renderItems(adminItems)}</SidebarMenu></>}<div className="mt-auto pt-5"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={() => { setLocation("/"); setOpenMobile(false); }} tooltip="Explore offers" className="h-11 rounded-xl font-medium text-slate-300 transition-colors hover:bg-cyan-200/[.06] hover:text-cyan-50"><Store className="h-4 w-4 text-cyan-200" /><span>Explore offers</span><ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-60" /></SidebarMenuButton></SidebarMenuItem></SidebarMenu></div></SidebarContent>
        <SidebarFooter className="border-t border-white/[.06] p-2.5"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[.05] focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center"><Avatar className="h-9 w-9 shrink-0 border border-white/10 bg-blue-500/10"><AvatarFallback className="bg-blue-400/10 text-xs font-semibold text-blue-100">{(user?.name || user?.email || "OG").charAt(0).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-xs font-medium text-white">{location === "/dashboard/account" ? "Account details" : (user?.name || "Your account")}</span><span className="mt-1 block truncate text-[10px] text-slate-500">{location === "/dashboard/account" ? "Profile & security" : (user?.email || "")}</span></span><span className="text-[9px] font-medium uppercase tracking-wider text-slate-500 group-data-[collapsible=icon]:hidden">{isAdmin ? "Admin" : "Member"}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52 border-white/10 bg-[#111a27] text-slate-100"><div className="px-2 py-1.5"><p className="truncate text-xs font-medium">{user?.name || "Your account"}</p><p className="mt-1 truncate text-[10px] text-slate-500">{user?.email}</p></div><DropdownMenuSeparator className="bg-white/10" /><DropdownMenuItem onClick={() => setLocation("/")} className="cursor-pointer focus:bg-white/10"><Store className="mr-2 h-4 w-4" />Explore offers</DropdownMenuItem><DropdownMenuItem onClick={signOut} className="cursor-pointer text-rose-300 focus:bg-rose-400/10 focus:text-rose-200"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      <div className={cn("absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-blue-400/25", isCollapsed && "hidden")} onMouseDown={() => { if (!isCollapsed && !isMobile) setIsResizing(true); }} aria-hidden="true" />
    </div>
    <SidebarInset className="min-w-0 overflow-x-hidden bg-[#080d15]"><header className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-cyan-200/10 bg-gradient-to-r from-[#0b1726]/95 via-[#08111d]/95 to-[#0b1524]/95 px-4 shadow-[0_8px_30px_rgba(8,13,21,.18)] backdrop-blur-xl sm:px-6"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="h-9 w-9 rounded-lg border border-white/[.08] text-slate-300 hover:bg-white/[.06]" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{title}</p><p className="hidden text-[10px] text-slate-500 sm:block">Orbit Growth <span className="mx-1.5 text-slate-700">/</span> {title}</p></div></div><div className="flex items-center gap-2"><span className="hidden items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-300/[.04] px-2.5 py-1.5 text-[10px] text-emerald-200 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Account secured</span><Button size="sm" onClick={() => setLocation(isAdmin ? "/dashboard" : "/dashboard/new-order")} className="hidden h-9 rounded-xl border border-cyan-200/15 bg-cyan-300/[.10] px-3 text-xs text-cyan-50 shadow-lg shadow-cyan-950/20 hover:bg-cyan-300/[.16] sm:inline-flex">{isAdmin ? <CircleUserRound className="h-3.5 w-3.5" /> : <ShoppingBag className="h-3.5 w-3.5" />}{isAdmin ? "Customer view" : "New order"}</Button></div></header><div className="min-w-0 flex-1 p-3 pb-24 sm:p-5 sm:pb-5 lg:p-7">{children}</div>{mobileMenuOpen && <div className="fixed inset-x-3 bottom-[76px] z-50 rounded-2xl border border-white/10 bg-[#111a27]/[.98] p-3 shadow-2xl backdrop-blur-xl md:hidden"><div className="mb-2 flex items-center justify-between px-2"><p className="text-xs font-semibold text-white">Main menu</p><button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"><X className="h-4 w-4" /></button></div>{items.map((item) => <button type="button" key={item.path} onClick={() => { setLocation(item.path); setMobileMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-200 hover:bg-white/[.06]"><item.icon className="h-4 w-4 text-cyan-200" />{item.label}</button>)}<button type="button" onClick={() => void signOut()} className="mt-2 flex w-full items-center gap-3 rounded-xl border-t border-white/[.07] px-3 py-3 text-left text-sm text-rose-200"><LogOut className="h-4 w-4" />Sign out</button></div>}<nav aria-label="Mobile account navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.08] bg-[#0a1019]/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,.22)] backdrop-blur-xl md:hidden"><ul className="mx-auto grid max-w-md grid-cols-5">{mobilePrimary.map((item, index) => { const active = item.path !== "#menu" && (location === item.path || (item.path !== "/dashboard" && location.startsWith(`${item.path}/`))); return <li key={`${item.label}-${index}`}><button onPointerEnter={() => item.path !== "#menu" && preloadRoute(item.path)} onFocus={() => item.path !== "#menu" && preloadRoute(item.path)} onClick={() => item.path === "#menu" ? setMobileMenuOpen((open) => !open) : setLocation(item.path)} aria-current={active ? "page" : undefined} className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium ${active || (item.path === "#menu" && mobileMenuOpen) ? "text-cyan-100" : "text-slate-500 hover:text-slate-200"}`}><item.icon className={`h-[18px] w-[18px] ${active || (item.path === "#menu" && mobileMenuOpen) ? "text-cyan-200" : ""}`} /><span className="max-w-full truncate">{item.label}</span></button></li>; })}</ul></nav></SidebarInset>
  </>;
}
