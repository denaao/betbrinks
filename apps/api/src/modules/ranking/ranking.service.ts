import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

export interface RankingEntry {
  position: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  level: number;
  points: number;
  wonBets: number;
  winRate: number;
}

@Injectable()
export class RankingService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ─── Global Ranking (by total points) ──────────────────────────────────

  async getGlobalRanking(limit = 50): Promise<RankingEntry[]> {
    const cacheKey = 'ranking:global';
    const cached = await this.redis.getJson<RankingEntry[]>(cacheKey);
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: { isVerified: true },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        level: true,
        balance: { select: { points: true } },
      },
      orderBy: { balance: { points: 'desc' } },
      take: limit,
    });

    const ranking: RankingEntry[] = [];
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const stats = await this.getUserBetStats(u.id);
      ranking.push({
        position: i + 1,
        userId: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl,
        level: u.level,
        points: u.balance?.points ?? 0,
        wonBets: stats.won,
        winRate: stats.winRate,
      });
    }

    await this.redis.setJson(cacheKey, ranking, 600); // 10 min cache
    return ranking;
  }

  // ─── Weekly Ranking (by bets won this week) ────────────────────────────

  async getWeeklyRanking(limit = 50): Promise<RankingEntry[]> {
    const cacheKey = 'ranking:weekly';
    const cached = await this.redis.getJson<RankingEntry[]>(cacheKey);
    if (cached) return cached;

    const weekStart = this.getWeekStart();

    // Get users with most won bets this week
    const topBettors = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: {
        status: 'WON',
        settledAt: { gte: weekStart },
      },
      _count: { id: true },
      _sum: { potentialReturn: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const ranking: RankingEntry[] = [];
    for (let i = 0; i < topBettors.length; i++) {
      const entry = topBettors[i];
      const user = await this.prisma.user.findUnique({
        where: { id: entry.userId },
        select: { name: true, avatarUrl: true, level: true, balance: { select: { points: true } } },
      });

      if (!user) continue;

      const totalBets = await this.prisma.bet.count({
        where: { userId: entry.userId, settledAt: { gte: weekStart } },
      });

      ranking.push({
        position: i + 1,
        userId: entry.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        level: user.level,
        points: user.balance?.points ?? 0,
        wonBets: entry._count.id,
        winRate: totalBets > 0 ? Math.round((entry._count.id / totalBets) * 100) : 0,
      });
    }

    await this.redis.setJson(cacheKey, ranking, 300); // 5 min cache
    return ranking;
  }

  // ─── Monthly Ranking ───────────────────────────────────────────────────

  async getMonthlyRanking(limit = 50): Promise<RankingEntry[]> {
    const cacheKey = 'ranking:monthly';
    const cached = await this.redis.getJson<RankingEntry[]>(cacheKey);
    if (cached) return cached;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const topBettors = await this.prisma.bet.groupBy({
      by: ['userId'],
      where: {
        status: 'WON',
        settledAt: { gte: monthStart },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const ranking: RankingEntry[] = [];
    for (let i = 0; i < topBettors.length; i++) {
      const entry = topBettors[i];
      const user = await this.prisma.user.findUnique({
        where: { id: entry.userId },
        select: { name: true, avatarUrl: true, level: true, balance: { select: { points: true } } },
      });

      if (!user) continue;

      const totalBets = await this.prisma.bet.count({
        where: { userId: entry.userId, settledAt: { gte: monthStart } },
      });

      ranking.push({
        position: i + 1,
        userId: entry.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        level: user.level,
        points: user.balance?.points ?? 0,
        wonBets: entry._count.id,
        winRate: totalBets > 0 ? Math.round((entry._count.id / totalBets) * 100) : 0,
      });
    }

    await this.redis.setJson(cacheKey, ranking, 600);
    return ranking;
  }

  // ─── User Position ─────────────────────────────────────────────────────

  async getUserPosition(userId: number) {
    const global = await this.getGlobalRanking(200);
    const weekly = await this.getWeeklyRanking(200);

    const globalPos = global.find((r) => r.userId === userId)?.position ?? null;
    const weeklyPos = weekly.find((r) => r.userId === userId)?.position ?? null;

    const stats = await this.getUserBetStats(userId);

    return {
      globalPosition: globalPos,
      weeklyPosition: weeklyPos,
      totalBets: stats.total,
      wonBets: stats.won,
      lostBets: stats.lost,
      winRate: stats.winRate,
    };
  }

  // ─── League Ranking ────────────────────────────────────────────────────

  async getLeagueRanking(leagueId: number, limit = 50): Promise<RankingEntry[]> {
    const cacheKey = `ranking:league:${leagueId}`;
    const cached = await this.redis.getJson<RankingEntry[]>(cacheKey);
    if (cached) return cached;

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true, level: true } },
      },
    });

    const ranking: RankingEntry[] = [];
    for (const m of members) {
      const balance = await this.prisma.leagueBalance.findUnique({
        where: { leagueId_userId: { leagueId, userId: m.user.id } },
      });

      const [won, total] = await Promise.all([
        this.prisma.bet.count({
          where: { userId: m.user.id, status: 'WON', betSlip: { leagueId } },
        }),
        this.prisma.bet.count({
          where: { userId: m.user.id, status: { in: ['WON', 'LOST'] }, betSlip: { leagueId } },
        }),
      ]);

      ranking.push({
        position: 0,
        userId: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        level: m.user.level,
        points: balance?.balance ?? 0,
        wonBets: won,
        winRate: total > 0 ? Math.round((won / total) * 100) : 0,
      });
    }

    ranking.sort((a, b) => b.points - a.points);
    ranking.forEach((r, i) => r.position = i + 1);

    const result = ranking.slice(0, limit);
    await this.redis.setJson(cacheKey, result, 300);
    return result;
  }

  // ─── Cron: Invalidate Cache ────────────────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshRankingCache() {
    await this.redis.del('ranking:global');
    await this.redis.del('ranking:weekly');
    await this.redis.del('ranking:monthly');
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  private async getUserBetStats(userId: number) {
    const [won, lost, total] = await Promise.all([
      this.prisma.bet.count({ where: { userId, status: 'WON' } }),
      this.prisma.bet.count({ where: { userId, status: 'LOST' } }),
      this.prisma.bet.count({ where: { userId, status: { in: ['WON', 'LOST'] } } }),
    ]);

    return {
      won,
      lost,
      total,
      winRate: total > 0 ? Math.round((won / total) * 100) : 0,
    };
  }

  private getWeekStart(): Date {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }
}
