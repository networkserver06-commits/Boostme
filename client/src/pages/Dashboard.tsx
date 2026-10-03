import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { friendlyErrorMessage } from "@shared/errorMessages";
import { calculateCheckoutEconomics } from "@shared/finance";
import {
  compareCustomerPlatforms,
  isCustomerVisiblePlatform,
} from "@shared/serviceCatalog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Facebook,
  Info,
  Instagram,
  Link2,
  LockKeyhole,
  Linkedin,
  Loader2,
  MessageCircle,
  Music2,
  PhoneCall,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  WalletCards,
  XCircle,
  Youtube,
} from "lucide-react";
import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const MIN_DEPOSIT_KES = 10;
const money = (value: unknown) =>
  `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const serviceOptionLabel = (
  service: { platform: string; name: string; retailRatePer1k: string },
  includePlatform: boolean
) => {
  const name = service.name.replace(/\s+/g, " ").trim();
  const conciseName =
    name.length > 58 ? `${name.slice(0, 55).trimEnd()}…` : name;
  return `${includePlatform ? `${service.platform} · ` : ""}${conciseName} · ${money(service.retailRatePer1k)} / 1k`;
};
const displayStatus = (status: string) => status.replaceAll("_", " ");
const SUPPORT_WHATSAPP_NUMBER = "254116553618";
const supportWhatsAppLink = (orderId: number) =>
  `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello Orbit Growth support, I need help with order #${orderId}.`)}`;
const orderStatusTabs = [
  { value: "all", label: "All orders", Icon: ShoppingBag },
  { value: "pending", label: "Pending", Icon: Clock3 },
  { value: "in_progress", label: "In progress", Icon: RefreshCw },
  { value: "completed", label: "Completed", Icon: CheckCircle2 },
  { value: "canceled", label: "Canceled", Icon: XCircle },
  { value: "partial", label: "Partial", Icon: AlertTriangle },
  { value: "failed", label: "Failed", Icon: AlertTriangle },
];
const terminalOrderStatuses = ["completed", "canceled", "failed"];
const orderProgress = (order: {
  quantity: number;
  remains?: number | null;
  startCount?: number | null;
  status: string;
}) => {
  if (order.status === "completed") return 100;
  if (terminalOrderStatuses.includes(order.status)) return 0;
  if (order.remains == null || order.quantity <= 0) return 0;
  return Math.max(
    0,
    Math.min(99, ((order.quantity - order.remains) / order.quantity) * 100)
  );
};
const deliveryMessage = (order: {
  status: string;
  providerOrderId?: string | null;
  remains?: number | null;
}) => {
  if (order.status === "completed") return "Delivery completed";
  if (order.status === "canceled") return "Order canceled and refunded";
  if (order.status === "failed")
    return "Delivery failed; contact support if needed";
  if (!order.providerOrderId) return "Waiting for provider submission";
  if (order.status === "partial")
    return `${order.remains?.toLocaleString() ?? "Some"} units remain to be delivered`;
  if (order.status === "in_progress")
    return "Provider is delivering this order";
  return "Order accepted; delivery is starting";
};
const validHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
};
const platformHosts: Record<string, string[]> = {
  Instagram: ["instagram.com"],
  TikTok: ["tiktok.com"],
  YouTube: ["youtube.com", "youtu.be"],
  Facebook: ["facebook.com", "fb.watch", "fb.me"],
  X: ["x.com", "twitter.com"],
  WhatsApp: ["whatsapp.com", "wa.me"],
  Telegram: ["t.me", "telegram.me"],
};
const categoryLabel = (category: string) => {
  const value = category.toLowerCase();
  if (value.includes("cheap")) return "Cheapest Services 🔥⚡";
  if (value.includes("speed")) return "High Speed Services";
  if (value.includes("non drop") || value.includes("non-drop"))
    return "NON DROP Services";
  if (value.includes("organic") || value.includes("real"))
    return "Organic Services | 100% REAL";
  if (value.includes("best")) return "Best Services";
  return category;
};
const normalizeCategory = (category: string) =>
  category.trim().replace(/\s+/g, " ").toLowerCase();
const platformStyle = (platform: string) => {
  const value = platform.toLowerCase();
  if (value.includes("instagram"))
    return {
      Icon: Instagram,
      className:
        "bg-gradient-to-br from-pink-500 via-rose-500 to-amber-300 text-white",
      short: "IG",
    };
  if (value.includes("youtube"))
    return { Icon: Youtube, className: "bg-red-500 text-white", short: "YT" };
  if (value.includes("facebook"))
    return { Icon: Facebook, className: "bg-blue-600 text-white", short: "FB" };
  if (value.includes("tiktok"))
    return { Icon: Music2, className: "bg-slate-950 text-white", short: "TT" };
  if (value.includes("linkedin"))
    return { Icon: Linkedin, className: "bg-blue-700 text-white", short: "LI" };
  if (value === "x" || value.includes("twitter"))
    return { Icon: Sparkles, className: "bg-black text-white", short: "X" };
  if (value.includes("threads"))
    return { Icon: Sparkles, className: "bg-black text-white", short: "@" };
  if (value.includes("snapchat"))
    return {
      Icon: Sparkles,
      className: "bg-yellow-300 text-black",
      short: "SC",
    };
  if (value.includes("pinterest"))
    return { Icon: Sparkles, className: "bg-red-600 text-white", short: "P" };
  if (value.includes("reddit"))
    return {
      Icon: Sparkles,
      className: "bg-orange-500 text-white",
      short: "R",
    };
  if (value.includes("discord") || value.includes("twitch"))
    return {
      Icon: MessageCircle,
      className: "bg-indigo-500 text-white",
      short: "DC",
    };
  if (
    value.includes("spotify") ||
    value.includes("soundcloud") ||
    value.includes("boomplay") ||
    value.includes("audiomack")
  )
    return { Icon: Music2, className: "bg-emerald-600 text-white", short: "♪" };
  if (value.includes("telegram"))
    return { Icon: Send, className: "bg-sky-500 text-white", short: "TG" };
  if (value.includes("whatsapp"))
    return {
      Icon: MessageCircle,
      className: "bg-emerald-500 text-white",
      short: "WA",
    };
  return {
    Icon: Sparkles,
    className: "bg-blue-500 text-white",
    short: platform.slice(0, 2).toUpperCase() || "•",
  };
};

