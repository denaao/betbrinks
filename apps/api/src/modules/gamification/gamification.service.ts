import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

// XP required for each level: level 1 = 0, level 2 = 100, level 3 = 250, etc.
const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  500,   // Level 4
  1000,  // Level 5
  1750,  // Level 6
  2750,  // Level 7
  4000,  // Level 8
  5500,  // Level 9
  7500,  // Level 10
  10000, // Level 11
  13000, // Level 12
  16500, // Level 13
  20500, // Level 14
  25000, // Level 15
];

// XP rewards for actions
const XP_REWARDS = {
  BET_PLACED: 10,
  BET_WON: 25,
  DAILY_LOGIN: 5,
  DAILY_BONUS: 5,
  FIRST_BET: 50,
  PROFILE_COMPLETE: 30,
};

// Achievement definitions
const ACHIEVEMENT_KEYS = {
  FIRST_BET: 'first_bet',
  LUCKY_3: 'lucky_3',         // Win 3 bets in a row
  FAITHFUL_7: 'faithful_7',   // Login 7 days in a row
  HIGH_ROLLER: 'high_roller', // Place a bet of 5000+ points
  JACKPOT: 'jackpot',         // Win 10000+ points in a single bet
  CENTURION: 'centurion',     // Place 100 total bets
  SHARP_EYE: 'sharp_eye',    // Win rate above 60% with 20+ bets
  DIAMOND_HAND: 'diamond_hand', // Purchase diamonds
};

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // ─── Grant XP ──────────────────────────────────────────────────────────

  async grantXp(userId: number, action: keyof typeof XP_REWARDS) {
    const xpAmount = XP_REWARDS[action];
    if (!xpAmount) return;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: xpAmount } },
    });

    // Check level up
    const newLevel = this.calculateLevel(user.xp);
    if (newLevel > user.level) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { level: newLevel },
      });

      this.logger.log(`User ${userId} leveled up to ${newLevel}!`);

      await this.notifications.sendToUser(userId, {
        title: 'Level Up!',
        body: `Parabens! Voce subiu para o nivel ${newLevel}!`,
        data: { type: 'level_up', level: newLevel.toString() },
      });
    }

    return { xpGranted: xpAmount, totalXp: user.xp, level: newLevel || user.level };
  }

  // ─── Check Achievements ────────────────────────────────────────────────

  async checkAchievements(userId: number, trigger: string) {
    const unlockedIds = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievement: { select: { key: true } } },
    });
    const unlocked = new Set(unlockedIds.map((u) => u.achievement.key));

    const newAchievements: string[] = [];

    switch (trigger) {
      case 'bet_placed':
        await this.checkFirstBet(userId, unlocked, newAchievements);
        await this.checkHighRoller(userId, unlocked, newAchievements);
        await this.checkCenturion(userId, unlocked, newAchievements);
        break;

      case 'bet_won':
        await this.checkLucky3(userId, unlocked, newAchievements);
        await this.checkJackpot(userId, unlocked, newAchievements);
        await this.checkSharpEye(userId, unlocked, newAchievements);
        break;

      case 'daily_login':
        await this.checkFaithful7(userId, unlocked, newAchievements);
        break;

      case 'diamond_purchase':
        await this.checkDiamondHand(userId, unlocked, newAchievements);
        break;
    }

    return newAchievements;
  }

  // ─── Get User Achievements ─────────────────────────────────────────────

  async getUserAchievements(userId: number) {
    const all = await this.prisma.achievement.findMany({
      include: {
        users: {
          where: { userId },
          select: { unlockedAt: true },
        },
      },
    });

    return all.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      description: a.description,
      xpReward: a.xpReward,
      pointReward: a.pointReward,
      iconUrl: a.iconUrl,
      unlocked: a.users.length > 0,
      unlockedAt: a.users[0]?.unlockedAt ?? null,
    }));
  }

  // ─── Get User Level Info ───────────────────────────────────────────────

  async getUserLevelInfo(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { level: true, xp: true },
    });

    if (!user) return null;

    const currentThreshold = LEVEL_THRESHOLDS[user.level - 1] || 0;
    const nextThreshold = LEVEL_THRESHOLDS[user.level] || currentThreshold + 5000;
    const xpInLevel = user.xp - currentThreshold;
    const xpNeeded = nextThreshold - currentThreshold;

    return {
      level: user.level,
      xp: user.xp,
      xpInLevel,
      xpNeeded,
      progress: xpNeeded > 0 ? Math.min(xpInLevel / xpNeeded, 1) : 1,
      nextLevel: user.level < 15 ? user.level + 1 : null,
    };
  }

  // ─── Private: Level Calculation ────────────────────────────────────────

  private calculateLevel(xp: number): number {
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
  }

  // ─── Private: Achievement Checks ───────────────────────────────────────

  private async unlockAchievement(userId: number, achievementKey: string, newList: string[]) {
    const achievement = await this.prisma.achievement.findUnique({
      where: { key: achievementKey },
    });
    if (!achievement) return;

    await this.prisma.userAchievement.create({
      data: { userId, achievementId: achievement.id },
    });

    // Credit rewards
    if (achievement.pointReward > 0) {
      await this.prisma.pointBalance.update({
        where: { userId },
        data: { points: { increment: achievement.pointReward } },
      });
    }

    if (achievement.xpReward > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xp: { increment: achievement.xpReward } },
      });
    }

    newList.push(achievementKey);
    await this.notifications.notifyAchievement(userId, achievement.name);
    this.logger.log(`User ${userId} unlocked achievement: ${achievement.name}`);
  }

  private async checkFirstBet(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.FIRST_BET)) return;
    const count = await this.prisma.bet.count({ where: { userId } });
    if (count >= 1) await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.FIRST_BET, newList);
  }

  private async checkHighRoller(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.HIGH_ROLLER)) return;
    const bigBet = await this.prisma.bet.findFirst({
      where: { userId, amount: { gte: 5000 } },
    });
    if (bigBet) await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.HIGH_ROLLER, newList);
  }

  private async checkCenturion(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.CENTURION)) return;
    const count = await this.prisma.bet.count({ where: { userId } });
    if (count >= 100) await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.CENTURION, newList);
  }

  private async checkLucky3(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.LUCKY_3)) return;
    const last3 = await this.prisma.bet.findMany({
      where: { userId, status: { in: ['WON', 'LOST'] } },
      orderBy: { settledAt: 'desc' },
      take: 3,
      select: { status: true },
    });
    if (last3.length === 3 && last3.every((b) => b.status === 'WON')) {
      await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.LUCKY_3, newList);
    }
  }

  private async checkJackpot(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.JACKPOT)) return;
    const bigWin = await this.prisma.bet.findFirst({
      where: { userId, status: 'WON', potentialReturn: { gte: 10000 } },
    });
    if (bigWin) await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.JACKPOT, newList);
  }

  private async checkSharpEye(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.SHARP_EYE)) return;
    const [won, total] = await Promise.all([
      this.prisma.bet.count({ where: { userId, status: 'WON' } }),
      this.prisma.bet.count({ where: { userId, status: { in: ['WON', 'LOST'] } } }),
    ]);
    if (total >= 20 && (won / total) > 0.6) {
      await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.SHARP_EYE, newList);
    }
  }

  private async checkFaithful7(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.FAITHFUL_7)) return;
    // Check Redis for consecutive login streak
    // Simplified: just check if user has logged in 7+ times
    const loginKey = `streak:${userId}`;
    const streak = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { lastLoginAt: true },
    });
    // In a full impl, track daily login streak in Redis
    // For now, skip complex logic
  }

  private async checkDiamondHand(userId: number, unlocked: Set<string>, newList: string[]) {
    if (unlocked.has(ACHIEVEMENT_KEYS.DIAMOND_HAND)) return;
    const purchase = await this.prisma.diamondPurchase.findFirst({
      where: { userId, status: 'VERIFIED' },
    });
    if (purchase) await this.unlockAchievement(userId, ACHIEVEMENT_KEYS.DIAMOND_HAND, newList);
  }
}
