import { eq, and, isNull } from "drizzle-orm";
import { getDb, type DbType } from "../db";
import { usersTable, marketsTable, marketOutcomesTable, betsTable } from "../db/schema";
import {
  generateApiKey,
  hashPassword,
  maskApiKey,
  verifyPassword,
  type AuthTokenPayload,
} from "../lib/auth";
import {
  validateRegistration,
  validateLogin,
  validateMarketCreation,
  validateBet,
} from "../lib/validation";

type JwtSigner = {
  sign: (payload: AuthTokenPayload) => Promise<string>;
};

const DEFAULT_MARKET_CLOSES_AT = "2027-01-01T00:00:00.000Z";

function pickWeightedOutcomeId(
  outcomes: Array<{ id: number }>,
  outcomeTotals: Map<number, number>,
): number {
  if (outcomes.length === 0) {
    throw new Error("Market has no outcomes");
  }

  const weightedTotal = outcomes.reduce(
    (sum, outcome) => sum + (outcomeTotals.get(outcome.id) ?? 0),
    0,
  );

  if (weightedTotal <= 0) {
    const randomIndex = Math.floor(Math.random() * outcomes.length);
    return outcomes[randomIndex]!.id;
  }

  const draw = Math.random() * weightedTotal;
  let cumulative = 0;

  for (const outcome of outcomes) {
    cumulative += outcomeTotals.get(outcome.id) ?? 0;
    if (draw < cumulative) {
      return outcome.id;
    }
  }

  return outcomes[outcomes.length - 1]!.id;
}

function calculateCurrentPayoutAmount(amount: number, outcomeTotalBets: number, totalMarketBets: number) {
  if (outcomeTotalBets <= 0 || totalMarketBets <= 0) {
    return 0;
  }

  return Number(((amount / outcomeTotalBets) * totalMarketBets).toFixed(2));
}

function calculateCashOutAmount(currentPayout: number, currentOdds: number) {
  const probabilityMultiplier = Math.max(0, currentOdds) / 100;
  const cashOutFactor = currentOdds > 90 ? 0.85 : currentOdds < 60 ? 0.5 : 0.7;

  return Number((Math.max(0, currentPayout) * probabilityMultiplier * cashOutFactor).toFixed(2));
}

function isCashedOutBet(bet: { cashedOutAt?: Date | null }) {
  return bet.cashedOutAt != null;
}

function getActiveBetsOnly(bets: any[]) {
  return bets.filter((bet) => !isCashedOutBet(bet));
}

