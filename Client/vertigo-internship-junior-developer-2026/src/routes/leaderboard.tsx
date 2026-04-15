import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";

// This tells the router that this is a new page at /leaderboard
export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
});

type LeaderboardUser = {
  username: string;
  winnings: number;
  winRate?: number;
};

type LeaderboardBadge = {
  label: string;
  description: string;
  className: string;
};

function getUserTier(winnings: number) {
  if (winnings > 10000) {
    return {
      badge: "🐋 Whale",
      badgeClassName: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-200",
      nameClassName: "text-yellow-800 dark:text-yellow-300",
    };
  }

  if (winnings > 4000) {
    return {
      badge: "🦈 Shark",
      badgeClassName: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
      nameClassName: "text-slate-800 dark:text-slate-100",
    };
  }

  /* if (winnings > 1000 && winnings <= 4000) {
     return {
       badge: "🦐 Shrimp",       
       badgeClassName: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200",
       nameClassName: "text-slate-800 dark:text-slate-100",
     };
   }
     */

  return {
    badge: null,
    badgeClassName: "",
    nameClassName: "text-slate-800 dark:text-slate-100",
  };
}

function getUserBadges(winnings: number, winRate = 0) {
  const tier = getUserTier(winnings);
  const badges: LeaderboardBadge[] = [];

  if (tier.badge) {
    badges.push({
      label: tier.badge,
      description: tier.badge.includes('Whale') ? 'Over 10000 in winnings' : 'Over 4000 in winnings',
      className: tier.badgeClassName,
    });
  }

  if (winRate > 90) {
    badges.push({
      label: '💎 Flawless',
      description: 'Over 90% win rate',
      className: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-950/60 dark:text-fuchsia-200',
    });
  }

  return {
    ...tier,
    badges,
  };
}

function LeaderboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data from your new backend endpoint
    fetch(`${import.meta.env.VITE_API_URL}/api/markets/leaderboard`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err) => console.error("Error fetching leaderboard:", err));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Leaderboard</h1>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              ← Back
            </Button>
            <ThemeToggle />
            <AppMenu />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 shadow-md rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Rank</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Username</th>
                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 text-right">Total Winnings</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center text-slate-400 dark:text-slate-500">Loading rankings...</td></tr>
              ) : (
                users.map((leaderboardUser, index) => {
                  const tier = getUserBadges(leaderboardUser.winnings, leaderboardUser.winRate ?? 0);
                  const isCurrentUser = leaderboardUser.username === user?.username;

                  return (
                    <tr key={leaderboardUser.username} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="p-4 font-medium text-slate-500 dark:text-slate-400">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${tier.nameClassName}`}>
                            {leaderboardUser.username}
                            {isCurrentUser ? ' (you)' : ''}
                          </span>
                          {tier.badges.map((badge) => (
                            <span
                              key={`${leaderboardUser.username}-${badge.label}`}
                              className="group relative inline-flex cursor-default select-none"
                            >
                              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}>
                                {badge.label}
                              </span>
                              <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/95 px-2.5 py-1.5 text-[11px] italic text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-slate-800">
                                {badge.description}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${leaderboardUser.winnings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}