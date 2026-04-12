import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LeagueService } from '../league/league.service';
import {
  SPORT_ADAPTERS,
  getAllLiveStatuses,
  SportAdapter,
  NormalizedFixture,
  NormalizedOddsData,
} from './adapters';

@Injectable()
export class OddsService implements OnModuleInit {
  private readonly logger = new Logger(OddsService.name);
  private readonly apiKey: string;
  private readonly cachePrefix = 'odds:';

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
    private http: HttpService,
    private leagueService: LeagueService,
  ) {
    this.apiKey = this.config.get<string>('API_FOOTBALL_KEY', '');
  }

  async onModuleInit() {
    if (!this.apiKey) return;
    this.logger.log('App started — running initial multi-sport sync...');
    this.syncAllSports().catch((err) => this.logger.error('Initial sync failed', err));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  async getFixtures(date?: string, fresh = false, sportId?: number) {
    const targetDate = date || this.todayDate();
    const cacheKey = sportId
      ? `${this.cachePrefix}fixtures:${targetDate}:sport:${sportId}`
      : `${this.cachePrefix}fixtures:${targetDate}`;

    if (!fresh) {
      const cached = await this.redis.getJson<any[]>(cacheKey);
      if (cached) return cached;
    }

    // Determine which sportKeys to filter by
    let sportKeyFilter: string[] | undefined;
    if (sportId) {
      const sport = await this.prisma.sport.findUnique({ where: { id: sportId }, select: { key: true } });
      if (sport) sportKeyFilter = [sport.key];
    }

    const activeLeagueIds = await this.leagueService.getActiveLeagueIds(sportId);

    const fixtures = await this.prisma.fixture.findMany({
      where: {
        startAt: {
          gte: new Date(`${targetDate}T00:00:00-03:00`),
          lt: new Date(`${targetDate}T23:59:59.999-03:00`),
        },
        ...(activeLeagueIds.length > 0 ? { leagueId: { in: activeLeagueIds } } : {}),
        ...(sportKeyFilter ? { sportKey: { in: sportKeyFilter } } : {}),
      },
      include: {
        markets: { include: { odds: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    const result = fixtures.map((f) => this.mapFixtureResponse(f));
    await this.redis.setJson(cacheKey, result, 300);
    return result;
  }

  async getFixtureById(fixtureId: number) {
    const cacheKey = `${this.cachePrefix}fixture:${fixtureId}`;
    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const fixture = await this.prisma.fixture.findUnique({
      where: { id: fixtureId },
      include: { markets: { include: { odds: true } } },
    });

    if (!fixture) throw new NotFoundException('Jogo nao encontrado.');

    const result = this.mapFixtureResponse(fixture);
    await this.redis.setJson(cacheKey, result, 120);
    return result;
  }

  async getLiveFixtures() {
    const cacheKey = `${this.cachePrefix}live`;
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const allLive = getAllLiveStatuses();

    const fixtures = await this.prisma.fixture.findMany({
      where: { status: { in: allLive as any[] } },
      include: { markets: { include: { odds: true } } },
      orderBy: { startAt: 'asc' },
    });

    const result = fixtures.map((f) => this.mapFixtureResponse(f));
    await this.redis.setJson(cacheKey, result, 30);
    return result;
  }

  async getLeagues() {
    const leagues = await this.prisma.fixture.groupBy({
      by: ['leagueId', 'leagueName', 'leagueLogo', 'sportKey'],
      where: { startAt: { gte: new Date() }, status: 'NOT_STARTED' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return leagues.map((l) => ({
      id: l.leagueId,
      name: l.leagueName,
      logo: l.leagueLogo,
      sportKey: l.sportKey,
      fixtureCount: l._count.id,
    }));
  }

  /** Get active sports from DB */
  async getSports() {
    return this.prisma.sport.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, key: true, icon: true, sortOrder: true },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CRON: SYNC ALL SPORTS
  // ═══════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAllSports() {
    if (!this.apiKey) {
      this.logger.warn('API_FOOTBALL_KEY not set — skipping sync');
      return;
    }

    this.logger.log('═══ Multi-sport sync starting ═══');

    // Get active sports from DB
    const sports = await this.prisma.sport.findMany({
      where: { isActive: true },
      include: { leagues: { where: { isActive: true }, select: { apiFootballId: true } } },
    });

    for (const sport of sports) {
      const adapter = SPORT_ADAPTERS[sport.key];
      if (!adapter) {
        this.logger.warn(`No adapter for sport: ${sport.key}`);
        continue;
      }

      const activeLeagueIds = sport.leagues.map((l) => l.apiFootballId);
      if (!activeLeagueIds.length) {
        this.logger.log(`[${sport.key}] No active leagues — skipping`);
        continue;
      }

      try {
        await this.syncSportFixtures(adapter, activeLeagueIds);
      } catch (err: any) {
        this.logger.error(`[${sport.key}] Sync failed: ${err.message}`);
      }
    }

    this.logger.log('═══ Multi-sport sync complete ═══');
  }

  /**
   * Sync fixtures + odds for a single sport.
   */
  private async syncSportFixtures(adapter: SportAdapter, activeLeagueIds: number[]) {
    const today = this.todayDate();
    this.logger.log(`[${adapter.sportKey}] Syncing fixtures...`);

    // 1) Fetch & upsert fixtures
    let fixturesSynced = 0;
    try {
      const fixtures = await adapter.fetchFixtures(
        today,
        activeLeagueIds,
        this.apiKey,
        this.makeHttpGet(),
      );

      for (const f of fixtures) {
        await this.upsertNormalizedFixture(f);
        fixturesSynced++;
      }
    } catch (err: any) {
      this.logger.error(`[${adapter.sportKey}] Fixtures fetch failed: ${err.message}`);
    }

    this.logger.log(`[${adapter.sportKey}] Synced ${fixturesSynced} fixtures`);

    // 2) Fetch odds for upcoming fixtures of this sport
    const upcoming = await this.prisma.fixture.findMany({
      where: { status: 'NOT_STARTED', sportKey: adapter.sportKey },
      select: { apiFootballId: true, id: true },
      orderBy: { startAt: 'asc' },
    });

    if (upcoming.length) {
      this.logger.log(`[${adapter.sportKey}] Syncing odds for ${upcoming.length} upcoming...`);
      let oddsSynced = 0;

      for (const fixture of upcoming) {
        try {
          const oddsData = await adapter.fetchOdds(
            fixture.apiFootballId,
            this.apiKey,
            this.makeHttpGet(),
          );

          if (oddsData) {
            await this.upsertNormalizedOdds(fixture.id, oddsData);
            await this.redis.del(`${this.cachePrefix}fixture:${fixture.id}`);
            oddsSynced++;
          }
        } catch (err: any) {
          this.logger.error(`[${adapter.sportKey}] Odds for ${fixture.apiFootballId}: ${err.message}`);
        }
      }

      this.logger.log(`[${adapter.sportKey}] Synced ${oddsSynced}/${upcoming.length} odds`);
    }

    // Invalidate caches
    await this.redis.del(`${this.cachePrefix}fixtures:${today}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CRON: SYNC LIVE FIXTURES (ALL SPORTS)
  // ═══════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_MINUTE)
  async syncLiveFixtures() {
    if (!this.apiKey) return;

    const allLive = getAllLiveStatuses();

    // Fixtures already live
    const liveFixtures = await this.prisma.fixture.findMany({
      where: { status: { in: allLive as any[] } },
      select: { apiFootballId: true, sportKey: true },
    });

    // Fixtures that should have started
    const shouldHaveStarted = await this.prisma.fixture.findMany({
      where: { status: 'NOT_STARTED', startAt: { lte: new Date() } },
      select: { apiFootballId: true, sportKey: true },
    });

    // Group by sport
    const bySport = new Map<string, Set<number>>();
    for (const f of [...liveFixtures, ...shouldHaveStarted]) {
      if (!bySport.has(f.sportKey)) bySport.set(f.sportKey, new Set());
      bySport.get(f.sportKey)!.add(f.apiFootballId);
    }

    for (const [sportKey, apiIds] of bySport) {
      if (!apiIds.size) continue;

      const adapter = SPORT_ADAPTERS[sportKey];
      if (!adapter) continue;

      this.logger.log(`[${sportKey}] Updating ${apiIds.size} live/pending fixtures...`);

      for (const apiId of apiIds) {
        try {
          const fixture = await adapter.fetchFixtureById(
            apiId,
            this.apiKey,
            this.makeHttpGet(),
          );

          if (fixture) {
            await this.upsertNormalizedFixture(fixture);
          }
        } catch (err: any) {
          this.logger.error(`[${sportKey}] Failed to update fixture ${apiId}: ${err.message}`);
        }
      }
    }

    await this.redis.del(`${this.cachePrefix}live`);
    await this.redis.del(`${this.cachePrefix}fixtures:${this.todayDate()}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN: MANUAL SYNC
  // ═══════════════════════════════════════════════════════════════════════

  async syncFixtures() {
    return this.syncAllSports();
  }

  async syncOdds() {
    if (!this.apiKey) return;

    const upcoming = await this.prisma.fixture.findMany({
      where: { status: 'NOT_STARTED' },
      select: { apiFootballId: true, id: true, sportKey: true },
      orderBy: { startAt: 'asc' },
    });

    if (!upcoming.length) return;

    this.logger.log(`Syncing odds for ${upcoming.length} fixtures across all sports...`);

    for (const fixture of upcoming) {
      const adapter = SPORT_ADAPTERS[fixture.sportKey];
      if (!adapter) continue;

      try {
        const oddsData = await adapter.fetchOdds(
          fixture.apiFootballId,
          this.apiKey,
          this.makeHttpGet(),
        );

        if (oddsData) {
          await this.upsertNormalizedOdds(fixture.id, oddsData);
          await this.redis.del(`${this.cachePrefix}fixture:${fixture.id}`);
        }
      } catch (err: any) {
        this.logger.error(`[${fixture.sportKey}] Odds for ${fixture.apiFootballId}: ${err.message}`);
      }
    }

    await this.redis.del(`${this.cachePrefix}fixtures:${this.todayDate()}`);
  }

  async forceSyncAll() {
    await this.syncAllSports();
    return { message: 'Multi-sport sync complete' };
  }

  async runDiagnostic() {
    const today = this.todayDate();
    const results: any = { today, apiKeySet: !!this.apiKey, sports: [] };

    const sports = await this.prisma.sport.findMany({
      where: { isActive: true },
      include: { leagues: { where: { isActive: true }, select: { apiFootballId: true } } },
    });

    for (const sport of sports) {
      const adapter = SPORT_ADAPTERS[sport.key];
      const leagueCount = sport.leagues.length;

      const fixtureCount = await this.prisma.fixture.count({
        where: {
          sportKey: sport.key,
          startAt: {
            gte: new Date(`${today}T00:00:00-03:00`),
            lt: new Date(`${today}T23:59:59.999-03:00`),
          },
        },
      });

      results.sports.push({
        name: sport.name,
        key: sport.key,
        adapterAvailable: !!adapter,
        activeLeagues: leagueCount,
        fixturesInDb: fixtureCount,
      });
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: HTTP HELPER
  // ═══════════════════════════════════════════════════════════════════════

  private makeHttpGet() {
    const http = this.http;
    return async <T>(url: string, headers: Record<string, string>, params: Record<string, string>): Promise<T> => {
      const response: any = await firstValueFrom(
        http.get<T>(url, { headers, params, timeout: 30000 }),
      );
      return response.data;
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: UPSERT NORMALIZED DATA
  // ═══════════════════════════════════════════════════════════════════════

  private async upsertNormalizedFixture(f: NormalizedFixture) {
    const existing = await this.prisma.fixture.findFirst({
      where: { apiFootballId: f.apiId, sportKey: f.sportKey },
    });

    if (existing) {
      await this.prisma.fixture.update({
        where: { id: existing.id },
        data: {
          status: f.status as any,
          scoreHome: f.scoreHome,
          scoreAway: f.scoreAway,
        },
      });
      return;
    }

    await this.prisma.fixture.create({
      data: {
        apiFootballId: f.apiId,
        sportKey: f.sportKey,
        leagueId: f.leagueId,
        leagueName: f.leagueName,
        leagueLogo: f.leagueLogo || null,
        homeTeam: f.homeTeam,
        homeLogo: f.homeLogo || null,
        awayTeam: f.awayTeam,
        awayLogo: f.awayLogo || null,
        startAt: f.startAt,
        status: f.status as any,
        scoreHome: f.scoreHome,
        scoreAway: f.scoreAway,
      },
    });
  }


  private async upsertNormalizedOdds(fixtureId: number, data: NormalizedOddsData) {
    for (const market of data.markets) {
      const dbMarket = await this.prisma.market.upsert({
        where: { fixtureId_type: { fixtureId, type: market.type as any } },
        update: {},
        create: { fixtureId, type: market.type as any, status: 'active' },
      });

      for (const odd of market.odds) {
        if (isNaN(odd.value) || odd.value <= 1) continue;

        await this.prisma.odd.upsert({
          where: { marketId_name: { marketId: dbMarket.id, name: odd.name } },
          update: { value: odd.value },
          create: { marketId: dbMarket.id, name: odd.name, value: odd.value },
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE: RESPONSE MAPPING
  // ═══════════════════════════════════════════════════════════════════════

  private mapFixtureResponse(fixture: any) {
    return {
      id: fixture.id,
      apiFootballId: fixture.apiFootballId,
      sportKey: fixture.sportKey,
      leagueName: fixture.leagueName,
      leagueLogo: fixture.leagueLogo,
      homeTeam: fixture.homeTeam,
      homeLogo: fixture.homeLogo,
      awayTeam: fixture.awayTeam,
      awayLogo: fixture.awayLogo,
      startAt: fixture.startAt.toISOString(),
      status: fixture.status,
      scoreHome: fixture.scoreHome,
      scoreAway: fixture.scoreAway,
      isSettled: fixture.isSettled,
      markets: (fixture.markets || []).map((m: any) => ({
        id: m.id,
        type: m.type,
        status: m.status,
        odds: (m.odds || []).map((o: any) => ({
          id: o.id,
          name: o.name,
          value: parseFloat(o.value),
        })),
      })),
    };
  }

  private todayDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }
}