function PlatformLogo({
  platform,
  size = "md",
}: {
  platform: string;
  size?: "sm" | "md";
}) {
  const { Icon, className, short } = platformStyle(platform);
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-xl border border-white/25 font-bold shadow-md ${size === "sm" ? "h-8 w-8 text-[9px]" : "h-10 w-10 text-[10px]"} ${className}`}
    >
      {Icon === Sparkles ? (
        short
      ) : (
        <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} />
      )}
    </span>
  );
}

type Order = {
  id: number;
  serviceId: number;
  serviceName?: string;
  servicePlatform?: string;
  serviceCategory?: string;
  providerId?: number | null;
  providerOrderId?: string | null;
  targetLink: string;
  quantity: number;
  charge: string;
  startCount?: number | null;
  remains?: number | null;
  status: string;
  errorMessage?: string | null;
  createdAt: Date;
  updatedAt?: Date;
};
type WalletEntry = {
  id: number;
  reference: string;
  type: string;
  amount: string;
  balanceAfter: string;
  status: string;
};

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isOrdersPage = location === "/dashboard/orders";
  const isWalletPage = location === "/dashboard/wallet";
  const isPlaceOrderPage = [
    "/dashboard/new-order",
    "/dashboard/order",
    "/dashboard/place-order",
  ].includes(location);
  const isOverviewPage = !isOrdersPage && !isWalletPage && !isPlaceOrderPage;
  const overview = trpc.dashboard.overview.useQuery(undefined, {
    enabled: isOverviewPage || isWalletPage,
  });
  const services = trpc.dashboard.services.useQuery(undefined, {
    enabled: isOverviewPage || isPlaceOrderPage,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnMount: false,
    placeholderData: previous => previous,
  });
  const orders = trpc.dashboard.orders.useQuery(undefined, {
    enabled: isOverviewPage || isOrdersPage,
    refetchInterval: isOrdersPage ? 30000 : false,
  });
  const wallet = trpc.dashboard.wallet.useQuery(undefined, {
    enabled: isWalletPage,
  });
  const [serviceId, setServiceId] = useState(
    () => new URLSearchParams(window.location.search).get("serviceId") ?? ""
  );
  const [platform, setPlatform] = useState("");
  const [category, setCategory] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [quantity, setQuantity] = useState(1000);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [depositAmount, setDepositAmount] = useState(1000);
  const [phone, setPhone] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositStatus, setDepositStatus] = useState<
    "pending" | "success" | "failed" | ""
  >("");
  const [depositResponse, setDepositResponse] = useState<
    Record<string, string | undefined>
  >({});
  const [depositLastChecked, setDepositLastChecked] = useState<Date | null>(
    null
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const platformScrollRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const refreshOrderStatus = trpc.dashboard.refreshOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("Order status updated");
      void orders.refetch();
    },
    onError: error =>
      toast.error("Status refresh failed", {
        description: friendlyErrorMessage(
          error,
          "The provider status could not be read."
        ),
      }),
  });
  const cancelOrder = trpc.dashboard.cancelOrder.useMutation({
    onSuccess: () => {
      toast.success("Order canceled", {
        description:
          "The order was canceled and its charge was returned to your wallet.",
      });
      void orders.refetch();
      void overview.refetch();
      void wallet.refetch();
    },
    onError: error =>
      toast.error("Order could not be canceled", {
        description: friendlyErrorMessage(
          error,
          "The provider did not accept the cancellation."
        ),
      }),
  });

  const deferredCatalogSearch = useDeferredValue(catalogSearch);
  const searchTerm = deferredCatalogSearch.trim().toLowerCase();
  const searchableServices = useMemo(
    () =>
      (services.data ?? []).filter(
        service =>
          !searchTerm ||
          `${service.platform} ${service.category} ${service.name} ${service.description ?? ""}`
            .toLowerCase()
            .includes(searchTerm)
      ),
    [services.data, searchTerm]
  );
  const platforms = useMemo(
    () =>
      Array.from(
        new Set(
          (services.data ?? [])
            .map(service => service.platform)
            .filter(isCustomerVisiblePlatform)
        )
      ).sort(compareCustomerPlatforms),
    [services.data]
  );
  const visiblePlatforms = useMemo(
    () =>
      platforms.filter(
        item =>
          !searchTerm ||
          item.toLowerCase().includes(searchTerm) ||
          searchableServices.some(service => service.platform === item)
      ),
    [platforms, searchTerm, searchableServices]
  );
  const platformServices = useMemo(
    () =>
      searchableServices.filter(
        service => !platform || service.platform === platform
      ),
    [searchableServices, platform]
  );
  const categoryPriority = (value: string) => {
    const item = value.toLowerCase();
    return item.includes("like")
      ? 0
      : item.includes("follower")
        ? 1
        : item.includes("view")
          ? 2
          : item.includes("subscriber")
            ? 3
            : item.includes("comment")
              ? 4
              : item.includes("share")
                ? 5
                : item.includes("cheap")
                  ? 6
                  : item.includes("speed")
                    ? 7
                    : item.includes("non drop")
                      ? 8
                      : item.includes("organic")
                        ? 9
                        : item.includes("best")
                          ? 10
                          : 11;
  };
  const categoryOptions = useMemo(() => {
    const seen = new Map<
      string,
      { key: string; platform: string; category: string; label: string }
    >();
    platformServices.forEach(service => {
      const normalized = normalizeCategory(service.category);
      const key = platform ? normalized : normalized;
      if (!seen.has(key))
        seen.set(key, {
          key,
          platform: platform ? service.platform : "",
          category: service.category.trim().replace(/\s+/g, " "),
          label: categoryLabel(service.category.trim().replace(/\s+/g, " ")),
        });
    });
    return Array.from(seen.values()).sort(
      (a, b) =>
        compareCustomerPlatforms(a.platform, b.platform) ||
        categoryPriority(a.category) - categoryPriority(b.category) ||
        a.category.localeCompare(b.category)
    );
  }, [platformServices, platform]);
  const categoryServices = useMemo(() => {
    if (!category) return platformServices;
    return platformServices.filter(
      service => normalizeCategory(service.category) === category
    );
  }, [platformServices, platform, category]);
  const selected = categoryServices.find(
    service => service.id === Number(serviceId)
  );
  const targetLinkError =
    targetLink.trim() && !validHttpUrl(targetLink)
      ? "Enter a complete link beginning with https:// or http://."
      : selected &&
          targetLink.trim() &&
          platformHosts[selected.platform] &&
          (() => {
            try {
              const host = new URL(targetLink.trim()).hostname.toLowerCase();
              return !platformHosts[selected.platform].some(
                item => host === item || host.endsWith(`.${item}`)
              );
            } catch {
              return true;
            }
          })()
        ? `Use a valid ${selected.platform} link for this service.`
        : "";
  const submitGuidance = !selected
    ? "Select a service before submitting the order."
    : !targetLink.trim()
      ? "Add the public target link before submitting the order."
      : targetLinkError
        ? targetLinkError
        : quantity < selected.minQuantity || quantity > selected.maxQuantity
          ? `Enter a quantity between ${selected.minQuantity.toLocaleString()} and ${selected.maxQuantity.toLocaleString()}.`
          : "";
  useEffect(() => {
    const match = services.data?.find(
      service => service.id === Number(serviceId)
    );
    if (match) {
      setQuantity(match.minQuantity);
      setPlatform(match.platform);
      setCategory(normalizeCategory(match.category));
    }
  }, [services.data, serviceId]);
  const checkoutEconomics = selected
    ? calculateCheckoutEconomics({
        quantity,
        retailRatePer1k: selected.retailRatePer1k,
        wholesaleRatePer1k: selected.wholesaleRatePer1k,
      })
    : null;
  const calculatedCharge = checkoutEconomics?.retailAmountCalculated ?? 0;
  const charge = checkoutEconomics?.finalRetailCharged ?? 0;
  const filteredOrders = useMemo(
    () =>
      (orders.data ?? []).filter(
        order =>
          `${order.id} ${order.targetLink} ${order.serviceName ?? ""} ${order.servicePlatform ?? ""} ${order.serviceCategory ?? ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()) &&
          (statusFilter === "all" || order.status === statusFilter)
      ),
    [orders.data, search, statusFilter]
  );
  const notificationOrders = (orders.data ?? [])
    .filter(order =>
      ["pending", "in_progress", "partial"].includes(order.status)
    )
    .slice(0, 5);
  const scrollPlatforms = (direction: number) =>
    platformScrollRef.current?.scrollBy({
      left: direction * 260,
      behavior: "smooth",
    });
  const scrollCategories = (direction: number) =>
    categoryScrollRef.current?.scrollBy({
      left: direction * 240,
      behavior: "smooth",
    });
  const createOrder = trpc.dashboard.createOrder.useMutation({
    onSuccess: result => {
      toast.success("Order placed", {
        description: `Order #${result.orderId} was submitted and is now being tracked.`,
      });
      void overview.refetch();
      void orders.refetch();
      void wallet.refetch();
      setTargetLink("");
      setLocation("/dashboard/orders");
    },
    onError: error =>
      toast.error("Order not placed", {
        description: friendlyErrorMessage(
          error,
          "Review the service, link, quantity, and wallet balance, then try again."
        ),
        duration: 6500,
        closeButton: true,
      }),
  });
  const requestDeposit = trpc.dashboard.requestDeposit.useMutation({
    onSuccess: data => {
      setDepositReference(data.reference);
      setDepositStatus(data.status);
      setDepositResponse(data.gatewayResponse ?? {});
      setDepositLastChecked(new Date());
      toast.success("M-Pesa prompt sent", { description: data.message });
      void overview.refetch();
      void wallet.refetch();
      setPhone("");
    },
    onError: error =>
      toast.error("Top-up request failed", {
        description: friendlyErrorMessage(
          error,
          "Check the details and your connection, then try again."
        ),
        duration: 6500,
      }),
  });
  const checkDeposit = trpc.dashboard.checkDeposit.useMutation({
    onSuccess: data => {
      setDepositStatus(data.status);
      setDepositResponse(data.gatewayResponse ?? {});
      setDepositLastChecked(new Date());
      if (data.status === "success") {
        toast.success("Wallet funded", {
          description:
            "LeeTec confirmed your M-Pesa payment and the wallet balance was updated.",
        });
        void overview.refetch();
        void wallet.refetch();
      } else if (data.status === "failed")
        toast.error("Payment was not completed", {
          description:
            "LeeTec reported that the payment was not completed. No wallet credit was added.",
        });
    },
  });
  const checkDepositNow = (silent = false) => {
    if (!depositReference) return;
    checkDeposit.mutate(
      { reference: depositReference },
      silent
        ? undefined
        : {
            onError: error =>
              toast.error("Payment status unavailable", {
                description: friendlyErrorMessage(
                  error,
                  "Try checking again in a moment."
                ),
                closeButton: true,
              }),
          }
    );
  };
  useEffect(() => {
    if (!depositReference || depositStatus !== "pending") return;
    const timer = window.setInterval(() => checkDepositNow(true), 5_000);
    return () => window.clearInterval(timer);
  }, [depositReference, depositStatus]);

  const heading = isOrdersPage
    ? "Follow every order."
    : isWalletPage
      ? "Your wallet, clearly tracked."
      : isPlaceOrderPage
        ? "Place a new order."
        : `Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : " back"}.`;
  const description = isOrdersPage
    ? "Search and filter your order history. Status refreshes automatically."
    : isWalletPage
      ? "Review wallet entries and submit a top-up request for administrator review."
      : isPlaceOrderPage
        ? "Choose a platform, category, and service, then review your charge before placing the order."
        : "See your balance, place an order, and keep an eye on delivery progress.";

  return (
    <DashboardLayout>
      <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 overflow-x-hidden">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">
              Your account <span className="mx-1.5 text-slate-600">/</span>{" "}
              {isOrdersPage
                ? "Orders"
                : isWalletPage
                  ? "Wallet"
                  : isPlaceOrderPage
                    ? "Place order"
                    : "Overview"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.045em] text-white sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {description}
            </p>
          </div>
          {isOrdersPage && (
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-blue-200/10 bg-blue-200/[.05] px-3 py-2 text-xs text-blue-100 sm:self-auto">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-300" />{" "}
              Refreshes every 30 sec
            </span>
          )}
        </header>

        {(isOverviewPage || isPlaceOrderPage) && (
          <>
            {isOverviewPage && (
              <section className="theme-card-surface relative overflow-visible rounded-2xl border border-cyan-200/10 bg-[linear-gradient(135deg,rgba(29,78,216,.22),rgba(13,20,31,.94)_62%)] p-5 shadow-[0_18px_70px_rgba(0,0,0,.16)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex rounded-full bg-blue-200/15 px-2.5 py-1 text-[10px] font-semibold text-blue-100">
                      Welcome to Orbit Growth
                    </span>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      Your growth workspace is ready.
                    </h2>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-slate-300">
                      Choose a platform below, compare services, and follow
                      every order from one clear account.
                    </p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="View order notifications"
                      aria-expanded={notificationsOpen}
                      onClick={() => setNotificationsOpen(open => !open)}
                      className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-blue-500 text-white shadow-lg hover:bg-blue-400"
                    >
                      <Bell className="h-5 w-5" />
                      {notificationOrders.length > 0 && (
                        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                          {notificationOrders.length}
                        </span>
                      )}
                    </button>
                    {notificationsOpen && (
                      <div className="absolute right-0 top-14 z-20 w-72 rounded-2xl border border-white/10 bg-[#111a27] p-3 shadow-2xl">
                        <div className="flex items-center justify-between px-2">
                          <p className="text-xs font-semibold text-white">
                            Order updates
                          </p>
                          <button
                            type="button"
                            onClick={() => setNotificationsOpen(false)}
                            className="text-[10px] text-cyan-200 hover:text-white"
                          >
                            Close
                          </button>
                        </div>
                        {notificationOrders.length ? (
                          <div className="mt-2 space-y-1">
                            {notificationOrders.map(order => (
                              <button
                                type="button"
                                key={order.id}
                                onClick={() => {
                                  setNotificationsOpen(false);
                                  setLocation("/dashboard/orders");
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-white/[.06]"
                              >
                                <span className="text-xs text-slate-300">
                                  Order #{order.id}
                                </span>
                                <span className="text-[10px] capitalize text-cyan-200">
                                  {displayStatus(order.status)}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="px-2 py-4 text-xs text-slate-500">
                            No active order updates.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[.08] pt-4">
                  <div>
                    <p className="text-[10px] text-slate-400">Orders</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {overview.isLoading
                        ? "—"
                        : (
                            overview.data?.metrics.totalOrders ?? 0
                          ).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">Balance</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {overview.isLoading
                        ? "—"
                        : money(overview.data?.profile?.balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400">In progress</p>
                    <p className="mt-1 text-base font-semibold text-cyan-100">
                      {overview.isLoading
                        ? "—"
                        : (
                            overview.data?.metrics.pendingOrders ?? 0
                          ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </section>
            )}
            <QueryIssue
              label="Dashboard overview"
              error={overview.error}
              retry={() => void overview.refetch()}
            />
            <QueryIssue
              label="Service catalog"
              error={services.error}
              retry={() => void services.refetch()}
            />
            {isOverviewPage && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/how-to-use"
                  className="rounded-2xl border border-cyan-200/10 bg-cyan-300/[.04] p-4 transition hover:border-cyan-200/25 hover:bg-cyan-300/[.08]"
                >
                  <p className="text-sm font-semibold text-white">How to use</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Follow the platform, category, service, and order steps.
                  </p>
                </Link>
                <Link
                  href="/terms"
                  className="rounded-2xl border border-blue-200/10 bg-blue-300/[.04] p-4 transition hover:border-blue-200/25 hover:bg-blue-300/[.08]"
                >
                  <p className="text-sm font-semibold text-white">
                    Terms of service
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Review responsible and authorized service use.
                  </p>
                </Link>
                <Link
                  href="/about"
                  className="rounded-2xl border border-violet-200/10 bg-violet-300/[.04] p-4 transition hover:border-violet-200/25 hover:bg-violet-300/[.08]"
                >
                  <p className="text-sm font-semibold text-white">
                    About Orbit Growth
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Learn what the workspace is built to do.
                  </p>
                </Link>
              </div>
            )}
            {isPlaceOrderPage && (
              <div className="grid w-full min-w-0 max-w-full gap-5 overflow-x-hidden xl:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)]">
                <section
                  id="new-order"
                  className="theme-card-surface min-w-0 max-w-full scroll-mt-20 overflow-x-hidden rounded-2xl border border-blue-200/10 bg-[linear-gradient(145deg,rgba(31,75,143,.12),rgba(13,20,31,.92)_45%)] p-3 shadow-[0_16px_60px_rgba(0,0,0,.14)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200">
                        New order
                      </p>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
                        Choose a service and launch
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Review the quantity, target, and estimated charge before
                        confirming.
                      </p>
                    </div>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-200/10 bg-blue-300/[.08] text-blue-100">
                      <Plus className="h-4 w-4" />
                    </span>
                  </div>
                  <details className="group mt-6 rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-200/[.08] via-cyan-300/[.04] to-transparent shadow-[0_12px_35px_rgba(245,158,11,.06)]">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/20 bg-amber-200/[.10] text-amber-100">
                        <Info className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          Important information
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-slate-400">
                          Read this before placing an order so you can choose
                          the right service and wait time.
                        </span>
                      </span>
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-amber-100 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-amber-200/10 px-4 pb-4 sm:px-5 sm:pb-5">
                      <ul className="grid gap-3 pt-4 text-xs leading-5 text-slate-300 sm:grid-cols-2">
                        <li>
                          <strong className="text-amber-100">
                            Start time may vary:
                          </strong>{" "}
                          When the server is busy, delays can occur even if a
                          service is marked “Instant.”
                        </li>
                        <li>
                          <strong className="text-amber-100">
                            Cheap services are slow:
                          </strong>{" "}
                          We cannot speed up or cancel cheap services. Choose
                          them only if you are ready to wait longer.
                        </li>
                        <li>
                          <strong className="text-amber-100">
                            Be patient:
                          </strong>{" "}
                          Some services start immediately, while others may take
                          hours or days depending on the queue.
                        </li>
                        <li>
                          <strong className="text-amber-100">
                            Read descriptions:
                          </strong>{" "}
                          Check each service’s notes for drop rates, refill
                          terms, speed, and platform requirements.
                        </li>
                      </ul>
                    </div>
                  </details>
                  <details className="group rounded-2xl border border-cyan-200/15 bg-cyan-300/[.04] shadow-[0_12px_35px_rgba(34,211,238,.04)]">
                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-200/20 bg-cyan-300/[.10] text-cyan-100">
                        <LockKeyhole className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-white">
                          Private accounts do not receive services
                        </span>
                        <span className="mt-1 block text-[10px] leading-4 text-slate-400">
                          Make the target public before ordering and keep it
                          public until delivery is complete.
                        </span>
                      </span>
                      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-cyan-100 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-cyan-200/10 px-4 pb-4 sm:px-5 sm:pb-5">
                      <p className="pt-4 text-xs leading-5 text-slate-300">
                        A private profile, post, video, channel, group, or
                        status can block provider delivery. We cannot reliably
                        service content that the provider cannot see. Do not
                        share your password; only change the platform privacy
                        setting.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {[
                          [
                            "Instagram",
                            "Profile → ☰ → Settings and activity → Account privacy → turn off Private account.",
                          ],
                          [
                            "TikTok",
                            "Profile → ☰ → Settings and privacy → Privacy → turn off Private account.",
                          ],
                          [
                            "Facebook",
                            "Open the profile/page or post audience setting → choose Public. For a group, use a public group only when appropriate.",
                          ],
                          [
                            "YouTube",
                            "YouTube Studio → Content → choose the video → Visibility → Public. Check the channel and video visibility.",
                          ],
                          [
                            "X",
                            "Profile → Settings and privacy → Privacy and safety → turn off Protect your posts.",
                          ],
                          [
                            "WhatsApp / Telegram",
                            "Use a public channel, group, status, or invite/link that the selected service supports; private chats and restricted groups cannot be processed.",
                          ],
                        ].map(([platformName, instruction]) => (
                          <div
                            key={platformName}
                            className="rounded-xl border border-white/[.08] bg-white/[.025] p-3"
                          >
                            <p className="text-xs font-semibold text-cyan-100">
                              {platformName}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-slate-400">
                              {instruction}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-xl border border-emerald-200/15 bg-emerald-300/[.05] p-3 text-[10px] leading-4 text-emerald-50/90">
                        <strong className="text-emerald-100">
                          Before you submit:
                        </strong>{" "}
                        open the target link in an incognito/logged-out browser
                        window. If it cannot be viewed publicly, make it public
                        first, then return here and select the correct service.
                      </div>
                      <Link
                        href="/dashboard/account?tab=privacy"
                        className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-200/20 bg-cyan-300/[.08] px-3 py-2 text-[10px] font-semibold text-cyan-50 hover:bg-cyan-300/[.16]"
                      >
                        Open account privacy help{" "}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </details>
                  <div className="mt-4 flex flex-col gap-2 border-t border-amber-200/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] text-slate-400">
                      Need help choosing a service?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a
                        href="tel:+254116553618"
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/20 bg-cyan-300/[.08] px-3 py-2 text-[10px] font-semibold text-cyan-50 hover:bg-cyan-300/[.16]"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        Call 0116 553 618
                      </a>
                      <a
                        href="https://wa.me/254116553618?text=Hello%20Orbit%20Growth%20support"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200/20 bg-emerald-300/[.08] px-3 py-2 text-[10px] font-semibold text-emerald-50 hover:bg-emerald-300/[.16]"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp support
                      </a>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:mt-6 sm:gap-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        aria-label="Search platforms, categories, or services"
                        value={catalogSearch}
                        onChange={event => {
                          setCatalogSearch(event.target.value);
                          setCategory("");
                          setServiceId("");
                        }}
                        placeholder="Search platforms, categories, or services"
                        className="h-10 rounded-xl border-white/10 bg-[#0a111b] pl-9 pr-3 text-xs"
                      />
                      {catalogSearch && (
                        <button
                          type="button"
                          aria-label="Clear catalog search"
                          onClick={() => {
                            setCatalogSearch("");
                            setCategory("");
                            setServiceId("");
                          }}
                          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-slate-500 hover:bg-white/10 hover:text-white"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <Label>1. Select platform</Label>
                        <span className="text-[10px] text-slate-500">
                          {platform
                            ? `${platformServices.length} services`
                            : `${platforms.length} platforms`}
                        </span>
                      </div>
                      <div
                        ref={platformScrollRef}
                        onWheel={event => {
                          if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
                            event.currentTarget.scrollLeft += event.deltaY;
                        }}
                        className="mt-2 flex w-full min-w-0 snap-x snap-mandatory touch-pan-x flex-nowrap gap-2 overflow-x-scroll overscroll-x-contain scroll-smooth pb-2"
                        role="listbox"
                        aria-label="Choose a platform"
                        style={{ scrollbarWidth: "thin" }}
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={!platform}
                          onClick={() => {
                            setPlatform("");
                            setCategory("");
                            setServiceId("");
                          }}
                          className={`flex min-w-[76px] snap-start shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-medium transition ${!platform ? "border-cyan-200/30 bg-cyan-300/[.12] text-cyan-100" : "border-white/[.08] bg-white/[.025] text-slate-400 hover:border-white/20 hover:text-white"}`}
                        >
                          <span className="grid h-8 w-8 place-items-center rounded-xl bg-slate-600 text-[10px] font-bold text-white">
                            ALL
                          </span>
                          <span>All platforms</span>
                        </button>
                        {visiblePlatforms.map(item => (
                          <button
                            type="button"
                            role="option"
                            aria-selected={platform === item}
                            key={item}
                            onClick={() => {
                              setPlatform(item);
                              setCategory("");
                              setServiceId("");
                            }}
                            className={`flex min-w-[76px] snap-start shrink-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-[10px] font-medium transition ${platform === item ? "border-cyan-200/30 bg-cyan-300/[.12] text-cyan-100" : "border-white/[.08] bg-white/[.025] text-slate-400 hover:border-white/20 hover:text-white"}`}
                          >
                            <PlatformLogo platform={item} size="sm" />
                            <span className="max-w-[72px] truncate">
                              {item}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[10px] text-slate-500">
                          Swipe or use the arrows to see every platform
                        </p>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label="Show previous platforms"
                            onClick={() => scrollPlatforms(-1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Show more platforms"
                            onClick={() => scrollPlatforms(1)}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="order-category">
                          2. Choose category
                        </Label>
                        <div
                          ref={categoryScrollRef}
                          onWheel={event => {
                            if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
                              event.currentTarget.scrollLeft += event.deltaY;
                          }}
                          className="mt-2 flex w-full min-w-0 snap-x snap-mandatory touch-pan-x flex-nowrap gap-2 overflow-x-scroll overscroll-x-contain scroll-smooth pb-2"
                          role="listbox"
                          aria-label="Choose a category"
                          style={{ scrollbarWidth: "thin" }}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={!category}
                            onClick={() => {
                              setCategory("");
                              setServiceId("");
                            }}
                            className={`shrink-0 snap-start rounded-lg border px-3 py-2 text-[10px] font-semibold ${!category ? "border-blue-200/30 bg-blue-500 text-white" : "border-white/10 bg-white/[.03] text-slate-400 hover:text-white"}`}
                          >
                            All categories
                          </button>
                          {categoryOptions.map(item => (
                            <button
                              type="button"
                              role="option"
                              aria-selected={category === item.key}
                              key={item.key}
                              onClick={() => {
                                setCategory(item.key);
                                setServiceId("");
                              }}
                              className={`shrink-0 snap-start rounded-lg border px-3 py-2 text-[10px] font-semibold ${category === item.key ? "border-blue-200/30 bg-blue-500 text-white" : "border-white/10 bg-white/[.03] text-slate-400 hover:text-white"}`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-[10px] text-slate-500">
                            Swipe or use the arrows to see every category
                          </p>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              aria-label="Show previous categories"
                              onClick={() => scrollCategories(-1)}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Show more categories"
                              onClick={() => scrollCategories(1)}
                              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[.03] text-slate-400 hover:bg-white/[.08] hover:text-white"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <select
                          id="order-category"
                          value={category}
                          onChange={event => {
                            setCategory(event.target.value);
                            setServiceId("");
                          }}
                          disabled={!platformServices.length}
                          className="sr-only"
                        >
                          <option value="">All categories</option>
                          {categoryOptions.map(item => (
                            <option key={item.key} value={item.key}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="order-service">3. Choose service</Label>
                        <select
                          id="order-service"
                          value={serviceId}
                          onChange={event => {
                            setServiceId(event.target.value);
                            const next = categoryServices.find(
                              item => item.id === Number(event.target.value)
                            );
                            if (next) setQuantity(next.minQuantity);
                          }}
                          disabled={!categoryServices.length}
                          className="mt-2 block h-11 w-full min-w-0 max-w-full truncate rounded-xl border border-border bg-input px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          <option value="">
                            {categoryServices.length
                              ? "Select a service"
                              : "No services match these filters"}
                          </option>
                          {categoryServices.map(service => (
                            <option key={service.id} value={service.id}>
                              {serviceOptionLabel(service, !platform)}
                            </option>
                          ))}
                        </select>
                        {services.isLoading && (
                          <p
                            className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
                            role="status"
                          >
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                            Loading live services…
                          </p>
                        )}
                        {services.isError && (
                          <div
                            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[.06] px-3 py-2 text-xs"
                            role="alert"
                          >
                            <span className="text-rose-200">
                              We couldn’t load the service catalog.
                            </span>
                            <button
                              type="button"
                              className="font-semibold text-cyan-200 hover:text-white"
                              onClick={() => void services.refetch()}
                            >
                              Retry
                            </button>
                          </div>
                        )}
                        {services.data?.length === 0 && !services.isLoading && (
                          <p className="mt-2 text-xs text-amber-200/80">
                            There are no active services at the moment.
                          </p>
                        )}
                        {selected && (
                          <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-cyan-200/10 bg-cyan-300/[.04] px-3 py-2">
                            <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" />
                            <div className="min-w-0">
                              <p className="break-words text-xs font-semibold text-cyan-100">
                                {selected.name}
                              </p>
                              <p className="mt-0.5 break-words text-[10px] leading-4 text-slate-400">
                                {selected.description ||
                                  `${selected.platform} · ${selected.category}`}{" "}
                                · {selected.minQuantity.toLocaleString()}–
                                {selected.maxQuantity.toLocaleString()} units ·{" "}
                                {money(selected.retailRatePer1k)} / 1k
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="order-link">Target link</Label>
                      <div className="relative mt-2">
                        <Link2 className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                        <Input
                          id="order-link"
                          inputMode="url"
                          autoComplete="url"
                          className="h-11 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-[#0a111b] pl-10"
                          placeholder={`https://${selected?.platform.toLowerCase() ?? "instagram"}.com/your-post`}
                          value={targetLink}
                          onChange={event => setTargetLink(event.target.value)}
                        />
                        {targetLinkError && (
                          <p
                            role="alert"
                            className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-200/90"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {targetLinkError}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="order-quantity">Quantity</Label>
                        <span className="text-[10px] text-slate-500">
                          {selected
                            ? `${selected.minQuantity.toLocaleString()}–${selected.maxQuantity.toLocaleString()} available`
                            : "Select a service first"}
                        </span>
                      </div>
                      <Input
                        id="order-quantity"
                        className="mt-2 h-11 w-full min-w-0 max-w-full rounded-xl border-white/10 bg-[#0a111b]"
                        type="number"
                        min={selected?.minQuantity ?? 100}
                        max={selected?.maxQuantity ?? 100000}
                        value={quantity}
                        onChange={event =>
                          setQuantity(Number(event.target.value))
                        }
                      />
                    </div>
                    <div
                      data-order-summary
                      className="theme-card-surface flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-xl border border-cyan-200/15 bg-gradient-to-br from-cyan-300/[.08] to-blue-400/[.04] p-4 shadow-[0_12px_35px_rgba(34,211,238,.07)]"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-cyan-100/80">
                          Order summary
                        </p>
                        <p className="mt-1 text-[10px] font-medium text-slate-400">
                          Charge
                        </p>
                        <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                          {selected
                            ? `Total cost: KSh ${charge.toFixed(2)}`
                            : "Select a service to see the price"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {selected
                            ? `(${quantity.toLocaleString()} ÷ 1,000) × ${money(selected.retailRatePer1k)} per 1,000`
                            : "Choose a service to calculate"}
                        </p>
                        {selected && (
                          <p className="mt-2 text-[10px] leading-4 text-slate-400">
                            Listed rate: {money(selected.retailRatePer1k)} per
                            1,000. The final amount is based directly on your
                            quantity.
                          </p>
                        )}
                      </div>
                      <div
                        data-order-actions
                        className="w-full min-w-0 max-w-full rounded-2xl border border-blue-200/20 bg-blue-500/[.06] p-2.5 shadow-inner"
                      >
                        {submitGuidance && (
                          <p
                            id="order-submit-guidance"
                            role="status"
                            className="mb-2 rounded-lg border border-amber-300/25 bg-amber-200/[.08] px-3 py-2 text-center text-[11px] leading-4 text-amber-100"
                          >
                            {submitGuidance}
                          </p>
                        )}
                        <Button
                          aria-label={
                            createOrder.isPending
                              ? "Submitting order"
                              : selected
                                ? "Submit order"
                                : "Select a service first"
                          }
                          data-order-action="review-submit"
                          aria-describedby={
                            submitGuidance ? "order-submit-guidance" : undefined
                          }
                          size="lg"
                          className="order-submit-control relative z-20 !flex h-auto min-h-14 w-full min-w-0 max-w-full shrink-0 items-center justify-center gap-2 whitespace-normal rounded-xl !bg-blue-600 px-4 py-3 text-center text-sm font-semibold !text-white shadow-[0_10px_28px_rgba(37,99,235,.28)] hover:!bg-blue-500 disabled:!bg-slate-600 disabled:!text-white disabled:opacity-100"
                          type="button"
                          disabled={
                            createOrder.isPending ||
                            !selected ||
                            !targetLink.trim() ||
                            Boolean(targetLinkError) ||
                            quantity < (selected?.minQuantity ?? 0) ||
                            quantity > (selected?.maxQuantity ?? Infinity)
                          }
                          onClick={() => {
                            createOrder.reset();
                            setReviewOpen(true);
                          }}
                        >
                          {createOrder.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="order-action-label">
                                Submitting order…
                              </span>
                            </>
                          ) : selected ? (
                            <>
                              <span className="order-action-label !text-white uppercase tracking-wide">
                                Submit order
                              </span>
                              <ArrowUpRight className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              {services.isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShoppingBag className="h-4 w-4" />
                              )}
                              <span className="order-action-label !text-white">
                                {services.isLoading
                                  ? "Loading services…"
                                  : "Select a service to continue"}
                              </span>
                            </>
                          )}
                        </Button>
                        <Link
                          href="/dashboard/wallet"
                          data-order-action="add-funds"
                          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-300/30 bg-amber-200/[.10] px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/[.18]"
                        >
                          <WalletCards className="h-4 w-4" />
                          <span className="order-action-label">Add funds</span>
                        </Link>
                      </div>
                    </div>
                    {createOrder.error && (
                      <div
                        className="order-error-panel rounded-xl border p-3 text-xs leading-5"
                        role="alert"
                      >
                        <p className="font-semibold">
                          Order could not be placed
                        </p>
                        <p className="mt-1">
                          {friendlyErrorMessage(
                            createOrder.error,
                            "Check the service, public link, quantity, and wallet balance, then try again."
                          )}
                        </p>
                        <button
                          type="button"
                          className="mt-2 font-semibold underline underline-offset-2"
                          onClick={() => {
                            createOrder.reset();
                            setReviewOpen(true);
                          }}
                        >
                          Review and try again
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] leading-4 text-slate-500">
                      Final validation is performed when you place the order.
                      Only use target links you own or are authorized to manage.
                    </p>
                  </div>
                </section>
                <section className="min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h2 className="text-sm font-semibold text-foreground">
                      Quick guide
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      How to place an order
                    </span>
                  </div>
                  <ol className="mt-4 grid gap-3 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">1.</span>
                      Select your preferred platform, category, and service.
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">2.</span>
                      Paste the public target link you want to boost.
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">3.</span>
                      Enter a quantity within the service limits.
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-primary">4.</span>
                      Tap Submit order and confirm the review details.
                    </li>
                  </ol>
                </section>
                {isOverviewPage && (
                  <TopUpCard
                    phone={phone}
                    setPhone={setPhone}
                    amount={depositAmount}
                    setAmount={setDepositAmount}
                    pending={requestDeposit.isPending}
                    checking={checkDeposit.isPending}
                    reference={depositReference}
                    paymentStatus={depositStatus}
                    gatewayResponse={depositResponse}
                    lastChecked={depositLastChecked}
                    onSubmit={() =>
                      requestDeposit.mutate({ amount: depositAmount, phone })
                    }
                    onCheck={() => checkDepositNow(false)}
                    compact
                  />
                )}
                <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                  <DialogContent className="border-white/10 bg-card text-card-foreground sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Review your order</DialogTitle>
                      <DialogDescription>
                        Check the details below. Your wallet is charged only
                        when you place the order.
                      </DialogDescription>
                    </DialogHeader>
                    {createOrder.error && (
                      <div
                        role="alert"
                        className="order-error-panel rounded-xl border p-3 text-xs leading-5"
                      >
                        <p className="font-semibold">
                          Order could not be placed
                        </p>
                        <p className="mt-1">
                          {friendlyErrorMessage(
                            createOrder.error,
                            "Check the service, public link, quantity, and wallet balance, then try again."
                          )}
                        </p>
                        <p className="mt-2 text-[10px] opacity-80">
                          Your wallet was not charged unless the order was
                          successfully accepted.
                        </p>
                      </div>
                    )}
                    {selected && (
                      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">Service</span>
                          <span className="max-w-[65%] text-right font-medium">
                            {selected.name}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">
                            Quantity
                          </span>
                          <span className="font-medium tabular-nums">
                            {quantity.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-muted-foreground">
                            Target link
                          </span>
                          <span className="max-w-[65%] break-all text-right text-xs">
                            {targetLink.trim()}
                          </span>
                        </div>
                        <div className="border-t border-border pt-3">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-semibold">Wallet charge</span>
                            <span className="text-lg font-semibold tabular-nums">
                              {money(charge)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            ({quantity.toLocaleString()} ÷ 1,000) ×{" "}
                            {money(selected.retailRatePer1k)} per 1,000
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Current wallet balance
                          </span>
                          <span className="font-medium">
                            {money(overview.data?.profile?.balance)}
                          </span>
                        </div>
                      </div>
                    )}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setReviewOpen(false)}
                      >
                        Go back
                      </Button>
                      <Button
                        type="button"
                        disabled={createOrder.isPending || !selected}
                        onClick={() => {
                          if (!selected) return;
                          createOrder.mutate({
                            serviceId: selected.id,
                            targetLink: targetLink.trim(),
                            quantity,
                          });
                        }}
                      >
                        {createOrder.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Placing
                            order…
                          </>
                        ) : (
                          "Place order"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </>
        )}

        {isOrdersPage && (
          <>
            <QueryIssue
              label="Order history"
              error={orders.error}
              retry={() => void orders.refetch()}
            />
            <OrderTable
              orders={filteredOrders}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              recent={false}
              onRefresh={id => refreshOrderStatus.mutate({ orderId: id })}
              onReload={() => void orders.refetch()}
              syncing={orders.isFetching}
              onCancel={id => cancelOrder.mutate({ orderId: id })}
              busyOrderId={
                refreshOrderStatus.isPending || cancelOrder.isPending
                  ? Number(
                      refreshOrderStatus.variables?.orderId ??
                        cancelOrder.variables?.orderId
                    )
                  : undefined
              }
            />
          </>
        )}
        {isWalletPage && (
          <>
            <QueryIssue
              label="Wallet balance"
              error={overview.error}
              retry={() => void overview.refetch()}
            />
            <div className="grid gap-4 lg:grid-cols-[.65fr_1.35fr]">
              <section className="rounded-2xl border border-emerald-200/10 bg-[linear-gradient(145deg,rgba(16,100,75,.15),rgba(13,20,31,.9)_55%)] p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-200">
                      Available balance
                    </p>
                    <p className="mt-4 text-3xl font-semibold tracking-tight text-white">
                      {overview.isLoading || overview.isError
                        ? "—"
                        : money(overview.data?.profile?.balance)}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">
                      Your current account credit
                    </p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/10 text-emerald-200">
                    <WalletCards className="h-5 w-5" />
                  </span>
                </div>
              </section>
              <TopUpCard
                phone={phone}
                setPhone={setPhone}
                amount={depositAmount}
                setAmount={setDepositAmount}
                pending={requestDeposit.isPending}
                checking={checkDeposit.isPending}
                reference={depositReference}
                paymentStatus={depositStatus}
                gatewayResponse={depositResponse}
                lastChecked={depositLastChecked}
                onSubmit={() =>
                  requestDeposit.mutate({ amount: depositAmount, phone })
                }
                onCheck={() => checkDepositNow(false)}
              />
            </div>
            <QueryIssue
              label="Wallet activity"
              error={wallet.error}
              retry={() => void wallet.refetch()}
            />
            <WalletTable
              wallet={wallet.data ?? []}
              balance={overview.data?.profile?.balance}
              loading={wallet.isLoading}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function TopUpCard({
  phone,
  setPhone,
  amount,
  setAmount,
  pending,
  checking,
  reference,
  paymentStatus,
  gatewayResponse,
  lastChecked,
  onSubmit,
  onCheck,
  compact = false,
}: {
  phone: string;
  setPhone: (value: string) => void;
  amount: number;
  setAmount: (value: number) => void;
  pending: boolean;
  checking: boolean;
  reference: string;
  paymentStatus: "pending" | "success" | "failed" | "";
  gatewayResponse: Record<string, string | undefined>;
  lastChecked: Date | null;
  onSubmit: () => void;
  onCheck: () => void;
  compact?: boolean;
}) {
  return (
    <section className="min-w-0 w-full rounded-2xl border border-white/[.08] bg-[#0c131e] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-200">
            Add funds
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">
            Top up with M-Pesa
          </h2>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-200/10 bg-emerald-300/[.07] text-emerald-100">
          <WalletCards className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-400">
        Enter your Kenyan number and amount. LeeTec will send an M-Pesa prompt;
        complete it on your phone, then confirm the payment here.
      </p>
      <div
        className={`mt-5 grid min-w-0 gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-[1fr_180px_auto] sm:items-end"}`}
      >
        <div>
          <Label
            htmlFor={compact ? "topup-phone-overview" : "topup-phone-wallet"}
          >
            Phone number
          </Label>
          <Input
            id={compact ? "topup-phone-overview" : "topup-phone-wallet"}
            className="mt-2 h-10 rounded-lg border-white/10 bg-[#0a111b]"
            type="tel"
            autoComplete="tel"
            placeholder="254 7xx xxx xxx"
            value={phone}
            onChange={event => setPhone(event.target.value)}
          />
        </div>
        <div>
          <Label
            htmlFor={compact ? "topup-amount-overview" : "topup-amount-wallet"}
          >
            Amount (KES)
          </Label>
          <Input
            id={compact ? "topup-amount-overview" : "topup-amount-wallet"}
            className="mt-2 h-10 rounded-lg border-white/10 bg-[#0a111b]"
            type="number"
            min={MIN_DEPOSIT_KES}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </div>
        <Button
          variant={compact ? "outline" : "default"}
          className={`h-10 w-full max-w-full rounded-lg text-white disabled:text-white ${compact ? "sm:col-span-2" : ""}`}
          disabled={pending || !phone.trim() || amount < MIN_DEPOSIT_KES}
          onClick={onSubmit}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <ArrowRight className="h-4 w-4" />
              Send M-Pesa prompt
            </>
          )}
        </Button>
      </div>
      {reference && (
        <div
          className={`mt-4 rounded-xl border p-3 ${paymentStatus === "success" ? "border-emerald-200/20 bg-emerald-300/[.06]" : paymentStatus === "failed" ? "border-rose-200/20 bg-rose-300/[.05]" : "border-cyan-200/15 bg-cyan-300/[.04]"}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-white">
                Payment{" "}
                {paymentStatus === "success"
                  ? "confirmed"
                  : paymentStatus === "failed"
                    ? "failed"
                    : "awaiting confirmation"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Reference: {reference}
                {lastChecked
                  ? ` · Updated ${lastChecked.toLocaleTimeString()}`
                  : ""}
              </p>
            </div>
            {paymentStatus === "pending" && (
              <Button
                variant="outline"
                className="h-8 rounded-lg text-[10px]"
                disabled={checking}
                onClick={onCheck}
              >
                {checking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Check now
              </Button>
            )}
          </div>
          <div className="mt-3 grid gap-2 border-t border-white/[.08] pt-3 text-[10px] sm:grid-cols-2">
            <span className="text-slate-500">
              LeeTec status
              <b className="ml-1 text-slate-200">
                {(gatewayResponse.status ?? paymentStatus) || "PENDING"}
              </b>
            </span>
            {gatewayResponse.message && (
              <span className="text-slate-500">
                Response
                <b className="ml-1 text-slate-200">{gatewayResponse.message}</b>
              </span>
            )}
            {gatewayResponse.checkoutRequestId && (
              <span className="text-slate-500">
                Checkout ID
                <b className="ml-1 break-all text-slate-200">
                  {gatewayResponse.checkoutRequestId}
                </b>
              </span>
            )}
            {gatewayResponse.merchantRequestId && (
              <span className="text-slate-500">
                Merchant ID
                <b className="ml-1 break-all text-slate-200">
                  {gatewayResponse.merchantRequestId}
                </b>
              </span>
            )}
            {gatewayResponse.transactionId && (
              <span className="text-slate-500">
                Transaction ID
                <b className="ml-1 break-all text-slate-200">
                  {gatewayResponse.transactionId}
                </b>
              </span>
            )}
            {gatewayResponse.receipt && (
              <span className="text-slate-500">
                M-Pesa receipt
                <b className="ml-1 text-slate-200">{gatewayResponse.receipt}</b>
              </span>
            )}
          </div>
        </div>
      )}
      <p className="mt-3 text-[10px] text-slate-500">
        Minimum KES 10. Status refreshes automatically every 5 seconds while
        pending. Your wallet is credited only after LeeTec confirms success.
      </p>
    </section>
  );
}

function OrderTable({
  orders,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  recent,
  onViewAll,
  onRefresh,
  onReload,
  syncing = false,
  onCancel,
  busyOrderId,
}: {
  orders: Order[];
  search: string;
  setSearch: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  recent: boolean;
  onViewAll?: () => void;
  onRefresh?: (id: number) => void;
  onReload?: () => void;
  syncing?: boolean;
  onCancel?: (id: number) => void;
  busyOrderId?: number;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const visibleOrders = orders.slice(0, recent ? 5 : 100);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c131e]">
      <div className="flex flex-col justify-between gap-4 border-b border-white/[.07] p-5 sm:flex-row sm:items-center sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-500">
            {recent ? "Recent activity" : "Your history"}
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            {recent ? "Latest orders" : "Track your orders"}
          </h2>
          <p className="mt-1 text-[10px] text-slate-500">
            Provider status refreshes automatically every 30 seconds.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
          {onReload && (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full shrink-0 rounded-lg text-xs sm:w-auto"
              onClick={onReload}
              disabled={syncing}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Updating…" : "Refresh list"}
            </Button>
          )}
          <div className="relative min-w-0 flex-1 sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
            <Input
              aria-label="Search orders"
              className="h-10 w-full rounded-lg border-white/10 bg-[#0a111b] pl-9 text-xs"
              placeholder="Search order or link"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>
      <div
        className="flex gap-2 overflow-x-auto border-b border-white/[.07] px-3 py-3 sm:px-6"
        role="tablist"
        aria-label="Filter orders by status"
      >
        {orderStatusTabs.map(({ value, label, Icon }) => {
          const active = statusFilter === value;
          const count =
            value === "all"
              ? orders.length
              : orders.filter(order => order.status === value).length;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusFilter(value)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-semibold capitalize transition ${active ? "border-cyan-200/25 bg-cyan-300/[.12] text-cyan-100 shadow-[0_6px_18px_rgba(34,211,238,.1)]" : "border-white/[.07] bg-white/[.02] text-slate-500 hover:border-white/15 hover:bg-white/[.05] hover:text-slate-200"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
              <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="border-b border-white/[.07] bg-white/[.015] text-[9px] uppercase tracking-[.14em] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold sm:px-6">Order</th>
              <th className="px-3 py-3 font-semibold">Service</th>
              <th className="px-3 py-3 font-semibold">Delivery progress</th>
              <th className="px-3 py-3 font-semibold">Charge</th>
              <th className="px-3 py-3 font-semibold">Status</th>
              <th className="px-5 py-3 font-semibold sm:px-6">Updated</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrders.map(order => {
              const progress = orderProgress(order);
              const delivered = Math.max(
                0,
                order.quantity - (order.remains ?? order.quantity)
              );
              const canCheck = Boolean(
                onRefresh &&
                  order.providerOrderId &&
                  !terminalOrderStatuses.includes(order.status)
              );
              const canCancel = ["pending", "in_progress", "partial"].includes(
                order.status
              );
              return (
                <Fragment key={order.id}>
                  <tr className="border-b border-white/[.05] last:border-0 hover:bg-white/[.018]">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-white sm:px-6">
                      #{String(order.id).padStart(5, "0")}{" "}
                      <a
                        aria-label={`Open target link for order ${order.id}`}
                        href={order.targetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-1 inline-flex align-middle text-slate-500 hover:text-cyan-200"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                    <td className="max-w-[230px] truncate px-3 py-4 text-slate-400">
                      {order.serviceName ?? `Service #${order.serviceId}`}
                      <span className="mt-1 block text-[9px] text-slate-500">
                        {order.servicePlatform} · {order.serviceCategory}
                      </span>
                    </td>
                    <td className="min-w-[180px] px-3 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-300" : "bg-cyan-300"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[10px] tabular-nums text-slate-300">
                          {Math.round(progress)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[9px] text-slate-500">
                        {order.remains != null
                          ? `${delivered.toLocaleString()} delivered · ${order.remains.toLocaleString()} remaining`
                          : deliveryMessage(order)}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 tabular-nums text-slate-300">
                      {money(order.charge)}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500 sm:px-6">
                      <button
                        type="button"
                        className="underline decoration-white/10 underline-offset-4 hover:text-white"
                        onClick={() =>
                          setExpanded(expanded === order.id ? null : order.id)
                        }
                      >
                        {order.updatedAt
                          ? new Date(order.updatedAt).toLocaleDateString()
                          : new Date(order.createdAt).toLocaleDateString()}
                      </button>
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr className="border-b border-white/[.05] bg-white/[.02]">
                      <td colSpan={6} className="px-5 py-4 sm:px-6">
                        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-white">
                                Order #{String(order.id).padStart(5, "0")}{" "}
                                details
                              </p>
                              <StatusBadge status={order.status} />
                            </div>
                            <p className="mt-2 break-all text-xs text-slate-400">
                              Target: {order.targetLink}
                            </p>
                            <div className="mt-4 grid gap-3 text-xs text-slate-400 sm:grid-cols-5">
                              <span>
                                Quantity{" "}
                                <b className="block text-white">
                                  {order.quantity.toLocaleString()}
                                </b>
                              </span>
                              <span>
                                Delivered{" "}
                                <b className="block text-white">
                                  {delivered.toLocaleString()}
                                </b>
                              </span>
                              <span>
                                Remaining{" "}
                                <b className="block text-white">
                                  {order.remains?.toLocaleString() ?? "—"}
                                </b>
                              </span>
                              <span>
                                Start count{" "}
                                <b className="block text-white">
                                  {order.startCount?.toLocaleString() ?? "—"}
                                </b>
                              </span>
                              <span>
                                Provider order{" "}
                                <b className="block break-all text-white">
                                  {order.providerOrderId ?? "Awaiting provider"}
                                </b>
                              </span>
                            </div>
                            <p className="mt-3 inline-flex items-center gap-2 text-xs text-cyan-100">
                              <Clock3 className="h-3.5 w-3.5" />
                              {deliveryMessage(order)}
                            </p>
                            {order.errorMessage && (
                              <p className="mt-3 flex items-center gap-2 text-xs text-rose-200">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {order.errorMessage}
                              </p>
                            )}
                            <p className="mt-3 text-[10px] text-slate-500">
                              Last checked{" "}
                              {order.updatedAt
                                ? new Date(order.updatedAt).toLocaleString()
                                : "Not checked yet"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                            <a
                              href={supportWhatsAppLink(order.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200/20 bg-emerald-300/[.06] px-3 text-[10px] font-medium text-emerald-100 hover:bg-emerald-300/[.12]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp support
                            </a>
                            {canCheck && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyOrderId === order.id}
                                onClick={() => onRefresh?.(order.id)}
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${busyOrderId === order.id ? "animate-spin" : ""}`}
                                />
                                {busyOrderId === order.id
                                  ? "Checking…"
                                  : "Check delivery"}
                              </Button>
                            )}
                            {onCancel && canCancel && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyOrderId === order.id}
                                className="border-rose-200/15 text-rose-200 hover:bg-rose-300/10"
                                onClick={() => onCancel(order.id)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Cancel order
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visibleOrders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <ShoppingBag className="mx-auto h-5 w-5 text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    {search || statusFilter !== "all"
                      ? "No orders match these filters."
                      : "No orders yet."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {search || statusFilter !== "all"
                      ? "Try a different search or status."
                      : "When you place an order, delivery progress will appear here."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {visibleOrders.map(order => {
          const progress = orderProgress(order);
          const delivered = Math.max(
            0,
            order.quantity - (order.remains ?? order.quantity)
          );
          const canCheck = Boolean(
            onRefresh &&
              order.providerOrderId &&
              !terminalOrderStatuses.includes(order.status)
          );
          const canCancel = ["pending", "in_progress", "partial"].includes(
            order.status
          );
          const busy = busyOrderId === order.id;
          return (
            <article
              key={`mobile-${order.id}`}
              className="min-w-0 rounded-2xl border border-white/[.08] bg-[#0a111b] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">
                    Order #{order.id}
                  </p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                    {order.serviceName ?? `Service #${order.serviceId}`}
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {order.servicePlatform} · {order.serviceCategory}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <button
                type="button"
                onClick={() =>
                  setExpanded(expanded === order.id ? null : order.id)
                }
                aria-expanded={expanded === order.id}
                className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-cyan-200/15 bg-cyan-300/[.06] px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/[.12]"
              >
                {expanded === order.id
                  ? "Hide order details"
                  : "Open order details"}
              </button>
              <a
                href={order.targetLink}
                target="_blank"
                rel="noreferrer"
                className={`mt-3 block min-w-0 truncate rounded-lg bg-white/[.035] px-3 py-2 text-[10px] text-cyan-200 hover:text-white ${expanded === order.id ? "" : "hidden"}`}
              >
                {order.targetLink}
              </a>
              <div
                className={`mt-4 rounded-xl border border-cyan-200/10 bg-cyan-300/[.04] p-3 ${expanded === order.id ? "" : "hidden"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-cyan-100">
                    Delivery progress
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${progress === 100 ? "bg-emerald-300" : "bg-cyan-300"}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-400">
                  <span>{delivered.toLocaleString()} delivered</span>
                  <span>
                    {order.remains != null
                      ? `${order.remains.toLocaleString()} remaining`
                      : "Awaiting provider"}
                  </span>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-cyan-100">
                  <Clock3 className="mt-0.5 h-3 w-3 shrink-0" />
                  {deliveryMessage(order)}
                </p>
              </div>
              <div
                className={`mt-4 grid grid-cols-2 gap-3 text-xs ${expanded === order.id ? "" : "hidden"}`}
              >
                <span className="text-slate-500">
                  Charge
                  <b className="mt-1 block text-sm text-white">
                    {money(order.charge)}
                  </b>
                </span>
                <span className="text-slate-500">
                  Quantity
                  <b className="mt-1 block text-sm text-white">
                    {order.quantity.toLocaleString()}
                  </b>
                </span>
                <span className="text-slate-500">
                  Start count
                  <b className="mt-1 block text-sm text-white">
                    {order.startCount?.toLocaleString() ?? "—"}
                  </b>
                </span>
                <span className="text-slate-500">
                  Last checked
                  <b className="mt-1 block text-sm text-white">
                    {order.updatedAt
                      ? new Date(order.updatedAt).toLocaleTimeString()
                      : "Not yet"}
                  </b>
                </span>
              </div>
              <div
                className={`mt-4 grid gap-2 sm:grid-cols-2 ${expanded === order.id ? "" : "hidden"}`}
              >
                {canCheck ? (
                  <button
                    type="button"
                    onClick={() => onRefresh?.(order.id)}
                    disabled={busy}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/[.10] px-3 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-300/[.18] disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`}
                    />
                    {busy ? "Checking delivery…" : "Check delivery status"}
                  </button>
                ) : (
                  <span className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-400">
                    {order.providerOrderId
                      ? "No check needed"
                      : "Awaiting provider"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setExpanded(expanded === order.id ? null : order.id)
                  }
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[.06]"
                >
                  {expanded === order.id
                    ? "Hide details"
                    : "View order details"}
                </button>
              </div>
              {expanded === order.id && (
                <div className="mt-3 rounded-xl border border-white/[.08] bg-white/[.02] p-3 text-xs">
                  <p className="break-all text-slate-400">
                    Target:{" "}
                    <span className="text-slate-200">{order.targetLink}</span>
                  </p>
                  <p className="mt-2 text-slate-400">
                    Provider order:{" "}
                    <span className="break-all text-slate-200">
                      {order.providerOrderId ?? "Awaiting provider"}
                    </span>
                  </p>
                  {order.errorMessage && (
                    <p className="mt-2 flex items-start gap-2 text-rose-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {order.errorMessage}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] text-slate-500">
                    Last checked{" "}
                    {order.updatedAt
                      ? new Date(order.updatedAt).toLocaleString()
                      : "Not checked yet"}
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {onCancel && canCancel && (
                  <button
                    type="button"
                    onClick={() => onCancel(order.id)}
                    disabled={busy}
                    className="min-h-9 flex-1 rounded-lg border border-rose-200/15 px-3 py-2 text-[10px] font-medium text-rose-200 disabled:opacity-40"
                  >
                    Cancel order
                  </button>
                )}
                <a
                  href={supportWhatsAppLink(order.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-200/20 bg-emerald-300/[.06] px-3 py-2 text-[10px] font-medium text-emerald-100"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp support
                </a>
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/dashboard/new-order";
                  }}
                  className="inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border border-cyan-200/15 px-3 py-2 text-[10px] font-medium text-cyan-100"
                >
                  Place new order
                </button>
              </div>
            </article>
          );
        })}
        {visibleOrders.length === 0 && (
          <div className="px-3 py-10 text-center text-xs text-slate-500">
            {search || statusFilter !== "all"
              ? "No orders match these filters."
              : "No orders yet."}
          </div>
        )}
      </div>
      {recent && (
        <div className="flex flex-col gap-2 border-t border-white/[.06] px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-[10px] text-slate-500">
            {orders.length} total recorded
          </p>
          <button
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-cyan-200 hover:text-white"
          >
            View all orders <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const done = status === "completed";
  const failed = ["failed", "canceled"].includes(status);
  const Icon = done ? CheckCircle2 : Clock3;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] capitalize ${done ? "border-emerald-300/10 bg-emerald-300/[.06] text-emerald-200" : failed ? "border-rose-300/10 bg-rose-300/[.06] text-rose-200" : "border-blue-300/10 bg-blue-300/[.06] text-blue-100"}`}
    >
      <Icon className="h-3 w-3" />
      {displayStatus(status)}
    </span>
  );
}

function WalletTable({
  wallet,
  balance,
  loading,
}: {
  wallet: WalletEntry[];
  balance?: string | null;
  loading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c131e]">
      <div className="flex items-center justify-between gap-4 border-b border-white/[.07] p-5 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-200">
            Wallet ledger
          </p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            Recent activity
          </h2>
        </div>
        <span className="text-right">
          <span className="block text-[9px] text-slate-500">
            Current balance
          </span>
          <span className="mt-1 block text-sm font-semibold tabular-nums text-white">
            {money(balance)}
          </span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="border-b border-white/[.07] bg-white/[.015] text-[9px] uppercase tracking-[.14em] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold sm:px-6">Reference</th>
              <th className="px-3 py-3 font-semibold">Type</th>
              <th className="px-3 py-3 font-semibold">Amount</th>
              <th className="px-3 py-3 font-semibold">Balance after</th>
              <th className="px-5 py-3 font-semibold sm:px-6">Status</th>
            </tr>
          </thead>
          <tbody>
            {wallet.map(tx => (
              <tr
                key={tx.id}
                className="border-b border-white/[.05] last:border-0"
              >
                <td className="max-w-[200px] truncate px-5 py-4 text-slate-300 sm:px-6">
                  {tx.reference}
                </td>
                <td className="whitespace-nowrap px-3 py-4 capitalize text-slate-400">
                  {tx.type.replaceAll("_", " ")}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-4 font-medium tabular-nums ${Number(tx.amount) >= 0 ? "text-emerald-200" : "text-white"}`}
                >
                  {Number(tx.amount) >= 0 ? "+" : ""}
                  {money(tx.amount)}
                </td>
                <td className="whitespace-nowrap px-3 py-4 tabular-nums text-slate-300">
                  {money(tx.balanceAfter)}
                </td>
                <td className="px-5 py-4 capitalize text-slate-400 sm:px-6">
                  {tx.status}
                </td>
              </tr>
            ))}
            {wallet.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <WalletCards className="mx-auto h-5 w-5 text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-300">
                    {loading
                      ? "Loading wallet activity…"
                      : "Your ledger is ready."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {loading ? "" : "Top-ups and order charges will show here."}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QueryIssue({
  label,
  error,
  retry,
}: {
  label: string;
  error: unknown;
  retry: () => void;
}) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[.035] px-4 py-3 sm:flex-row sm:items-center"
    >
      <div>
        <p className="text-xs font-medium text-rose-100">
          {label} couldn't be loaded
        </p>
        <p className="mt-1 text-[10px] text-slate-400">
          {friendlyErrorMessage(error, "Check your connection and try again.")}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-8 shrink-0 border-rose-200/15 text-[10px]"
        onClick={retry}
      >
        Retry
      </Button>
    </div>
  );
}
