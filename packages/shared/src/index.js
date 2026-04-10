"use strict";
// ─── Constants ─────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminRole = exports.UserRole = exports.DiamondPurchaseStatus = exports.TransactionType = exports.MarketType = exports.FixtureStatus = exports.BetStatus = exports.DIAMOND_PACKAGES = exports.REFERRAL_MIN_BETS = exports.REFERRAL_REWARD_POINTS = exports.MAX_DAILY_BETS = exports.DAILY_BONUS_POINTS = exports.DEFAULT_INITIAL_POINTS = void 0;
exports.DEFAULT_INITIAL_POINTS = 1000;
exports.DAILY_BONUS_POINTS = 50;
exports.MAX_DAILY_BETS = 50;
exports.REFERRAL_REWARD_POINTS = 500;
exports.REFERRAL_MIN_BETS = 5;
// ─── Diamond Packages ──────────────────────────────────────────────────────
exports.DIAMOND_PACKAGES = [
    { id: 'starter', name: 'Starter', diamonds: 100, points: 500, priceBRL: 4.90 },
    { id: 'popular', name: 'Popular', diamonds: 500, points: 3000, priceBRL: 19.90 },
    { id: 'pro', name: 'Pro', diamonds: 1200, points: 8000, priceBRL: 39.90 },
    { id: 'vip', name: 'VIP', diamonds: 3000, points: 25000, priceBRL: 79.90 },
];
// ─── Enums ─────────────────────────────────────────────────────────────────
var BetStatus;
(function (BetStatus) {
    BetStatus["PENDING"] = "PENDING";
    BetStatus["WON"] = "WON";
    BetStatus["LOST"] = "LOST";
    BetStatus["VOID"] = "VOID";
    BetStatus["CASHOUT"] = "CASHOUT";
})(BetStatus || (exports.BetStatus = BetStatus = {}));
var FixtureStatus;
(function (FixtureStatus) {
    FixtureStatus["NOT_STARTED"] = "NOT_STARTED";
    FixtureStatus["FIRST_HALF"] = "FIRST_HALF";
    FixtureStatus["HALFTIME"] = "HALFTIME";
    FixtureStatus["SECOND_HALF"] = "SECOND_HALF";
    FixtureStatus["EXTRA_TIME"] = "EXTRA_TIME";
    FixtureStatus["PENALTIES"] = "PENALTIES";
    FixtureStatus["FINISHED"] = "FINISHED";
    FixtureStatus["POSTPONED"] = "POSTPONED";
    FixtureStatus["CANCELLED"] = "CANCELLED";
})(FixtureStatus || (exports.FixtureStatus = FixtureStatus = {}));
var MarketType;
(function (MarketType) {
    MarketType["MATCH_WINNER"] = "MATCH_WINNER";
    MarketType["OVER_UNDER_25"] = "OVER_UNDER_25";
    MarketType["BOTH_TEAMS_SCORE"] = "BOTH_TEAMS_SCORE";
})(MarketType || (exports.MarketType = MarketType = {}));
var TransactionType;
(function (TransactionType) {
    TransactionType["INITIAL_BONUS"] = "INITIAL_BONUS";
    TransactionType["DAILY_BONUS"] = "DAILY_BONUS";
    TransactionType["BET_PLACED"] = "BET_PLACED";
    TransactionType["BET_WON"] = "BET_WON";
    TransactionType["BET_VOID"] = "BET_VOID";
    TransactionType["DIAMOND_CONVERSION"] = "DIAMOND_CONVERSION";
    TransactionType["REFERRAL_REWARD"] = "REFERRAL_REWARD";
    TransactionType["RANKING_REWARD"] = "RANKING_REWARD";
    TransactionType["ACHIEVEMENT_REWARD"] = "ACHIEVEMENT_REWARD";
    TransactionType["ADMIN_ADJUSTMENT"] = "ADMIN_ADJUSTMENT";
})(TransactionType || (exports.TransactionType = TransactionType = {}));
var DiamondPurchaseStatus;
(function (DiamondPurchaseStatus) {
    DiamondPurchaseStatus["PENDING"] = "PENDING";
    DiamondPurchaseStatus["VERIFIED"] = "VERIFIED";
    DiamondPurchaseStatus["FAILED"] = "FAILED";
    DiamondPurchaseStatus["REFUNDED"] = "REFUNDED";
})(DiamondPurchaseStatus || (exports.DiamondPurchaseStatus = DiamondPurchaseStatus = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "USER";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var AdminRole;
(function (AdminRole) {
    AdminRole["SUPER_ADMIN"] = "SUPER_ADMIN";
    AdminRole["FINANCIAL_MANAGER"] = "FINANCIAL_MANAGER";
    AdminRole["CRM_MANAGER"] = "CRM_MANAGER";
    AdminRole["ANALYST"] = "ANALYST";
    AdminRole["MODERATOR"] = "MODERATOR";
})(AdminRole || (exports.AdminRole = AdminRole = {}));
//# sourceMappingURL=index.js.map