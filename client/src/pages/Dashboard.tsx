import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard, ExternalLink, Link2, Loader2, Plus, Search, ShoppingBag, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const money = (value: unknown) => `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const displayStatus = (status: string) => status.replaceAll("_", " ");

export default function Dashboard() {
  const [location] = useLocation();
  const overview = trpc.dashboard.overview.useQuery(undefined, { retry: false });
  const services = trpc.dashboard.services.useQuery();
  const orders = trpc.dashboard.orders.useQuery(undefined, { refetchInterval: 30000 });
  const wallet = trpc.dashboard.wallet.useQuery();
  const [serviceId, setServiceId] = useState("");
  const [targetLink, setTargetLink] = useState("");
  const [quantity, setQuantity] = useState(1000);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [depositAmount, setDepositAmount] = useState(1000);
  const [phone, setPhone] = useState("");

  const selected = services.data?.find((service) => service.id === Number(serviceId));
  const charge = selected ? Number((Number(selected.retailRatePer1k) * quantity / 1000).toFixed(2)) : 0;
  const filteredOrders = useMemo(() => (orders.data ?? []).filter((order) => `${order.id} ${order.targetLink}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === "all" || order.status === statusFilter)), [orders.data, search, statusFilter]);
  const isOrdersPage = location === "/dashboard/orders";
  const isWalletPage = location === "/dashboard/wallet";

  const createOrder = trpc.dashboard.createOrder.useMutation({
    onSuccess: () => {
      toast.success("Order placed", { description: "Your wallet was charged and the order is now pending fulfillment." });
      void overview.refetch(); void orders.refetch(); void wallet.refetch(); setTargetLink("");
    },
    onError: (error) => toast.error(error.message),
  });
  const requestDeposit = trpc.dashboard.requestDeposit.useMutation({
    onSuccess: () => { toast.success("Deposit request received", { description: "An administrator will verify the payment before crediting your wallet." }); void wallet.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl space-y-7 p-2 sm:p-4">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-blue-400">{isOrdersPage ? "Order history" : isWalletPage ? "Wallet activity" : "Workspace overview"}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em] text-white">{isOrdersPage ? "Orders, without the guesswork." : isWalletPage ? "A clear ledger for every move." : "Keep your growth in motion."}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{isOrdersPage ? "Search, filter, and follow the current status of every delivery." : isWalletPage ? "Review credits, charges, and pending deposits in one place." : "Your latest activity and next best action, in one calm view."}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Provider network operational</div>
        </header>

        {!isOrdersPage && !isWalletPage && <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Wallet balance" value={money(overview.data?.profile?.balance)} note="Available to launch" icon={<CreditCard className="h-4 w-4" />} />
            <Metric label="Total orders" value={overview.data?.metrics.totalOrders ?? 0} note="All-time activity" icon={<ShoppingBag className="h-4 w-4" />} />
            <Metric label="Pending orders" value={overview.data?.metrics.pendingOrders ?? 0} note="Currently moving" icon={<Clock3 className="h-4 w-4" />} />
            <Metric label="Total spent" value={money(overview.data?.metrics.totalSpent)} note="Across your orders" icon={<WalletCards className="h-4 w-4" />} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
            <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5 sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-300">New order</p><h2 className="mt-2 text-xl font-semibold text-white">Launch a focused package</h2></div><span className="rounded-lg bg-blue-500/10 p-2 text-blue-300"><Plus className="h-4 w-4" /></span></div>
              <div className="mt-6 grid gap-4">
                <div><Label>Service</Label><select aria-label="Service" value={serviceId} onChange={(event) => { setServiceId(event.target.value); const next = services.data?.find((item) => item.id === Number(event.target.value)); if (next) setQuantity(next.minQuantity); }} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Choose a service</option>{services.data?.map((service) => <option key={service.id} value={service.id}>{service.platform} · {service.name} · {money(service.retailRatePer1k)} / 1k</option>)}</select></div>
                <div><Label>Target URL</Label><div className="relative mt-2"><Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="https://instagram.com/your-post" value={targetLink} onChange={(event) => setTargetLink(event.target.value)} /></div></div>
                <div><div className="flex items-center justify-between"><Label>Quantity</Label><span className="text-xs text-muted-foreground">{selected ? `${selected.minQuantity.toLocaleString()} – ${selected.maxQuantity.toLocaleString()}` : "Select a service first"}</span></div><Input className="mt-2" type="number" min={selected?.minQuantity ?? 100} max={selected?.maxQuantity ?? 100000} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>
                <div className="flex items-center justify-between rounded-xl border border-blue-500/20 bg-blue-500/8 p-4"><div><p className="text-xs text-muted-foreground">Estimated charge</p><p className="mt-1 text-xl font-semibold text-white">{money(charge)}</p></div><Button disabled={createOrder.isPending || !selected || !targetLink} onClick={() => createOrder.mutate({ serviceId: Number(serviceId), targetLink, quantity })}>{createOrder.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Place order <ArrowUpRight className="ml-1 h-4 w-4" /></Button></div>
              </div>
            </section>
            <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5 sm:p-6">
              <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">Add funds</p><h2 className="mt-2 text-xl font-semibold text-white">Top up your wallet</h2></div><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300"><WalletCards className="h-4 w-4" /></span></div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">Request an M-Pesa STK push and your balance will update after verification.</p>
              <div className="mt-6 grid gap-4"><div><Label>Phone number</Label><Input className="mt-2" placeholder="254 7xx xxx xxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><Label>Amount (KES)</Label><Input className="mt-2" type="number" min={50} value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} /></div><Button variant="outline" disabled={requestDeposit.isPending || !phone || depositAmount <= 0} onClick={() => requestDeposit.mutate({ amount: depositAmount, phone })}>{requestDeposit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Request secure top-up</Button></div>
              <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Verification-first wallet controls</div>
            </section>
          </div>
        </>}

        {(isOrdersPage || (!isWalletPage && !isOrdersPage)) && <OrderTable orders={filteredOrders} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} recent={!isOrdersPage} />}
        {isWalletPage && <WalletTable wallet={wallet.data ?? []} balance={overview.data?.profile?.balance} />}
      </div>
    </DashboardLayout>
  );
}

