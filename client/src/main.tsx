import { trpc } from "@/lib/trpc";
import { isUnauthorizedError, friendlyErrorMessage } from "@shared/errorMessages";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => !isUnauthorizedError(error) && failureCount < 2,
      retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 2_000),
    },
  },
});

queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== "updated" || event.action.type !== "error") return;
  const error = event.query.state.error;
  if (isUnauthorizedError(error)) {
    if (typeof window !== "undefined" && window.location.pathname !== "/auth") {
      startLogin(window.location.pathname + window.location.search);
    }
    return;
  }

  console.error("[API Query Error]", error);
  toast.error("Couldn't load this information", {
    id: `query-error-${event.query.queryHash}`,
    description: friendlyErrorMessage(error, "Check your connection, then try again."),
    action: { label: "Retry", onClick: () => { void event.query.fetch(); } },
    duration: 7_000,
    closeButton: true,
  });
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc",
    transformer: superjson,
    fetch(input, init) {
      return globalThis.fetch(input, { ...(init ?? {}), credentials: "same-origin" });
    },
  })],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
  </trpc.Provider>
);
