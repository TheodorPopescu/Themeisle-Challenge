import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ThemeToggle } from "@/components/theme-toggle";

const DEFAULT_MARKET_CLOSES_AT = "2027-01-01T00:00:00.000Z";
const MARKET_REFRESH_INTERVAL_MS = 5000;
const BET_SCRUB_PIXELS_PER_STEP = 10;
const BET_SCRUB_AMOUNT_STEP = 1;

function formatClosingDate(date: Date) {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBetAmount(value: number): string {
  const rounded = Number(value.toFixed(2));
  return rounded.toString();
}

function clampBetAmount(value: number): number {
  return Math.max(0, Number(value.toFixed(2)));
}

function MarketDetailPage() {
  const { id } = useParams({ from: "/markets/$id" });
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<number | null>(null);
  const [betAmount, setBetAmount] = useState("");
  const [isBetting, setIsBetting] = useState(false);
  const [potentialPayout, setPotentialPayout] = useState(0);
  const [betFeedbackMessage, setBetFeedbackMessage] = useState<string | null>(null);
  const amountScrubButtonRef = useRef<HTMLButtonElement | null>(null);
  const amountScrubState = useRef<{
    startAmount: number;
    accumulatedX: number;
    lastStep: number;
  } | null>(null);

  const marketId = parseInt(id, 10);
  const closingDate = market ? new Date(market.closesAt || DEFAULT_MARKET_CLOSES_AT) : null;
  const isBettingClosed = !!closingDate && !Number.isNaN(closingDate.getTime()) && closingDate.getTime() <= Date.now();
  const insufficientBalanceError = error?.toLowerCase().includes("insufficient balance")
    ? "Insufficient balance"
    : null;

  const handleBackNavigation = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    void navigate({ to: "/" });
  };

  const loadMarket = async ({ background = false }: { background?: boolean } = {}) => {
    try {
      if (!background) {
        setIsLoading(true);
        setError(null);
      }

      const marketData = await api.getMarket(marketId);
      setMarket(marketData);
      setSelectedOutcomeId((currentSelectedOutcomeId) => {
        if (
          currentSelectedOutcomeId != null
          && marketData.outcomes.some((outcome) => outcome.id === currentSelectedOutcomeId)
        ) {
          return currentSelectedOutcomeId;
        }

        return marketData.outcomes[0]?.id ?? null;
      });
    } catch (err) {
      if (!background) {
        setError(err instanceof Error ? err.message : "Failed to load market details");
      }
    } finally {
      if (!background) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadMarket();
  }, [marketId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const refreshMarket = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void loadMarket({ background: true });
    };

    const intervalId = window.setInterval(refreshMarket, MARKET_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshMarket);
    document.addEventListener("visibilitychange", refreshMarket);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshMarket);
      document.removeEventListener("visibilitychange", refreshMarket);
    };
  }, [isAuthenticated, marketId]);

  useEffect(() => {
    const handleScrubMove = (event: MouseEvent) => {
      const scrubState = amountScrubState.current;
      if (!scrubState || document.pointerLockElement !== amountScrubButtonRef.current) {
        return;
      }

      scrubState.accumulatedX += event.movementX;
      const nextStep = Math.trunc(scrubState.accumulatedX / BET_SCRUB_PIXELS_PER_STEP);
      if (nextStep === scrubState.lastStep) {
        return;
      }

      scrubState.lastStep = nextStep;
      const nextAmount = scrubState.startAmount + nextStep * BET_SCRUB_AMOUNT_STEP;
      setBetAmount(formatBetAmount(clampBetAmount(nextAmount)));
    };

    const clearScrubIfUnlocked = () => {
      if (document.pointerLockElement !== amountScrubButtonRef.current) {
        amountScrubState.current = null;
      }
    };

    const endScrub = () => {
      if (document.pointerLockElement === amountScrubButtonRef.current) {
        document.exitPointerLock();
        return;
      }

      amountScrubState.current = null;
    };

    document.addEventListener("mousemove", handleScrubMove);
    document.addEventListener("mouseup", endScrub);
    document.addEventListener("pointerlockchange", clearScrubIfUnlocked);

    return () => {
      document.removeEventListener("mousemove", handleScrubMove);
      document.removeEventListener("mouseup", endScrub);
      document.removeEventListener("pointerlockchange", clearScrubIfUnlocked);
    };
  }, []);

  const handlePlaceBet = async () => {
    if (!selectedOutcomeId || !betAmount) {
      setBetFeedbackMessage(null);
      setError("Please select an outcome and enter a bet amount");
      return;
    }

    try {
      setIsBetting(true);
      setError(null);
      setBetFeedbackMessage(null);
      await api.placeBet(marketId, selectedOutcomeId, parseFloat(betAmount));
      setBetAmount("");
      setBetFeedbackMessage("Bet placed");
      await loadMarket({ background: true });
    } catch (err) {
      setBetFeedbackMessage(null);
      setError(err instanceof Error ? err.message : "Failed to place bet");
    } finally {
      setIsBetting(false);
    }
  };

  const handleBetSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handlePlaceBet();
  };

  const resolveMarket = async (winningOutcomeId: number) => {
    try {
      setError(null);
      await api.resolveMarket(marketId, winningOutcomeId);
      await loadMarket({ background: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve market");
    }
  };

  const archiveMarket = async () => {
    try {
      setError(null);
      await api.archiveMarket(marketId);
      await loadMarket({ background: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive market");
    }
  };

  const handleAmountScrubPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isBetting) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus();
    amountScrubState.current = {
      startAmount: clampBetAmount(Number(betAmount) || 0),
      accumulatedX: 0,
      lastStep: 0,
    };
    if (document.pointerLockElement !== event.currentTarget) {
      event.currentTarget.requestPointerLock();
    }
  };

  const clearAmountScrub = () => {
    if (document.pointerLockElement === amountScrubButtonRef.current) {
      document.exitPointerLock();
      return;
    }

    amountScrubState.current = null;
  };

  // Calculate potential payout when bet amount or selected outcome changes
  useEffect(() => {
    let payout = 0;
    const betAmountNum = Number(betAmount) || 0;

    if (selectedOutcomeId && betAmountNum > 0 && market) {
      const selectedOutcome = market.outcomes.find((o: any) => o.id === selectedOutcomeId);

      if (selectedOutcome) {
        const currentTotalPool = market.totalMarketBets || 0;
        const currentOutcomePool = selectedOutcome.totalBets || 0;

        // Calculate what the pools WILL be if this bet goes through
        const newTotalPool = currentTotalPool + betAmountNum;
        const newOutcomePool = currentOutcomePool + betAmountNum;

        // Calculate the payout
        payout = (betAmountNum / newOutcomePool) * newTotalPool;
      }
    }

    setPotentialPayout(payout);
  }, [betAmount, selectedOutcomeId, market]);

  const chartData = market?.outcomes.map((outcome: any) => ({
    name: outcome.title,
    value: outcome.totalBets || 0,
    percentage: outcome.odds || 0
  })) || [];

  // Calculate preview chart data showing pools AFTER the proposed bet
  const previewChartData = (() => {
    const betAmountNum = Number(betAmount) || 0;
    if (!market || betAmountNum <= 0 || !selectedOutcomeId) {
      return chartData;
    }

    return market.outcomes.map((outcome: any) => {
      const currentBets = outcome.totalBets || 0;
      const newBets = outcome.id === selectedOutcomeId ? currentBets + betAmountNum : currentBets;
      return {
        name: outcome.title,
        value: newBets,
        percentage: outcome.odds || 0
      };
    });
  })();

  // A beautiful sunset color palette for the chart slices
  const COLORS = ['#610593', '#ac0f4e', '#ba04ab', '#FF8C42', '#000000'];

  // Check if there are actually any bets yet
  const hasBets = (market?.totalMarketBets || 0) > 0;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-muted-foreground">Please log in to view this market</p>
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading market...</p>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Market not found</p>
            <Button onClick={handleBackNavigation}>Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleBackNavigation}>
              ← Back
            </Button>
          </div>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-4xl">{market.title}</CardTitle>
                {market.description && (
                  <CardDescription className="text-lg mt-2">{market.description}</CardDescription>
                )}
                {closingDate && !Number.isNaN(closingDate.getTime()) && (
                  <CardDescription className="text-sm mt-2">Closes: {formatClosingDate(closingDate)}</CardDescription>
                )}
              </div>
              <Badge variant={market.status === "active" ? "default" : "secondary"}>
                {market.status === "active"
                  ? "Active"
                  : market.status === "archived"
                    ? "Archived"
                    : "Resolved"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && !insufficientBalanceError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Outcomes Display */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Outcomes</h3>
              {market.outcomes.map((outcome) => (
                <div
                  key={outcome.id}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${selectedOutcomeId === outcome.id
                    ? "border-primary bg-primary/5"
                    : "border-secondary bg-secondary/5 hover:border-primary/50"
                    }`}
                  onClick={() => {
                    if (market.status === "active" && !isBettingClosed) {
                      setSelectedOutcomeId(outcome.id);
                      setBetFeedbackMessage(null);
                    }
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <h4 className="font-semibold">{outcome.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Total bets: ${outcome.totalBets.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{outcome.odds}%</p>
                      <p className="text-xs text-muted-foreground">odds</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Market Stats */}
            <div className="rounded-lg p-6 border border-primary/20 bg-primary/5">
              <p className="text-sm text-muted-foreground mb-1">Total Market Value</p>
              <p className="text-4xl font-bold text-primary">
                ${(market.totalMarketBets || 0).toFixed(2)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
                {Number(betAmount) > 0 && selectedOutcomeId ? "Pool Distribution with Your Bet" : "Current Pool Distribution"}
              </h3>

              {!hasBets && (!betAmount || Number(betAmount) === 0) ? (
                <div className="h-64 flex items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                  <p className="text-slate-500 dark:text-slate-300 font-medium">No bets placed yet. Be the first!</p>
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Number(betAmount) > 0 && selectedOutcomeId ? previewChartData : chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {(Number(betAmount) > 0 && selectedOutcomeId ? previewChartData : chartData).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any) => value ? [`$${Number(value).toFixed(2)}`, 'Total Bets'] : ['N/A', 'Total Bets']}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: "#cbd5e1" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Betting Section */}
            {market.status === "active" && !isBettingClosed && (
              <Card className="bg-secondary/5">
                <CardHeader>
                  <CardTitle>Place Your Bet</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleBetSubmit}>
                    <div className="space-y-2">
                      <Label>Selected Outcome</Label>
                      <div className="p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-secondary rounded-md">
                        {market.outcomes.find((o) => o.id === selectedOutcomeId)?.title ||
                          "None selected"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="betAmount">Bet Amount ($)</Label>
                      <div className="flex items-stretch gap-2">
                        <Input
                          id="betAmount"
                          className="bet-amount-input"
                          type="number"
                          step="0.01"
                          min="0"
                          value={betAmount}
                          onChange={(e) => {
                            setBetAmount(e.target.value);
                            setBetFeedbackMessage(null);
                          }}
                          placeholder="Enter amount"
                          disabled={isBetting}
                        />
                        <button
                          ref={amountScrubButtonRef}
                          type="button"
                          aria-label="Drag horizontally to adjust bet amount continuously"
                          title="Click and drag horizontally. Release or press Escape to stop."
                          className="select-none rounded-md border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 active:cursor-ew-resize dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          onPointerDown={handleAmountScrubPointerDown}
                          onPointerUp={clearAmountScrub}
                          onPointerCancel={clearAmountScrub}
                          disabled={isBetting}
                        >
                          Drag
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Drag right to add, drag left to subtract. Release or press Escape to stop.
                      </p>
                      {insufficientBalanceError && (
                        <p className="text-sm text-destructive">{insufficientBalanceError}</p>
                      )}
                      {betFeedbackMessage && !insufficientBalanceError && (
                        <p className="text-sm text-green-600 dark:text-green-400">{betFeedbackMessage}</p>
                      )}
                    </div>

                    {potentialPayout > 0 && (
                      <div className="rounded-lg p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-600">
                        <p className="text-sm text-muted-foreground mb-1">Potential Payout</p>
                        <p className="text-2xl font-bold text-green-500">
                          ${potentialPayout.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          If you win (this may vary by the time the bet resolves)
                        </p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full text-lg py-6"
                      disabled={isBetting || !selectedOutcomeId || !betAmount}
                    >
                      {isBetting ? "Placing bet..." : "Place Bet"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {user?.role === 'ADMIN' && market.status === 'active' && (
              <div className="mb-8 rounded-xl border-2 border-orange-200 bg-orange-50 p-6 dark:border-orange-900/70 dark:bg-orange-950/40">
                <h3 className="mb-4 text-center text-sm font-bold uppercase tracking-wider text-orange-800 dark:text-orange-300">Admin Control Panel</h3>
                <p className="mb-4 text-center text-sm text-orange-700 dark:text-orange-200/85">Select the winning outcome to close this market and pay out users:</p>
                <div className="flex flex-wrap gap-2">
                  {market.outcomes.map((outcome: any) => (
                    <button
                      key={outcome.id}
                      onClick={() => resolveMarket(outcome.id)}
                      className="rounded-lg bg-orange-500 px-4 py-2 font-bold text-white transition-transform hover:bg-orange-600 active:scale-95 dark:bg-orange-600 dark:hover:bg-orange-500"
                    >
                      Mark "{outcome.title}" as Winner
                    </button>
                  ))}
                  <button
                    onClick={archiveMarket}
                    className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition-transform hover:bg-red-700 active:scale-95 dark:bg-red-700 dark:hover:bg-red-600"
                  >
                    Archive & Refund
                  </button>
                </div>
              </div>
            )}

            {market.status === "active" && isBettingClosed && (
              <Card className="bg-secondary/5">
                <CardContent className="py-6">
                  <p className="text-sm text-muted-foreground">Betting is closed for this market.</p>
                </CardContent>
              </Card>
            )}

            {market.status === "resolved" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been resolved.</p>
                </CardContent>
              </Card>
            )}

            {market.status === "archived" && (
              <Card>
                <CardContent className="py-6">
                  <p className="text-muted-foreground">This market has been archived and all bets were refunded.</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/markets/$id")({
  component: MarketDetailPage,
});
