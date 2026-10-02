import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyErrorMessage } from "@shared/errorMessages";
import { trpc } from "@/lib/trpc";
import { preloadRoute } from "@/lib/routePreload";
import {
  ArrowUpRight,
  Instagram,
  Layers3,
  Play,
  Search,
  Youtube,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const platformOrder = ["Instagram", "TikTok", "YouTube", "Facebook"];
const money = (value: unknown) =>
  `KES ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const iconFor = (platform: string) =>
  platform.toLowerCase().includes("instagram")
    ? Instagram
    : platform.toLowerCase().includes("tiktok")
      ? Play
      : platform.toLowerCase().includes("youtube")
        ? Youtube
        : Layers3;

export default function Services() {
  const [, setLocation] = useLocation();
  const servicesQuery = trpc.dashboard.services.useQuery();
  const data = servicesQuery.data ?? [];
  const [platform, setPlatform] = useState("All platforms");
  const [category, setCategory] = useState("All categories");
  const [search, setSearch] = useState("");

  const ordered = useMemo(
    () =>
      [...data].sort((a, b) => {
        const ai = platformOrder.findIndex(
          item => item.toLowerCase() === a.platform.toLowerCase()
        );
        const bi = platformOrder.findIndex(
          item => item.toLowerCase() === b.platform.toLowerCase()
        );
        return (
          (ai < 0 ? platformOrder.length : ai) -
            (bi < 0 ? platformOrder.length : bi) ||
          a.category.localeCompare(b.category) ||
          a.name.localeCompare(b.name)
        );
      }),
    [data]
  );
  const platforms = useMemo(() => {
    const known = platformOrder.filter(item =>
      data.some(
        service => service.platform.toLowerCase() === item.toLowerCase()
      )
    );
    const other = Array.from(
      new Set(
        data
          .map(service => service.platform)
          .filter(
            item =>
              !platformOrder.some(
                knownPlatform =>
                  knownPlatform.toLowerCase() === item.toLowerCase()
              )
          )
      )
    ).sort();
    return ["All platforms", ...known, ...other];
  }, [data]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .filter(
              service =>
                platform === "All platforms" ||
                service.platform.toLowerCase() === platform.toLowerCase()
            )
            .map(service => service.category)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [data, platform]
  );
  const filtered = ordered.filter(
    service =>
      (platform === "All platforms" ||
        service.platform.toLowerCase() === platform.toLowerCase()) &&
      (platform === "All platforms" ||
        category === "All categories" ||
        service.category === category) &&
      `${service.name} ${service.category} ${service.platform} ${service.description ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const choosePlatform = (next: string) => {
    setPlatform(next);
    setCategory("All categories");
  };
  const openOrder = (serviceId: number) => {
    preloadRoute("/dashboard/new-order");
    setLocation(`/dashboard/new-order?serviceId=${serviceId}`);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto min-w-0 max-w-7xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-cyan-200">
              Your account <span className="mx-1.5 text-slate-600">/</span>{" "}
              Services
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-.045em] text-white sm:text-3xl">
              Find the right service for each platform.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Browse by platform and service type, compare current prices, and
              place your order with the right target link.
            </p>
          </div>
          <div aria-live="polite" className="text-xs text-slate-500">
            {servicesQuery.isLoading
              ? "Loading catalog…"
              : servicesQuery.isError
                ? "Catalog unavailable"
                : `${filtered.length} ${filtered.length === 1 ? "service" : "services"}`}
          </div>
        </header>

        <section className="rounded-2xl border border-white/[.08] bg-[#0c131e] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div
              className="flex min-w-0 gap-2 overflow-x-auto pb-1"
              role="group"
              aria-label="Filter services by platform"
            >
              {platforms.map(item => {
                const Icon = item === "All platforms" ? Layers3 : iconFor(item);
                const active = item === platform;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={active}
                    onClick={() => choosePlatform(item)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition ${active ? "border-cyan-200/20 bg-cyan-300/[.09] text-cyan-100" : "border-white/[.07] bg-white/[.015] text-slate-400 hover:border-white/15 hover:text-white"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item}
                  </button>
                );
              })}
            </div>
            <div className="relative w-full xl:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
              <Input
                aria-label="Search active services"
                className="h-10 rounded-xl border-white/10 bg-[#080d15] pl-9 text-xs"
                placeholder="Search service or category"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
            </div>
          </div>
          {platform !== "All platforms" && categories.length > 1 && (
            <div className="mt-4 border-t border-white/[.06] pt-3">
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-[.15em] text-slate-500">
                Service type
              </p>
              <div
                className="flex gap-2 overflow-x-auto pb-1"
                role="group"
                aria-label="Filter services by type"
              >
                <button
                  type="button"
                  aria-pressed={category === "All categories"}
                  onClick={() => setCategory("All categories")}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${category === "All categories" ? "border-blue-200/20 bg-blue-200/[.08] text-blue-100" : "border-white/[.07] text-slate-400 hover:text-white"}`}
                >
                  All types
                </button>
                {categories.map(item => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium ${category === item ? "border-blue-200/20 bg-blue-200/[.08] text-blue-100" : "border-white/[.07] text-slate-400 hover:text-white"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {servicesQuery.isError ? (
          <section
            role="alert"
            className="rounded-2xl border border-rose-300/15 bg-[#0c131e] p-6"
          >
            <h2 className="text-sm font-semibold text-white">
              We couldn't load the service catalog
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              {friendlyErrorMessage(
                servicesQuery.error,
                "Check your connection and try again."
              )}
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => void servicesQuery.refetch()}
            >
              Retry catalog
            </Button>
          </section>
        ) : (
          <section
            aria-label={`${platform} service catalog`}
            className="space-y-6"
          >
            {servicesQuery.isLoading ? (
              <div
                aria-live="polite"
                className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <div
                    key={index}
                    className="h-48 animate-pulse rounded-2xl border border-white/[.06] bg-[#0c131e]"
                  />
                ))}
              </div>
            ) : (
              <>
                {platform === "All platforms" ? (
                  platforms.slice(1).map(group => {
                    const groupServices = filtered.filter(
                      service =>
                        service.platform.toLowerCase() === group.toLowerCase()
                    );
                    if (groupServices.length === 0) return null;
                    const Icon = iconFor(group);
                    return (
                      <div key={group} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
                          <h2 className="inline-flex items-center gap-2 text-base font-semibold text-white">
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045] text-cyan-100">
                              <Icon className="h-4 w-4" />
                            </span>
                            {group}
                            <span className="text-[10px] font-normal text-slate-500">
                              {groupServices.length} offers
                            </span>
                          </h2>
                          <button
                            onClick={() => choosePlatform(group)}
                            className="text-[10px] font-medium text-cyan-200 hover:text-white"
                          >
                            View {group}{" "}
                            <ArrowUpRight className="ml-1 inline h-3 w-3" />
                          </button>
                        </div>
                        <ServiceGrid
                          services={groupServices}
                          onSelect={openOrder}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[.07] pb-3">
                      <h2 className="inline-flex items-center gap-2 text-base font-semibold text-white">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.045] text-cyan-100">
                          {(() => {
                            const Icon = iconFor(platform);
                            return <Icon className="h-4 w-4" />;
                          })()}
                        </span>
                        {platform}
                      </h2>
                      <span className="text-[10px] text-slate-500">
                        Current listed offers
                      </span>
                    </div>
                    <ServiceGrid services={filtered} onSelect={openOrder} />
                  </div>
                )}
                {!servicesQuery.isLoading && filtered.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/[.04] text-slate-400">
                      <Search className="h-5 w-5" />
                    </span>
                    <h2 className="mt-4 text-sm font-semibold text-white">
                      No matching services
                    </h2>
                    <p className="mt-2 text-xs text-slate-500">
                      Try another platform, category, or search term.
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        <p className="text-[10px] leading-5 text-slate-500">
          Rates are shown per 1,000 units. Your exact order charge is calculated
          from the selected quantity before you confirm.
        </p>
      </div>
    </DashboardLayout>
  );
}

function ServiceGrid({
  services,
  onSelect,
}: {
  services: Array<{
    id: number;
    platform: string;
    name: string;
    category: string;
    description: string | null;
    retailRatePer1k: string;
    minQuantity: number;
    maxQuantity: number;
  }>;
  onSelect: (serviceId: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {services.map(service => {
        const Icon = iconFor(service.platform);
        return (
          <article
            key={service.id}
            className="group flex min-h-[190px] flex-col rounded-2xl border border-white/[.08] bg-[#0c131e] p-4 transition hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-[#101a27] sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/[.06] bg-white/[.035] text-cyan-100">
                <Icon className="h-4 w-4" />
              </span>
              <span className="rounded-full border border-white/[.07] px-2.5 py-1 text-[9px] font-medium text-slate-400">
                {service.category}
              </span>
            </div>
            <h3 className="mt-4 line-clamp-2 text-sm font-semibold leading-5 text-white">
              {service.name}
            </h3>
            {service.description && (
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                {service.description}
              </p>
            )}
            <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[.06] pt-4">
              <div>
                <p className="text-[9px] text-slate-500">
                  {service.minQuantity.toLocaleString()}–
                  {service.maxQuantity.toLocaleString()} units
                </p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-white">
                  {money(service.retailRatePer1k)}
                  <span className="ml-1 text-[9px] font-normal text-slate-500">
                    / 1k
                  </span>
                </p>
              </div>
              <Button
                size="sm"
                className="h-8 rounded-lg px-3 text-[10px]"
                onMouseEnter={() => preloadRoute("/dashboard/new-order")}
                onFocus={() => preloadRoute("/dashboard/new-order")}
                onClick={() => onSelect(service.id)}
              >
                Order <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