async function resolveMarketWithWinningOutcome(tx: any, marketId: number, winningOutcomeId: number) {
  const market = await tx.query.marketsTable.findFirst({
    where: eq(marketsTable.id, marketId),
    with: {
      outcomes: {
        orderBy: (outcomes: any, { asc }: any) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    throw new Error("Market not found");
  }

  if (market.status !== "active") {
    return { resolved: false, message: "Only active markets can be resolved" };
  }

  const winningOutcome = market.outcomes.find((outcome: any) => outcome.id === winningOutcomeId);
  if (!winningOutcome) {
    throw new Error("Winning outcome does not belong to market");
  }

  const allBets = await tx.select().from(betsTable).where(eq(betsTable.marketId, marketId));
  const activeBets = getActiveBetsOnly(allBets);

  if (activeBets.length === 0) {
    await tx
      .update(marketsTable)
      .set({ status: "resolved", resolvedOutcomeId: winningOutcomeId })
      .where(eq(marketsTable.id, marketId));

    return { resolved: true, message: "Market resolved with no bets." };
  }

  const totalPool = activeBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const winningBets = activeBets.filter((bet: any) => bet.outcomeId === winningOutcomeId);
  const winningPool = winningBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

  if (winningPool > 0) {
    for (const bet of winningBets) {
      const reward = (bet.amount / winningPool) * totalPool;
      const winner = await tx.query.usersTable.findFirst({ where: eq(usersTable.id, bet.userId) });

      if (!winner) {
        continue;
      }

      await tx
        .update(usersTable)
        .set({ balance: (winner.balance || 0) + reward })
        .where(eq(usersTable.id, bet.userId));
    }
  }

  await tx
    .update(marketsTable)
    .set({ status: "resolved", resolvedOutcomeId: winningOutcomeId })
    .where(eq(marketsTable.id, marketId));

  return { resolved: true, message: "Market resolved and payouts distributed!" };
}

export async function resolveExpiredMarketsAutomatically() {
  const db: DbType = getDb();
  const now = Date.now();
  const activeMarkets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, "active"),
    with: {
      outcomes: {
        orderBy: (outcomes: any, { asc }: any) => asc(outcomes.position),
      },
    },
  });

  const expiredMarkets = activeMarkets.filter((market: any) => {
    const closesAt = market.closesAt ?? new Date(DEFAULT_MARKET_CLOSES_AT);
    return closesAt.getTime() <= now;
  });

  let resolvedCount = 0;

  for (const market of expiredMarkets) {
    try {
      const marketBets = getActiveBetsOnly(
        await db.select().from(betsTable).where(eq(betsTable.marketId, market.id)),
      );
      const outcomeTotals = new Map<number, number>();

      for (const bet of marketBets) {
        outcomeTotals.set(bet.outcomeId, (outcomeTotals.get(bet.outcomeId) ?? 0) + bet.amount);
      }

      const winningOutcomeId = pickWeightedOutcomeId(market.outcomes, outcomeTotals);
      const result = await db.transaction((tx) =>
        resolveMarketWithWinningOutcome(tx, market.id, winningOutcomeId),
      );

      if (result.resolved) {
        resolvedCount += 1;
      }
    } catch (error) {
      console.error(`[auto-resolve] Failed to resolve market ${market.id}:`, error);
    }
  }

  return {
    checked: expiredMarkets.length,
    resolved: resolvedCount,
  };
}

export async function handleRegister({
  body,
  jwt,
  set,
}: {
  body: { username: string; email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { username, email, password } = body;
  const errors = validateRegistration(username, email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const db: DbType = getDb();
  const existingUser = await db.query.usersTable.findFirst({
    where: (users, { or, eq: eqOp }) => or(eqOp(users.email, email), eqOp(users.username, username)),
  });

  if (existingUser) {
    set.status = 409;
    return { errors: [{ field: "email", message: "User already exists" }] };
  }

  const passwordHash = await hashPassword(password);

  const newUser = await db.insert(usersTable).values({ username, email, passwordHash }).returning();

  if (!newUser[0]) {
    set.status = 500;
    return { errors: [{ field: "general", message: "Failed to create user" }] };
  }

  const token = await jwt.sign({ userId: newUser[0].id });

  set.status = 201;
  return {
    id: newUser[0].id,
    username: newUser[0].username,
    email: newUser[0].email,
    token,
  };
}

export async function handleLogin({
  body,
  jwt,
  set,
}: {
  body: { email: string; password: string };
  jwt: JwtSigner;
  set: { status: number };
}) {
  const { email, password } = body;
  const errors = validateLogin(email, password);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const db: DbType = getDb();
  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    set.status = 401;
    return { error: "Invalid email or password" };
  }

  const token = await jwt.sign({ userId: user.id });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    token,
  };
}

export async function handleGetApiKeyStatus({ user }: { user: any }) {
  return {
    hasApiKey: Boolean(user.apiKey),
    preview: maskApiKey(user.apiKey),
  };
}

export async function handleGetWalletSummary({ user, set }: { user: any; set: { status: number } }) {
  const db: DbType = getDb();
  const freshUser = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, user.id),
  });

  if (!freshUser) {
    set.status = 404;
    return { error: "User not found" };
  }

  return {
    balance: freshUser.balance,
  };
}

