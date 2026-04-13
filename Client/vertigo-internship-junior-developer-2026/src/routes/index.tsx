import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle, RotateCw, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, Market, MarketSortOption } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppMenu } from "@/components/app-menu";
import { Input } from "@/components/ui/input";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const MARKET_REFRESH_INTERVAL_MS = 5000;
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInlineFetchingMarkets, setIsInlineFetchingMarkets] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [sortBy, setSortBy] = useState<MarketSortOption>("newest");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const latestMarketQueryKey = useRef("");
  const previousLoadedSearchQuery = useRef("");
  const hasPendingSearchInput = searchInput.trim() !== searchQuery;
  const isRefreshingMarkets = isLoading || isInlineFetchingMarkets;
  const showSearchSpinner = hasPendingSearchInput || isInlineFetchingMarkets;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, sortBy, searchQuery]);

  const loadMarkets = async ({ background = false }: { background?: boolean } = {}) => {
    const queryKey = JSON.stringify({ status, page, sortBy, searchQuery });
    latestMarketQueryKey.current = queryKey;

    try {
      if (!background) {
        const isBroadeningSearch = searchQuery.length < previousLoadedSearchQuery.current.length;
        const shouldUseFullPageLoader = markets.length === 0 || isBroadeningSearch;
        setIsLoading(shouldUseFullPageLoader);
        setIsInlineFetchingMarkets(!shouldUseFullPageLoader);
        setError(null);
      }

      const data = await api.listMarkets(status, page, sortBy, searchQuery);
      if (queryKey !== latestMarketQueryKey.current) {
        return;
      }

      setMarkets(data.markets);
      setTotalPages(Math.max(1, Math.ceil(data.totalCount / data.limit)));
      previousLoadedSearchQuery.current = searchQuery;
    } catch (err) {
      if (!background && queryKey === latestMarketQueryKey.current) {
        setError(err instanceof Error ? err.message : "Failed to load markets");
      }
    } finally {
      if (!background && queryKey === latestMarketQueryKey.current) {
        setIsLoading(false);
        setIsInlineFetchingMarkets(false);
      }
    }
  };

  useEffect(() => {
    loadMarkets();
  }, [status, page, sortBy, searchQuery]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshMarkets = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadMarkets({ background: true });
    };

    const intervalId = window.setInterval(refreshMarkets, MARKET_REFRESH_INTERVAL_MS);

    const handleFocusRefresh = () => {
      refreshMarkets();
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
    };
  }, [isAuthenticated, status, page, sortBy, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">Prediction Markets</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Markets</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">Welcome back, {user?.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => navigate({ to: "/markets/new" })}>Create Market</Button>
            <ThemeToggle />
            <AppMenu />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-4">
              <Button
                variant={status === "active" ? "default" : "outline"}
                onClick={() => setStatus("active")}
              >
                Active Markets
              </Button>
              <Button
                variant={status === "resolved" ? "default" : "outline"}
                onClick={() => setStatus("resolved")}
              >
                Resolved Markets
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => loadMarkets()}
                disabled={isRefreshingMarkets}
                aria-label="Refresh markets"
                title="Refresh markets"
              >
                <RotateCw className={isRefreshingMarkets ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Sort by</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as MarketSortOption)}>
                <SelectTrigger className="w-[190px] rounded-md border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900">
                  <SelectValue placeholder="Sort markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                  <SelectItem value="closingSoon">Closing soon</SelectItem>
                  <SelectItem value="pool">Total bet size</SelectItem>
                  <SelectItem value="participants">Participants</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-2">
              <div className="flex w-[24rem] items-center gap-2">
                <label
                  htmlFor="marketSearch"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-900 bg-slate-900 text-white shadow-sm dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m22 22-5.25-5.25" />
                  </svg>
                </label>
                <div className="relative min-w-0 flex-1">
                  <Input
                    id="marketSearch"
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by market title, description, creator, or outcome"
                    className={`market-search-input min-w-0 border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-900 ${searchInput ? "pr-8" : ""}`}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      aria-label="Clear search"
                      title="Clear search"
                      onClick={() => {
                        setSearchInput("");
                        setSearchQuery("");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex w-4 shrink-0 justify-center">
                {showSearchSpinner && (
                  <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground text-lg">
                  {searchQuery.trim()
                    ? `No ${status} markets found for "${searchQuery.trim()}".`
                    : `No ${status} markets found.`} {status === "active" && !searchQuery.trim() && "Create one to get started!"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {markets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1 || isLoading}
              >
                Previous
              </Button>
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <Button
                variant="outline"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || isLoading}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
