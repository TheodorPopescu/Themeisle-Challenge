import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { api, type Market, type UserBetHistoryItem } from "@/lib/api";

type OutcomeNotification = {
    id: string;
    title: string;
    message: string;
    tone: "win" | "loss" | "refund";
};

export function BetOutcomeNotifications() {
    const { isAuthenticated, user } = useAuth();
    const [notifications, setNotifications] = useState<OutcomeNotification[]>([]);
    const inFlightRef = useRef(false);
    const outcomeNotificationStorageKey = `seen_bet_outcomes_v2_${user?.id ?? "guest"}`;

    useEffect(() => {
        if (!isAuthenticated) {
            setNotifications([]);
            return;
        }

        let isActive = true;

        const loadOutcomeNotifications = async () => {
            if (inFlightRef.current) {
                return;
            }

            inFlightRef.current = true;

            try {
                const betHistory = await api.getMyBets();
                const settledBets = betHistory.filter(
                    (bet) => bet.market.status === "resolved" || bet.market.status === "archived",
                );

                const seenOutcomeKeys = new Set<string>(
                    JSON.parse(localStorage.getItem(outcomeNotificationStorageKey) || "[]"),
                );

                const unseenSettledBets = settledBets.filter((bet) => {
                    const outcomeKey = String(bet.id);
                    return !seenOutcomeKeys.has(outcomeKey);
                });

                if (unseenSettledBets.length === 0 || !isActive) {
                    return;
                }

                const resolvedMarketIds = Array.from(
                    new Set(
                        unseenSettledBets
                            .filter((bet) => bet.market.status === "resolved")
                            .map((bet) => bet.marketId),
                    ),
                );

                const resolvedMarketDetails = new Map<number, Market>();
                await Promise.all(
                    resolvedMarketIds.map(async (marketId) => {
                        const market = await api.getMarket(marketId);
                        resolvedMarketDetails.set(marketId, market);
                    }),
                );

                const newNotifications = unseenSettledBets.map((bet: UserBetHistoryItem) => {
                    if (bet.market.status === "archived") {
                        return {
                            id: `${bet.id}-archived`,
                            title: "Archived Bet Refunded",
                            message: `${bet.market.title}: +$${bet.amount.toFixed(2)}`,
                            tone: "refund" as const,
                        };
                    }

                    const won = bet.market.resolvedOutcomeId === bet.outcomeId;
                    if (!won) {
                        return {
                            id: `${bet.id}-lost`,
                            title: "Bet Lost",
                            message: `${bet.market.title}: -$${bet.amount.toFixed(2)}`,
                            tone: "loss" as const,
                        };
                    }

                    const marketDetails = resolvedMarketDetails.get(bet.marketId);
                    const winningPool =
                        marketDetails?.outcomes.find((outcome) => outcome.id === bet.outcomeId)?.totalBets || 0;
                    const totalPool = marketDetails?.totalMarketBets || 0;
                    const payout = winningPool > 0 ? (bet.amount / winningPool) * totalPool : bet.amount;

                    return {
                        id: `${bet.id}-won`,
                        title: "Bet Won",
                        message: `${bet.market.title}: +$${payout.toFixed(2)}`,
                        tone: "win" as const,
                    };
                });

                const newlySeenKeys = unseenSettledBets.map(
                    (bet) => String(bet.id),
                );
                const updatedSeen = Array.from(new Set([...Array.from(seenOutcomeKeys), ...newlySeenKeys]));
                localStorage.setItem(outcomeNotificationStorageKey, JSON.stringify(updatedSeen));

                if (!isActive) {
                    return;
                }

                setNotifications((prev) => {
                    const existingIds = new Set(prev.map((notification) => notification.id));
                    const additions = newNotifications.filter((notification) => !existingIds.has(notification.id));
                    return [...prev, ...additions];
                });
            } catch {
                // Non-blocking: notification checks should never break app rendering.
            } finally {
                inFlightRef.current = false;
            }
        };

        void loadOutcomeNotifications();
        const intervalId = window.setInterval(loadOutcomeNotifications, 2000);

        const handleFocusRefresh = () => {
            void loadOutcomeNotifications();
        };

        window.addEventListener("focus", handleFocusRefresh);
        document.addEventListener("visibilitychange", handleFocusRefresh);

        return () => {
            isActive = false;
            window.clearInterval(intervalId);
            window.removeEventListener("focus", handleFocusRefresh);
            document.removeEventListener("visibilitychange", handleFocusRefresh);
        };
    }, [isAuthenticated, outcomeNotificationStorageKey]);

    const dismissNotification = (id: string) => {
        setNotifications((prev) => prev.filter((notification) => notification.id !== id));
    };

    if (!isAuthenticated || notifications.length === 0) {
        return null;
    }

    return (
        <div className="fixed right-4 top-4 z-50 flex w-[360px] max-w-[95vw] flex-col gap-3">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`rounded-md border p-4 shadow-lg ${notification.tone === "win"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-950 dark:text-emerald-200"
                        : notification.tone === "loss"
                            ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-600 dark:bg-rose-950 dark:text-rose-200"
                            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-200"
                        }`}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold">{notification.title}</p>
                            <p className="mt-1 text-sm opacity-90">{notification.message}</p>
                        </div>
                        <button
                            type="button"
                            className="text-xs font-bold opacity-70 hover:opacity-100"
                            onClick={() => dismissNotification(notification.id)}
                        >
                            X
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}