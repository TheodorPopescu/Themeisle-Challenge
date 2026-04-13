import { Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";

interface MarketCardProps {
  market: Market;
}

const DEFAULT_MARKET_CLOSES_AT = "2027-01-01T00:00:00.000Z";

function formatClosingDate(date: Date) {
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MarketCard({ market }: MarketCardProps) {
  const navigate = useNavigate();
  const closingDate = new Date(market.closesAt || DEFAULT_MARKET_CLOSES_AT);
  const isBettingClosed =
    !!closingDate && !Number.isNaN(closingDate.getTime()) && closingDate.getTime() <= Date.now();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{market.title}</CardTitle>
            <CardDescription>By: {market.creator || "Unknown"}</CardDescription>
            {closingDate && !Number.isNaN(closingDate.getTime()) && (
              <CardDescription>Closes: {formatClosingDate(closingDate)}</CardDescription>
            )}
          </div>
          <Badge variant={market.status === "active" ? "default" : "secondary"}>
            {market.status === "active" ? "Active" : "Resolved"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 min-h-[360px] h-full">
        {/* Outcomes */}
        <div className="space-y-2 flex-1">
          {market.outcomes.map((outcome) => (
            <div
              key={outcome.id}
              className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-secondary/20"
            >
              <div>
                <p className="text-sm font-medium">{outcome.title}</p>
                <p className="text-xs text-muted-foreground">
                  ${outcome.totalBets.toFixed(2)} total
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{outcome.odds}%</p>
                <p className="text-xs text-muted-foreground">Odds</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-dashed border-border/70 bg-slate-50/70 px-3 py-3 dark:bg-slate-900/40">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Total Pool
                </p>
                <p className="mt-1 text-base font-semibold text-primary">
                  ${market.totalMarketBets.toFixed(2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Participants
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {market.participantsCount ?? 0}
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button className="w-full" onClick={() => navigate({ to: `/markets/${market.id}` })}>
            {market.status === "active" && !isBettingClosed ? "Place Bet" : "View Results"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
