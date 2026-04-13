import { Elysia, t } from "elysia";
import { authMiddleware } from "../middleware/auth.middleware";
import {
  handleCreateMarket,
  handleListMarkets,
  handleGetMarket,
  handlePlaceBet,
  handleCashOutBet,
  handleLeaderboard,
  handleGetUserBets,
  handleResolveMarket,
  handleArchiveMarket
} from "./handlers";

export const marketRoutes = new Elysia({ prefix: "/api/markets" })
  .use(authMiddleware)

  // 1. Specific routes MUST come first
  .get("/leaderboard", handleLeaderboard)

  // 2. Then the list route
  .get("/", handleListMarkets, {
    query: t.Object({
      status: t.Optional(t.String()),
      page: t.Optional(t.Numeric()),
      sortBy: t.Optional(t.String()),
      search: t.Optional(t.String()),
    }),
  })

  // 3. Dynamic routes (with :id) come LAST
  .get("/:id", handleGetMarket, {
    params: t.Object({
      id: t.Numeric(),
    }),
  })

  // 4. Protected routes (Login required)
  .guard(
    {
      beforeHandle({ user, set }) {
        if (!user) {
          set.status = 401;
          return { error: "Unauthorized" };
        }
      },
    },
    (app) =>
      app
        .get("/my-bets", handleGetUserBets)
        .post("/", handleCreateMarket, {
          body: t.Object({
            title: t.String(),
            description: t.Optional(t.String()),
            outcomes: t.Array(t.String()),
            closesAt: t.Optional(t.String()),
          }),
        })
        .post("/:id/bets", handlePlaceBet, {
          params: t.Object({
            id: t.Numeric(),
          }),
          body: t.Object({
            outcomeId: t.Number(),
            amount: t.Number(),
          }),
        })
        .post("/:id/bets/:betId/cash-out", handleCashOutBet, {
          params: t.Object({
            id: t.Numeric(),
            betId: t.Numeric(),
          }),
        })
        .post("/:id/resolve", handleResolveMarket, {
          params: t.Object({ id: t.Numeric() }),
          body: t.Object({ winningOutcomeId: t.Number() })
        })
        .post("/:id/archive", handleArchiveMarket, {
          params: t.Object({ id: t.Numeric() }),
        })

  );