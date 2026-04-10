export declare const DEFAULT_INITIAL_POINTS = 1000;
export declare const DAILY_BONUS_POINTS = 50;
export declare const MAX_DAILY_BETS = 50;
export declare const REFERRAL_REWARD_POINTS = 500;
export declare const REFERRAL_MIN_BETS = 5;
export declare const DIAMOND_PACKAGES: readonly [{
    readonly id: "starter";
    readonly name: "Starter";
    readonly diamonds: 100;
    readonly points: 500;
    readonly priceBRL: 4.9;
}, {
    readonly id: "popular";
    readonly name: "Popular";
    readonly diamonds: 500;
    readonly points: 3000;
    readonly priceBRL: 19.9;
}, {
    readonly id: "pro";
    readonly name: "Pro";
    readonly diamonds: 1200;
    readonly points: 8000;
    readonly priceBRL: 39.9;
}, {
    readonly id: "vip";
    readonly name: "VIP";
    readonly diamonds: 3000;
    readonly points: 25000;
    readonly priceBRL: 79.9;
}];
export declare enum BetStatus {
    PENDING = "PENDING",
    WON = "WON",
    LOST = "LOST",
    VOID = "VOID",
    CASHOUT = "CASHOUT"
}
export declare enum FixtureStatus {
    NOT_STARTED = "NOT_STARTED",
    FIRST_HALF = "FIRST_HALF",
    HALFTIME = "HALFTIME",
    SECOND_HALF = "SECOND_HALF",
    EXTRA_TIME = "EXTRA_TIME",
    PENALTIES = "PENALTIES",
    FINISHED = "FINISHED",
    POSTPONED = "POSTPONED",
    CANCELLED = "CANCELLED"
}
export declare enum MarketType {
    MATCH_WINNER = "MATCH_WINNER",// 1x2
    OVER_UNDER_25 = "OVER_UNDER_25",// Over/Under 2.5
    BOTH_TEAMS_SCORE = "BOTH_TEAMS_SCORE"
}
export declare enum TransactionType {
    INITIAL_BONUS = "INITIAL_BONUS",
    DAILY_BONUS = "DAILY_BONUS",
    BET_PLACED = "BET_PLACED",
    BET_WON = "BET_WON",
    BET_VOID = "BET_VOID",
    DIAMOND_CONVERSION = "DIAMOND_CONVERSION",
    REFERRAL_REWARD = "REFERRAL_REWARD",
    RANKING_REWARD = "RANKING_REWARD",
    ACHIEVEMENT_REWARD = "ACHIEVEMENT_REWARD",
    ADMIN_ADJUSTMENT = "ADMIN_ADJUSTMENT"
}
export declare enum DiamondPurchaseStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    FAILED = "FAILED",
    REFUNDED = "REFUNDED"
}
export declare enum UserRole {
    USER = "USER",
    ADMIN = "ADMIN"
}
export declare enum AdminRole {
    SUPER_ADMIN = "SUPER_ADMIN",
    FINANCIAL_MANAGER = "FINANCIAL_MANAGER",
    CRM_MANAGER = "CRM_MANAGER",
    ANALYST = "ANALYST",
    MODERATOR = "MODERATOR"
}
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
export interface PointBalanceResponse {
    points: number;
    diamonds: number;
}
export interface FixtureResponse {
    id: number;
    apiFootballId: number;
    league: string;
    leagueLogo: string;
    homeTeam: string;
    homeLogo: string;
    awayTeam: string;
    awayLogo: string;
    startAt: string;
    status: FixtureStatus;
    scoreHome: number | null;
    scoreAway: number | null;
    markets: MarketResponse[];
}
export interface MarketResponse {
    id: number;
    type: MarketType;
    odds: OddResponse[];
}
export interface OddResponse {
    id: number;
    name: string;
    value: number;
}
export interface BetResponse {
    id: number;
    fixtureId: number;
    fixture: {
        homeTeam: string;
        awayTeam: string;
        league: string;
        startAt: string;
        status: FixtureStatus;
    };
    marketType: MarketType;
    oddName: string;
    oddValue: number;
    amount: number;
    potentialReturn: number;
    status: BetStatus;
    createdAt: string;
    settledAt: string | null;
}
export interface CreateBetRequest {
    fixtureId: number;
    marketId: number;
    oddId: number;
    amount: number;
}
export interface RegisterRequest {
    name: string;
    email: string;
    phone: string;
    password: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: {
        id: number;
        name: string;
        email: string;
        phone: string;
        avatarUrl: string | null;
        isVerified: boolean;
    };
}
//# sourceMappingURL=index.d.ts.map