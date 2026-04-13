const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001";

// Types
export interface Market {
  id: number;
  title: string;
  description?: string;
  status: "active" | "resolved" | "archived";
  creator?: string;
  outcomes: MarketOutcome[];
  totalMarketBets: number;
  participantsCount?: number;
  closesAt?: string | null;
}

export interface MarketOutcome {
  id: number;
  title: string;
  odds: number;
  totalBets: number;
}

export interface MarketsListResponse {
  markets: Market[];
  totalCount: number;
  page: number;
  limit: number;
}

export type MarketSortOption = "newest" | "oldest" | "pool" | "participants" | "closingSoon";

export interface User {
  id: number;
  username: string;
  email: string;
  token: string;
  role?: string;
}

export interface Bet {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  createdAt: string;
}

export interface UserBetHistoryItem {
  id: number;
  userId: number;
  marketId: number;
  outcomeId: number;
  amount: number;
  cashedOutAt?: string | null;
  cashedOutAmount?: number | null;
  isCashedOut?: boolean;
  cashOutValue?: number;
  createdAt: string;
  totalMarketBets: number;
  outcomeTotalBets: number;
  currentOdds: number;
  currentPayout: number;
  currentNetWin: number;
  market: {
    id: number;
    title: string;
    status: "active" | "resolved" | "archived";
    resolvedOutcomeId: number | null;
  };
  outcome: {
    id: number;
    title: string;
  };
}

export interface ApiKeyStatus {
  hasApiKey: boolean;
  preview: string | null;
}

export interface GeneratedApiKeyResponse {
  apiKey: string;
  preview: string;
}

export interface WalletSummary {
  balance: number;
}

export interface WalletDepositResponse {
  balance: number;
  message: string;
}

export interface CashOutResponse {
  betId: number;
  cashOutAmount: number;
  currentPayout: number;
  message: string;
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAuthHeader() {
    const token = localStorage.getItem("auth_token");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeader = this.getAuthHeader();
    const headers = {
      "Content-Type": "application/json",
      ...(authHeader.Authorization && { Authorization: authHeader.Authorization }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      // If there are validation errors, throw them
      if (data.errors && Array.isArray(data.errors)) {
        const errorMessage = data.errors.map((e: any) => `${e.field}: ${e.message}`).join(", ");
        throw new Error(errorMessage);
      }
      throw new Error(data.error || `API Error: ${response.status}`);
    }

    return data ?? {};
  }

  // Auth endpoints
  async register(username: string, email: string, password: string): Promise<User> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string): Promise<User> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getApiKeyStatus(): Promise<ApiKeyStatus> {
    return this.request("/api/auth/api-key", {
      cache: "no-store",
    });
  }

  async getWalletSummary(): Promise<WalletSummary> {
    return this.request("/api/auth/wallet", {
      cache: "no-store",
    });
  }

  async depositWalletBalance(amount: number): Promise<WalletDepositResponse> {
    return this.request("/api/auth/wallet/deposit", {
      method: "POST",
      body: JSON.stringify({ amount }),
    });
  }

  async generateApiKey(): Promise<GeneratedApiKeyResponse> {
    return this.request("/api/auth/api-key", {
      method: "POST",
    });
  }

  async revokeApiKey(): Promise<{ success: boolean }> {
    return this.request("/api/auth/api-key", {
      method: "DELETE",
    });
  }

  // Markets endpoints
  async listMarkets(
    status: "active" | "resolved" = "active",
    page = 1,
    sortBy: MarketSortOption = "newest",
    search = "",
  ): Promise<MarketsListResponse> {
    const params = new URLSearchParams({
      status,
      page: page.toString(),
      sortBy,
    });

    if (search.trim()) {
      params.set("search", search.trim());
    }

    return this.request(`/api/markets?${params.toString()}`, {
      cache: "no-store",
    });
  }

  async getMarket(id: number): Promise<Market> {
    return this.request(`/api/markets/${id}`, {
      cache: "no-store",
    });
  }

  async createMarket(
    title: string,
    description: string,
    outcomes: string[],
    closesAt?: string,
  ): Promise<Market> {
    return this.request("/api/markets", {
      method: "POST",
      body: JSON.stringify({ title, description, outcomes, closesAt }),
    });
  }

  async resolveMarket(marketId: number, winningOutcomeId: number): Promise<any> {
    return this.request(`/api/markets/${marketId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ winningOutcomeId }),
    });
  }

  async archiveMarket(marketId: number): Promise<any> {
    return this.request(`/api/markets/${marketId}/archive`, {
      method: "POST",
    });
  }

  async getMyBets(): Promise<UserBetHistoryItem[]> {
    return this.request(`/api/markets/my-bets?ts=${Date.now()}`, {
      cache: "no-store",
    });
  }

  // Bets endpoints
  async placeBet(marketId: number, outcomeId: number, amount: number): Promise<Bet> {
    return this.request(`/api/markets/${marketId}/bets`, {
      method: "POST",
      body: JSON.stringify({ outcomeId, amount }),
    });
  }

  async cashOutBet(marketId: number, betId: number): Promise<CashOutResponse> {
    return this.request(`/api/markets/${marketId}/bets/${betId}/cash-out`, {
      method: "POST",
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