export async function handleAdminDepositWallet({
  user,
  body,
  set,
}: {
  user: any;
  body: { amount: number };
  set: { status: number };
}) {
  const db: DbType = getDb();
  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });

  if (!currentUser) {
    set.status = 404;
    return { error: "User not found" };
  }

  if (currentUser.role !== "ADMIN") {
    set.status = 403;
    return { error: "Only available to admins" };
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    set.status = 400;
    return { error: "Amount must be greater than 0" };
  }

  const nextBalance = Number(((currentUser.balance || 0) + amount).toFixed(2));

  await db
    .update(usersTable)
    .set({ balance: nextBalance, updatedAt: new Date() } as any)
    .where(eq(usersTable.id, user.id));

  return {
    balance: nextBalance,
    message: "Balance added",
  };
}

export async function handleGenerateApiKey({ user, set }: { user: any; set: { status: number } }) {
  const db: DbType = getDb();
  const apiKey = generateApiKey();

  await db
    .update(usersTable)
    .set({ apiKey, updatedAt: new Date() } as any)
    .where(eq(usersTable.id, user.id));

  set.status = 201;
  return {
    apiKey,
    preview: maskApiKey(apiKey),
  };
}

export async function handleRevokeApiKey({ user }: { user: any }) {
  const db: DbType = getDb();

  await db
    .update(usersTable)
    .set({ apiKey: null, updatedAt: new Date() } as any)
    .where(eq(usersTable.id, user.id));

  return {
    success: true,
  };
}

export async function handleCreateMarket({
  body,
  set,
  user,
}: {
  body: { title: string; description?: string; outcomes: string[]; closesAt?: string };
  set: any;
  user: any;
}) {
  const { title, description, outcomes, closesAt } = body;
  const normalizedClosesAt = closesAt || DEFAULT_MARKET_CLOSES_AT;
  const errors = validateMarketCreation(title, description || "", outcomes, normalizedClosesAt);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const db: DbType = getDb();

  const market = await db
    .insert(marketsTable)
    .values({
      title,
      description: description || null,
      createdBy: user.id,
      closesAt: new Date(normalizedClosesAt),
    })
    .returning();

  if (!market[0]) {
    set.status = 500;
    return { errors: [{ field: "general", message: "Failed to create market" }] };
  }

  const marketRecord = market[0];
  const outcomeIds = await db
    .insert(marketOutcomesTable)
    .values(
      outcomes.map((outcomeTitle: string, index: number) => ({
        marketId: marketRecord.id,
        title: outcomeTitle,
        position: index,
      })),
    )
    .returning();

  set.status = 201;
  return {
    id: marketRecord.id,
    title: marketRecord.title,
    description: marketRecord.description,
    status: marketRecord.status,
    closesAt: marketRecord.closesAt,
    outcomes: outcomeIds,
  };
}

