import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ChevronDown, KeyRound } from 'lucide-react';

import { api, type ApiKeyStatus, type UserBetHistoryItem } from "@/lib/api";
import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
});

const BETS_PER_PAGE = 20;
function ProfilePage() {
  const navigate = useNavigate();
  const [bets, setBets] = useState<UserBetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashingOutBetId, setCashingOutBetId] = useState<number | null>(null);
  const [cashOutError, setCashOutError] = useState<string | null>(null);
  const [cashOutNotice, setCashOutNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ hasApiKey: false, preview: null });
  const [apiKeyValue, setApiKeyValue] = useState<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(true);
  const [apiKeyBusy, setApiKeyBusy] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [apiKeyNotice, setApiKeyNotice] = useState<string | null>(null);
  const [isApiAccessOpen, setIsApiAccessOpen] = useState(false);

  const fetchBets = async ({ background = false }: { background?: boolean } = {}) => {
    try {
      if (!background) {
        setLoading(true);
      }

      const data = await api.getMyBets();
      setBets(data);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  };

  const loadApiKeyStatus = async () => {
    try {
      setApiKeyLoading(true);
      setApiKeyError(null);
      const status = await api.getApiKeyStatus();
      setApiKeyStatus(status);
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : "Failed to load API key status");
    } finally {
      setApiKeyLoading(false);
    }
  };

  useEffect(() => {
    fetchBets();
    void loadApiKeyStatus();

    const refreshBets = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      void fetchBets({ background: true });
    };

    const interval = setInterval(refreshBets, 5000);
    window.addEventListener('focus', refreshBets);
    document.addEventListener('visibilitychange', refreshBets);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshBets);
      document.removeEventListener('visibilitychange', refreshBets);
    };
  }, []);

  const handleGenerateApiKey = async () => {
    try {
      setApiKeyBusy(true);
      setApiKeyError(null);
      const response = await api.generateApiKey();
      setApiKeyStatus({ hasApiKey: true, preview: response.preview });
      setApiKeyValue(response.apiKey);
      setApiKeyNotice("New API key generated. Copy it now; this screen is the only place the full key is shown.");
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : "Failed to generate API key");
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleRevokeApiKey = async () => {
    try {
      setApiKeyBusy(true);
      setApiKeyError(null);
      await api.revokeApiKey();
      setApiKeyStatus({ hasApiKey: false, preview: null });
      setApiKeyValue(null);
      setApiKeyNotice("API key revoked.");
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : "Failed to revoke API key");
    } finally {
      setApiKeyBusy(false);
    }
  };

  const handleCopyApiKey = async () => {
    const valueToCopy = apiKeyValue ?? apiKeyStatus.preview;
    if (!valueToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(valueToCopy);
      setApiKeyNotice(apiKeyValue ? "API key copied to clipboard." : "Masked API key preview copied.");
    } catch {
      setApiKeyError("Failed to copy API key to clipboard");
    }
  };

  const handleCashOut = async (bet: UserBetHistoryItem) => {
    try {
      setCashingOutBetId(bet.id);
      setCashOutError(null);
      setCashOutNotice(null);
      const response = await api.cashOutBet(bet.marketId, bet.id);
      setCashOutNotice(`Cashed out ${bet.market.title} for $${response.cashOutAmount.toFixed(2)}.`);
      await fetchBets();
      setTab('history');
    } catch (error) {
      setCashOutError(error instanceof Error ? error.message : 'Failed to cash out bet');
    } finally {
      setCashingOutBetId(null);
    }
  };

  const allActiveBets = bets.filter(b => b.market.status === 'active' && !b.isCashedOut);
  const allHistoryBets = bets.filter(b => b.market.status === 'resolved' || b.market.status === 'archived' || b.isCashedOut);
  const resolvedBets = bets.filter(b => b.market.status === 'resolved' && !b.isCashedOut);
  const wonResolvedBets = resolvedBets.filter(b => b.market.resolvedOutcomeId === b.outcomeId);
  const lostResolvedBets = resolvedBets.filter(b => b.market.resolvedOutcomeId !== b.outcomeId);
  const totalWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const cashedOutLossTotal = bets.reduce((sum, bet) => {
    if (!bet.isCashedOut) {
      return sum;
    }

    const lossAmount = bet.amount - (bet.cashedOutAmount ?? 0);
    return lossAmount > 0 ? sum + lossAmount : sum;
  }, 0);
  const totalLost = lostResolvedBets.reduce((sum, bet) => sum + bet.amount, 0) + cashedOutLossTotal;
  const totalProfit = allHistoryBets.reduce((sum, bet) => {
    if (bet.isCashedOut) {
      const cashOutProfit = (bet.cashedOutAmount ?? 0) - bet.amount;
      return cashOutProfit > 0 ? sum + cashOutProfit : sum;
    }

    if (bet.market.status === 'archived') {
      return sum;
    }

    if (bet.market.resolvedOutcomeId === bet.outcomeId) {
      return sum + (bet.currentPayout - bet.amount);
    }

    return sum - bet.amount;
  }, 0);
  const winRate = resolvedBets.length > 0
    ? ((wonResolvedBets.length / resolvedBets.length) * 100).toFixed(1)
    : '0.0';

  const activeTotalPages = Math.max(1, Math.ceil(allActiveBets.length / BETS_PER_PAGE));
  const historyTotalPages = Math.max(1, Math.ceil(allHistoryBets.length / BETS_PER_PAGE));

  const activeBets = allActiveBets.slice((activePage - 1) * BETS_PER_PAGE, activePage * BETS_PER_PAGE);
  const historyBets = allHistoryBets.slice((historyPage - 1) * BETS_PER_PAGE, historyPage * BETS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">My Profile</h1>
          <div className="flex items-center gap-3">

            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              ← Back
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/wallet" })}>
              Wallet
            </Button>
            <ThemeToggle />
            <AppMenu />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total Wagered</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                ${totalWagered.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Net Profit</CardDescription>
              <CardTitle className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalProfit >= 0 ? '+' : '-'}${Math.abs(totalProfit).toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Total Lost</CardDescription>
              <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                ${totalLost.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Win Rate</CardDescription>
              <CardTitle className="flex flex-wrap items-baseline gap-2 text-2xl font-bold text-slate-800 dark:text-slate-100">
                <span>{winRate}%</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  <span className="text-emerald-600 dark:text-emerald-400">{wonResolvedBets.length}</span>
                  {' | '}
                  <span className="text-rose-600 dark:text-rose-400">{lostResolvedBets.length}</span>
                </span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button
            variant="outline"
            className="h-10 gap-2 self-end px-4"
            onClick={() => setIsApiAccessOpen((current) => !current)}
            aria-label={isApiAccessOpen ? "Hide API access" : "Show API access"}
            title="API Access"
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>API Key</span>
          </Button>
        </div>

        {isApiAccessOpen && (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>API Access</CardTitle>
                <CardDescription>
                  Generate an API key to create markets and place bets programmatically using the existing API endpoints.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => setIsApiAccessOpen(false)}
                aria-label="Collapse API access"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiKeyLoading ? (
                <p className="text-slate-500 dark:text-slate-400 italic">Loading API access...</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Current API key
                    </p>
                    <Input
                      readOnly
                      value={apiKeyValue ?? apiKeyStatus.preview ?? "No API key generated yet"}
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleGenerateApiKey} disabled={apiKeyBusy}>
                      {apiKeyStatus.hasApiKey ? "Generate new API Key" : "Generate API Key"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCopyApiKey}
                      disabled={!apiKeyValue && !apiKeyStatus.preview}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRevokeApiKey}
                      disabled={apiKeyBusy || !apiKeyStatus.hasApiKey}
                    >
                      Revoke
                    </Button>
                  </div>

                  {apiKeyNotice && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{apiKeyNotice}</p>
                  )}

                  {apiKeyError && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">{apiKeyError}</p>
                  )}


                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB BUTTONS */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <Button
            variant={tab === 'active' ? 'default' : 'outline'}
            onClick={() => setTab('active')}
          >
            Active Bets
            {allActiveBets.length > 0 && (
              <span className="ml-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {allActiveBets.length}
              </span>
            )}
          </Button>
          <Button
            variant={tab === 'history' ? 'default' : 'outline'}
            onClick={() => setTab('history')}
          >
            Betting History
            {allHistoryBets.length > 0 && (
              <span className="ml-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {allHistoryBets.length}
              </span>
            )}
          </Button>
        </div>

        {/* ACTIVE BETS */}
        {tab === 'active' && <section>
          <h2 className="text-xl font-semibold mb-4 text-blue-600 dark:text-blue-400">Active Bets</h2>
          {cashOutNotice && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{cashOutNotice}</p>}
          {cashOutError && <p className="mb-4 text-sm text-rose-600 dark:text-rose-400">{cashOutError}</p>}
          <div className="grid gap-4">
            {loading ? <p className="text-slate-500 dark:text-slate-400 italic animate-pulse">Loading bets...</p> : activeBets.length === 0 ? <p className="text-slate-500 dark:text-slate-400 italic">No active bets.</p> :
              activeBets.map(bet => (
                <div key={bet.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate({ to: '/markets/$id', params: { id: String(bet.market.id) } })}
                      className="text-left font-bold text-slate-800 transition-colors hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                    >
                      {bet.market.title}
                    </button>
                    <p className="text-sm text-slate-500 dark:text-slate-300">You bet on: <span className="font-medium text-slate-700 dark:text-slate-100">{bet.outcome.title}</span></p>
                    <p className="text-sm text-purple-500 dark:text-purple-500 font-medium mt-1">
                      Current multiplier: {(bet.amount > 0 ? bet.currentPayout / bet.amount : 0).toFixed(2)}x
                    </p>
                    <p className="text-sm text-emerald-500 dark:text-emerald-400 font-medium mt-1">
                      Current payout: ${bet.currentPayout.toFixed(2)}
                    </p>
                    <p className="text-sm text-cyan-500 dark:text-cyan-400 font-medium mt-1">
                      Cash out now: ${(bet.cashOutValue ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="font-mono font-bold text-slate-700 dark:text-slate-100">${bet.amount}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Odds : {bet.currentOdds.toFixed(2)}%</p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-wider">Pending</p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleCashOut(bet)}
                      disabled={cashingOutBetId === bet.id || (bet.cashOutValue ?? 0) <= 0}
                    >
                      {cashingOutBetId === bet.id ? 'Cashing out...' : `Cash Out $${(bet.cashOutValue ?? 0).toFixed(2)}`}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
          {/* Active Bets Pagination */}
          {allActiveBets.length > BETS_PER_PAGE && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setActivePage(prev => Math.max(1, prev - 1))}
                disabled={activePage === 1}
              >
                Previous
              </Button>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Page {activePage} of {activeTotalPages}
              </p>
              <Button
                variant="outline"
                onClick={() => setActivePage(prev => Math.min(activeTotalPages, prev + 1))}
                disabled={activePage >= activeTotalPages}
              >
                Next
              </Button>
            </div>
          )}
        </section>}

        {/* RESOLVED BETS */}
        {tab === 'history' && <section>
          <h2 className="text-xl font-semibold mb-4 text-slate-600 dark:text-slate-300">Betting History</h2>
          <div className="grid gap-4">
            {loading ? <p className="text-slate-500 dark:text-slate-400 italic animate-pulse">Loading bets...</p> : historyBets.length === 0 ? <p className="text-slate-500 dark:text-slate-400 italic">No past bets.</p> :
              historyBets.map(bet => {
                if (bet.isCashedOut) {
                  return (
                    <div key={bet.id} className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center opacity-75">
                      <div>
                        <p className="font-bold text-purple-700 dark:text-purple-700">{bet.market.title}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Bet: {bet.outcome.title}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-100">${bet.amount}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Balance +${(bet.cashedOutAmount ?? 0).toFixed(2)} cash out
                        </p>
                        <p className="text-xs font-black uppercase text-cyan-500 dark:text-cyan-500">
                          CASHED OUT
                        </p>
                      </div>
                    </div>
                  )
                }

                const won = bet.market.resolvedOutcomeId === bet.outcomeId;
                const isArchived = bet.market.status === 'archived';
                const settledPayout = isArchived ? bet.amount : won ? bet.currentPayout : 0;
                return (
                  <div key={bet.id} className="bg-slate-50 dark:bg-slate-900/70 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center opacity-75">
                    <div>
                      <p className="font-bold text-purple-700 dark:text-purple-700">{bet.market.title}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">Bet: {bet.outcome.title}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-800 dark:text-slate-100">${bet.amount}</p>
                      {isArchived ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Balance +${bet.amount.toFixed(2)} refund
                        </p>
                      ) : won ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Balance +${settledPayout.toFixed(2)}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Balance -${bet.amount.toFixed(2)}
                        </p>
                      )}
                      <p className={`text-xs font-black uppercase ${isArchived ? 'text-amber-600 dark:text-amber-400' : won ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {isArchived ? 'ARCHIVED - REFUNDED' : won ? 'WON' : 'LOST'}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
          {/* History Pagination */}
          {allHistoryBets.length > BETS_PER_PAGE && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                disabled={historyPage === 1}
              >
                Previous
              </Button>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Page {historyPage} of {historyTotalPages}
              </p>
              <Button
                variant="outline"
                onClick={() => setHistoryPage(prev => Math.min(historyTotalPages, prev + 1))}
                disabled={historyPage >= historyTotalPages}
              >
                Next
              </Button>
            </div>
          )}
        </section>}
      </div>
    </div>
  );
}