function Metric({ label, value, note, icon }: { label: string; value: string | number; note: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-500/10 text-blue-300">{icon}</span></div><p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function OrderTable({ orders, search, setSearch, statusFilter, setStatusFilter, recent }: { orders: Array<{ id: number; serviceId: number; targetLink: string; quantity: number; charge: string; status: string; createdAt: Date }>; search: string; setSearch: (value: string) => void; statusFilter: string; setStatusFilter: (value: string) => void; recent: boolean }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">{recent ? "Recent orders" : "All orders"}</p><h2 className="mt-2 text-xl font-semibold text-white">Delivery activity</h2></div><div className="flex w-full gap-2 sm:w-auto"><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="all">All status</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="canceled">Canceled</option><option value="partial">Partial</option></select><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search order or link" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-white/8 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Order</th><th className="pb-3 font-medium">Service</th><th className="pb-3 font-medium">Quantity</th><th className="pb-3 font-medium">Charge</th><th className="pb-3 font-medium">Status</th><th className="pb-3 font-medium">Created</th></tr></thead><tbody>{orders.slice(0, recent ? 5 : 100).map((order) => <tr key={order.id} className="border-b border-white/6 last:border-0"><td className="py-4 font-medium text-white">#{String(order.id).padStart(5, "0")} <a href={order.targetLink} target="_blank" rel="noreferrer" className="inline-block text-muted-foreground hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" /></a></td><td className="py-4 text-muted-foreground">Service #{order.serviceId}</td><td className="py-4 text-slate-300">{order.quantity.toLocaleString()}</td><td className="py-4 text-slate-300">{money(order.charge)}</td><td className="py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs capitalize ${order.status === "completed" ? "bg-emerald-500/10 text-emerald-300" : order.status === "failed" || order.status === "canceled" ? "bg-red-500/10 text-red-300" : "bg-blue-500/10 text-blue-300"}`}>{order.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{displayStatus(order.status)}</span></td><td className="py-4 text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}{orders.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-sm text-muted-foreground">No orders match this view yet.</td></tr>}</tbody></table></div></section>;
}

function WalletTable({ wallet, balance }: { wallet: Array<{ id: number; reference: string; type: string; amount: string; balanceAfter: string; status: string }>; balance?: string | null }) {
  return <section className="rounded-2xl border border-white/8 bg-white/[.025] p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-emerald-300">Ledger</p><h2 className="mt-2 text-xl font-semibold text-white">Wallet history</h2></div><p className="text-2xl font-semibold text-white">{money(balance)}</p></div><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-white/8 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="pb-3 font-medium">Reference</th><th className="pb-3 font-medium">Type</th><th className="pb-3 font-medium">Amount</th><th className="pb-3 font-medium">Balance after</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{wallet.map((tx) => <tr key={tx.id} className="border-b border-white/6 last:border-0"><td className="py-4 text-slate-300">{tx.reference}</td><td className="py-4 capitalize text-muted-foreground">{tx.type.replace("_", " ")}</td><td className={`py-4 font-medium ${Number(tx.amount) >= 0 ? "text-emerald-300" : "text-white"}`}>{Number(tx.amount) >= 0 ? "+" : ""}{money(tx.amount)}</td><td className="py-4 text-slate-300">{money(tx.balanceAfter)}</td><td className="py-4 capitalize text-muted-foreground">{tx.status}</td></tr>)}{wallet.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">Your ledger will appear here after your first wallet activity.</td></tr>}</tbody></table></div></section>;
}