export async function handleListMarkets({ query }: { query: { status?: string; page?: number; sortBy?: string; search?: string } }) {
  const statusFilter = (query.status || "active") as "active" | "resolved";
  const sortBy = query.sortBy || "newest";
  const normalizedSearch = query.search?.trim().toLowerCase() || "";
  const page = Math.max(1, Number(query.page || 1));
  const limit = 20;
  const offset = (page - 1) * limit;
  const db: DbType = getDb();

  const allMarkets = await db.query.marketsTable.findMany({
    where: eq(marketsTable.status, statusFilter),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes: any, { asc }: any) => asc(outcomes.position),
      },
    },
  });

  const filteredMarkets = normalizedSearch
    ? allMarkets.filter((market: any) => {
      const searchFields = [
        market.title,
        market.description,
        market.creator?.username,
        ...market.outcomes.map((outcome: any) => outcome.title),
      ]
        .filter(Boolean)
        .map((value: string) => value.toLowerCase());

      return searchFields.some((value: string) => value.includes(normalizedSearch));
    })
    : allMarkets;

  const totalCount = filteredMarkets.length;

  const enrichedMarkets = await Promise.all(
    filteredMarkets.map(async (market: any) => {
      const betsPerOutcome = await Promise.all(
        market.outcomes.map(async (outcome: any) => {
          const totalBets = await db
            .select()
            .from(betsTable)
            .where(and(eq(betsTable.outcomeId, outcome.id), isNull(betsTable.cashedOutAt)));

          const totalAmount = totalBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
          return { outcomeId: outcome.id, totalBets: totalAmount };
        }),
      );

      const betEntries = await db
        .select()
        .from(betsTable)
        .where(and(eq(betsTable.marketId, market.id), isNull(betsTable.cashedOutAt)));
      const participantsCount = new Set(betEntries.map((b: any) => b.userId)).size;
      const totalMarketBets = betsPerOutcome.reduce((sum: number, b: any) => sum + b.totalBets, 0);

      return {
        id: market.id,
        title: market.title,
        status: market.status,
        creator: market.creator?.username,
        createdAt: market.createdAt,
        closesAt: market.closesAt,
        participantsCount,
        outcomes: market.outcomes.map((outcome: any) => {
          const outcomeBets =
            betsPerOutcome.find((b: any) => b.outcomeId === outcome.id)?.totalBets || 0;
          const odds =
            totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

          return {
            id: outcome.id,
            title: outcome.title,
            odds,
            totalBets: outcomeBets,
          };
        }),
        totalMarketBets,
      };
    }),
  );

  // Sorting first 20
  if (sortBy === "pool") {
    enrichedMarkets.sort((a: any, b: any) => b.totalMarketBets - a.totalMarketBets);
  } else if (sortBy === "participants") {
    enrichedMarkets.sort((a: any, b: any) => b.participantsCount - a.participantsCount);
  } else if (sortBy === "closingSoon") {
    enrichedMarkets.sort((a: any, b: any) => {
      const aClosesAt = a.closesAt ? new Date(a.closesAt).getTime() : Number.POSITIVE_INFINITY;
      const bClosesAt = b.closesAt ? new Date(b.closesAt).getTime() : Number.POSITIVE_INFINITY;
      return aClosesAt - bClosesAt;
    });
  } else if (sortBy === "oldest") {
    enrichedMarkets.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else {
    // Default: Newest first
    enrichedMarkets.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const pagedMarkets = enrichedMarkets.slice(offset, offset + limit);

  return {
    markets: pagedMarkets,
    totalCount,
    page,
    limit,
  };
}

export async function handleGetMarket({
  params,
  set,
}: {
  params: { id: number };
  set: any;
}) {
  const db: DbType = getDb();
  const market = await db.query.marketsTable.findFirst({
    where: eq(marketsTable.id, params.id),
    with: {
      creator: {
        columns: { username: true },
      },
      outcomes: {
        orderBy: (outcomes: any, { asc }: any) => asc(outcomes.position),
      },
    },
  });

  if (!market) {
    set.status = 404;
    return { error: "Market not found" };
  }

  const betsPerOutcome = await Promise.all(
    market.outcomes.map(async (outcome: any) => {
      const totalBets = await db
        .select()
        .from(betsTable)
        .where(and(eq(betsTable.outcomeId, outcome.id), isNull(betsTable.cashedOutAt)));

      const totalAmount = totalBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
      return { outcomeId: outcome.id, totalBets: totalAmount };
    }),
  );

  const totalMarketBets = betsPerOutcome.reduce((sum: number, b: any) => sum + b.totalBets, 0);

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    status: market.status,
    creator: market.creator?.username,
    closesAt: market.closesAt,
    outcomes: market.outcomes.map((outcome: any) => {
      const outcomeBets = betsPerOutcome.find((b: any) => b.outcomeId === outcome.id)?.totalBets || 0;
      const odds =
        totalMarketBets > 0 ? Number(((outcomeBets / totalMarketBets) * 100).toFixed(2)) : 0;

      return {
        id: outcome.id,
        title: outcome.title,
        odds,
        totalBets: outcomeBets,
      };
    }),
    totalMarketBets,
  };
}


