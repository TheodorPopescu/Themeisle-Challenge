import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { AppMenu } from "@/components/app-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto max-w-5xl space-y-8 px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">About Markets</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Learn how prediction markets, payouts, and API access work on this platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate({ to: "/" })}>
              ← Back
            </Button>
            <ThemeToggle />
            <AppMenu />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>🎯 Welcome to the Prediction Market</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <p>
              A prediction market is a place where you can trade on the outcome of real-world events. Whether it&apos;s sports, crypto prices, or pop culture, if it can be verified, you can bet on it.
            </p>
            <p>
              Our platform uses the wisdom of the crowd to determine the odds. You aren&apos;t playing against &quot;the house&quot; - you are playing against other users.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💰 How Payouts Work (The Pool System)</CardTitle>
            <CardDescription>We use a fair, transparent system called Pool Betting (Pari-mutuel).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <p>
              Instead of fixed odds decided by a bookmaker, all the money placed on a market goes into one giant &quot;Total Pool.&quot; When the market resolves, the losers&apos; money is distributed to the winners.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/50">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Here is the golden rule:</p>
              <p className="mt-2">
                Your payout is based on the percentage of the winning pool you own. If you placed 10% of all the money bet on the winning outcome, you get 10% of the entire Total Pool.
              </p>
            </div>
            <p>
              ⚠️ Note: Because the odds are driven by the community, your estimated payout will dynamically change as more users place bets until the market officially closes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚀 Step-by-Step Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">1. Find a Market</p>
              <p>Browse the dashboard and look for active markets. You can sort by &quot;Closing Soon&quot; to find events happening right now.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">2. Make Your Prediction</p>
              <p>Pick the outcome you believe will happen and enter your bet amount. Our system will instantly show you your estimated payout.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">3. The Market Closes</p>
              <p>Once the real-world event happens, our Admins will verify the result and formally resolve the market.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">4. Collect Your Winnings</p>
              <p>If you picked correctly, your share of the Total Pool is instantly deposited into your account balance. If the market is canceled for any reason, all bets are 100% refunded.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🤖 For Developers (API Access)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
            <p>
              Are you a power user? Head over to your Profile to generate a personal API Key. You can use this key to authenticate your own scripts or bots to place bets programmatically without ever opening the browser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}