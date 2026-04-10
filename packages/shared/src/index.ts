// ─── Constants ─────────────────────────────────────────────────────────────

export const DEFAULT_INITIAL_POINTS = 1000;
export const DAILY_BONUS_POINTS = 50;
export const MAX_DAILY_BETS = 50;
export const REFERRAL_REWARD_POINTS = 500;
export const REFERRAL_MIN_BETS = 5;

// ─── Diamond Packages ──────────────────────────────────────────────────────

export const DIAMOND_PACKAGES = [
  { id: 'starter', name: 'Starter', diamonds: 100, points: 500, priceBRL: 4.90 },
  { id: 'popular', name: 'Popular', diamonds: 500, points: 3000, priceBRL: 19.90 },
  { id: 'pro', name: 'Pro', diamonds: 1200, points: 8000, priceBRL: 39.90 },
  { id: 'vip', name: 'VIP', diamonds: 3000, points: 25000, priceBRL: 79.90 },
] as const;

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum BetStatus {
  PENDING = 'PENDING',
  WON = 'WON',
  LOST = 'LOST',
  VOID = 'VOID',
  CASHOUT = 'CASHOUT',
}

export enum FixtureStatus {
  NOT_STARTED = 'NOT_STARTED',
  FIRST_HALF = 'FIRST_HALF',
  HALFTIME = 'HALFTIME',
  SECOND_HALF = 'SECOND_HALF',
  EXTRA_TIME = 'EXTRA_TIME',
  PENALTIES = 'PENALTIES',
  FINISHED = 'FINISHED',
  POSTPONED = 'POSTPONED',
  CANCELLED = 'CANCELLED',
}

export enum MarketType {
  MATCH_WINNER = 'MATCH_WINNER',       // 1x2
  OVER_UNDER_25 = 'OVER_UNDER_25',     // Over/Under 2.5
  BOTH_TEAMS_SCORE = 'BOTH_TEAMS_SCORE', // BTTS
}

export enum TransactionType {
  INITIAL_BONUS = 'INITIAL_BONUS',
  DAILY_BONUS = 'DAILY_BONUS',
  BET_PLACED = 'BET_PLACED',
  BET_WON = 'BET_WON',
  BET_VOID = 'BET_VOID',
  DIAMOND_CONVERSION = 'DIAMOND_CONVERSION',
  REFERRAL_REWARD = 'REFERRAL_REWARD',
  RANKING_REWARD = 'RANKING_REWARD',
  ACHIEVEMENT_REWARD = 'ACHIEVEMENT_REWARD',
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',
}

export enum DiamondPurchaseStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FINANCIAL_MANAGER = 'FINANCIAL_MANAGER',
  CRM_MANAGER = 'CRM_MANAGER',
  ANALYST = 'ANALYST',
  MODERATOR = 'MODERATOR',
}

// ─── Types ─────────────────────────────────────────────────────────────────

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