export async function handlePlaceBet({
  params,
  body,
  set,
  user,
}: {
  params: { id: number };
  body: { outcomeId: number; amount: number };
  set: any;
  user: any;
}) {
  const marketId = params.id;
  const { outcomeId, amount } = body;
  const errors = validateBet(amount);

  if (errors.length > 0) {
    set.status = 400;
    return { errors };
  }

  const db: DbType = getDb();

  try {
    const result = await db.transaction(async (tx) => {
      // Step 1: Check market and outcome
      const market = await tx.query.marketsTable.findFirst({ where: eq(marketsTable.id, marketId) });
      if (!market || market.status !== "active") {
        set.status = 400;
        throw new Error("Market is not active or not found");
      }

      const marketClosesAt = market.closesAt ?? new Date(DEFAULT_MARKET_CLOSES_AT);
      if (marketClosesAt.getTime() <= Date.now()) {
        set.status = 400;
        throw new Error("Betting for this market has closed");
      }

      const outcome = await tx.query.marketOutcomesTable.findFirst({ where: and(eq(marketOutcomesTable.id, outcomeId), eq(marketOutcomesTable.marketId, marketId)) });
      if (!outcome) {
        set.status = 404;
        throw new Error("Outcome not found");
      }

      // Step 2: Check user balance (CORRECTED QUERY)
      const userResult = await tx.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
      const currentUser = userResult[0] as any; // Get the first user from the result array

      if (!currentUser || currentUser.balance < amount) {
        set.status = 400;
        throw new Error("Insufficient balance or user not found");
      }

      // Step 3: Deduct balance AND place bet
      await tx.update(usersTable).set({ balance: currentUser.balance - amount } as any).where(eq(usersTable.id, user.id));
      const bet = await tx.insert(betsTable).values({ userId: user.id, marketId, outcomeId, amount: Number(amount) }).returning();

      return bet[0];
    });

    set.status = 201;
    return result;

  } catch (error: any) {
    return { error: error.message };
  }
}

export async function handleCashOutBet({
  params,
  user,
  set,
}: {
  params: { id: number; betId: number };
  user: any;
  set: any;
}) {
  const db: DbType = getDb();
  const marketId = params.id;
  const betId = params.betId;

  try {
    return await db.transaction(async (tx) => {
      const market = await tx.query.marketsTable.findFirst({ where: eq(marketsTable.id, marketId) });
      if (!market || market.status !== "active") {
        set.status = 400;
        throw new Error("Only active markets support cash out");
      }

      const marketClosesAt = market.closesAt ?? new Date(DEFAULT_MARKET_CLOSES_AT);
      if (marketClosesAt.getTime() <= Date.now()) {
        set.status = 400;
        throw new Error("Cash out is no longer available for this market");
      }

      const bet = await tx.query.betsTable.findFirst({
        where: and(eq(betsTable.id, betId), eq(betsTable.marketId, marketId), eq(betsTable.userId, user.id)),
      });

      if (!bet) {
        set.status = 404;
        throw new Error("Bet not found");
      }

      if (bet.cashedOutAt) {
        set.status = 400;
        throw new Error("Bet has already been cashed out");
      }

      const activeBets = getActiveBetsOnly(
        await tx.select().from(betsTable).where(eq(betsTable.marketId, marketId)),
      );
      const totalMarketBets = activeBets.reduce((sum: number, activeBet: any) => sum + activeBet.amount, 0);
      const outcomeTotalBets = activeBets
        .filter((activeBet: any) => activeBet.outcomeId === bet.outcomeId)
        .reduce((sum: number, activeBet: any) => sum + activeBet.amount, 0);
      const currentOdds =
        totalMarketBets > 0 ? Number(((outcomeTotalBets / totalMarketBets) * 100).toFixed(2)) : 0;
      const currentPayout = calculateCurrentPayoutAmount(bet.amount, outcomeTotalBets, totalMarketBets);
      const cashOutAmount = calculateCashOutAmount(currentPayout, currentOdds);

      const currentUser = await tx.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
      if (!currentUser) {
        set.status = 404;
        throw new Error("User not found");
      }

      await tx
        .update(betsTable)
        .set({ cashedOutAt: new Date(), cashedOutAmount: cashOutAmount } as any)
        .where(eq(betsTable.id, betId));

      await tx
        .update(usersTable)
        .set({ balance: Number(((currentUser.balance || 0) + cashOutAmount).toFixed(2)), updatedAt: new Date() } as any)
        .where(eq(usersTable.id, user.id));

      return {
        betId,
        cashOutAmount,
        currentPayout,
        message: "Bet cashed out",
      };
    });
  } catch (error: any) {
    if (!set.status || set.status < 400) {
      set.status = 500;
    }

    return { error: error.message };
  }
}


export const handleLeaderboard = async () => {
  const db: DbType = getDb();
  const [allUsers, resolvedBets] = await Promise.all([
    db.query.usersTable.findMany({
      columns: {
        id: true,
        username: true,
      },
    }),
    db.query.betsTable.findMany({
      with: {
        market: {
          columns: {
            status: true,
            resolvedOutcomeId: true,
          },
        },
      },
    }),
  ]);

  const winningsByUser = new Map<number, number>();
  const winStatsByUser = new Map<number, { wins: number; totalResolved: number }>();
  const betsByMarket = new Map<number, typeof resolvedBets>();

  for (const bet of resolvedBets) {
    if (bet.market.status !== "resolved" || bet.market.resolvedOutcomeId == null || bet.cashedOutAt != null) {
      continue;
    }

    const currentStats = winStatsByUser.get(bet.userId) ?? { wins: 0, totalResolved: 0 };
    currentStats.totalResolved += 1;
    if (bet.outcomeId === bet.market.resolvedOutcomeId) {
      currentStats.wins += 1;
    }
    winStatsByUser.set(bet.userId, currentStats);

    const marketBets = betsByMarket.get(bet.marketId);
    if (marketBets) {
      marketBets.push(bet);
    } else {
      betsByMarket.set(bet.marketId, [bet]);
    }
  }

  for (const marketBets of betsByMarket.values()) {
    const resolvedOutcomeId = marketBets[0]?.market.resolvedOutcomeId;
    if (resolvedOutcomeId == null) {
      continue;
    }

    const totalPool = marketBets.reduce((sum, bet) => sum + bet.amount, 0);
    const winningBets = marketBets.filter((bet) => bet.outcomeId === resolvedOutcomeId);
    const winningPool = winningBets.reduce((sum, bet) => sum + bet.amount, 0);

    if (winningPool <= 0) {
      continue;
    }

    for (const bet of winningBets) {
      const payout = (bet.amount / winningPool) * totalPool;
      winningsByUser.set(bet.userId, (winningsByUser.get(bet.userId) ?? 0) + payout);
    }
  }

  const topUsers = allUsers
    .map((user) => {
      const stats = winStatsByUser.get(user.id);
      const winRate = stats && stats.totalResolved > 0
        ? Number(((stats.wins / stats.totalResolved) * 100).toFixed(1))
        : 0;

      return {
        username: user.username,
        winnings: winningsByUser.get(user.id) ?? 0,
        winRate,
      };
    })
    .sort((a, b) => b.winnings - a.winnings)
    .slice(0, 20);

  return topUsers;
};

export const handleGetUserBets = async ({ user }: { user: any }) => {
  const db: DbType = getDb();
  const userBets = await db.query.betsTable.findMany({
    where: (bets: any, { eq }: any) => eq(bets.userId, user.id),
    with: {
      market: true,
      outcome: true,
    },
    orderBy: (bets: any, { desc }: any) => [desc(bets.createdAt)],
  });

  const marketPools = new Map<
    number,
    {
      totalMarketBets: number;
      outcomeTotals: Map<number, number>;
    }
  >();

  await Promise.all(
    Array.from(new Set(userBets.map((bet) => bet.marketId))).map(async (marketId) => {
      const marketBets = await db.select().from(betsTable).where(eq(betsTable.marketId, marketId));
      const activeMarketBets = getActiveBetsOnly(marketBets);
      const totalMarketBets = activeMarketBets.reduce((sum, bet) => sum + bet.amount, 0);
      const outcomeTotals = new Map<number, number>();

      for (const marketBet of activeMarketBets) {
        outcomeTotals.set(marketBet.outcomeId, (outcomeTotals.get(marketBet.outcomeId) ?? 0) + marketBet.amount);
      }

      marketPools.set(marketId, {
        totalMarketBets,
        outcomeTotals,
      });
    }),
  );

  return userBets.map((bet) => {
    const marketPool = marketPools.get(bet.marketId);
    const totalMarketBets = marketPool?.totalMarketBets ?? 0;
    const outcomeTotalBets = marketPool?.outcomeTotals.get(bet.outcomeId) ?? 0;
    const currentOdds =
      totalMarketBets > 0 ? Number(((outcomeTotalBets / totalMarketBets) * 100).toFixed(2)) : 0;
    const currentPayout = calculateCurrentPayoutAmount(bet.amount, outcomeTotalBets, totalMarketBets);
    const currentNetWin = Number((currentPayout - bet.amount).toFixed(2));
    const cashOutValue = !isCashedOutBet(bet) && bet.market.status === "active"
      ? calculateCashOutAmount(currentPayout, currentOdds)
      : 0;

    return {
      ...bet,
      totalMarketBets,
      outcomeTotalBets,
      currentOdds,
      currentPayout,
      currentNetWin,
      isCashedOut: isCashedOutBet(bet),
      cashOutValue,
    };
  });
};
export async function handleResolveMarket({ params, body, user, set }: any) {
  const db: DbType = getDb();
  const marketId = params.id;
  const { winningOutcomeId } = body;
  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
  if (currentUser?.role !== "ADMIN") {
    set.status = 403;
    return { error: "Only admins can resolve markets " };

  }
  try {
    const result = await db.transaction((tx: any) =>
      resolveMarketWithWinningOutcome(tx, marketId, winningOutcomeId),
    );

    if (!result.resolved) {
      set.status = 400;
      return { error: result.message };
    }

    return { message: result.message };
  } catch (e: any) {
    if (e.message === "Market not found") {
      set.status = 404;
    } else if (e.message === "Winning outcome does not belong to market") {
      set.status = 400;
    } else {
      set.status = 500;
    }

    return { error: e.message };
  }
}

export async function handleArchiveMarket({ params, user, set }: any) {
  const db: DbType = getDb();
  const marketId = params.id;

  const currentUser = await db.query.usersTable.findFirst({ where: eq(usersTable.id, user.id) });
  if (currentUser?.role !== "ADMIN") {
    set.status = 403;
    return { error: "Only admins can archive markets" };
  }

  try {
    return await db.transaction(async (tx: any) => {
      const market = await tx.query.marketsTable.findFirst({ where: eq(marketsTable.id, marketId) });

      if (!market) {
        set.status = 404;
        throw new Error("Market not found");
      }

      if (market.status !== "active") {
        set.status = 400;
        throw new Error("Only active markets can be archived");
      }

      const allBets = getActiveBetsOnly(
        await tx.select().from(betsTable).where(eq(betsTable.marketId, marketId)),
      );

      // Sum refunds per user, then apply once per user.
      const refundsByUser = new Map<number, number>();
      for (const bet of allBets) {
        const current = refundsByUser.get(bet.userId) || 0;
        refundsByUser.set(bet.userId, current + bet.amount);
      }

      for (const [userId, refundAmount] of refundsByUser.entries()) {
        const bettor = await tx.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
        if (!bettor) continue;

        await tx
          .update(usersTable)
          .set({ balance: (bettor.balance || 0) + refundAmount })
          .where(eq(usersTable.id, userId));
      }

      await tx
        .update(marketsTable)
        .set({ status: "archived", resolvedOutcomeId: null })
        .where(eq(marketsTable.id, marketId));

      const totalRefunded = allBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);

      return {
        message: "Market archived and all bets refunded.",
        refundedBets: allBets.length,
        refundedUsers: refundsByUser.size,
        totalRefunded,
      };
    });
  } catch (e: any) {
    if (!set.status || set.status < 400) {
      set.status = 500;
    }
    return { error: e.message };
  }
}


