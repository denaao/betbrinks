import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { LeagueService } from '../league/league.service';

// ─── API-Football Response Types ─────────────────────────────────────────────

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
  };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

interface ApiFootballOdd {
  league: { id: number };
  fixture: { id: number };
  bookmakers: Array<{
    id: number;
    name: string;
    bets: Array<{
      id: number;
      name: string;
      values: Array<{ value: string; odd: string }>;
    }>;
  }>;
}

// ─── Status Mapping ──────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, string> = {
  TBD: 'NOT_STARTED',
  NS: 'NOT_STARTED',
  '1H': 'FIRST_HALF',
  HT: 'HALFTIME',
  '2H': 'SECOND_HALF',
  ET: 'EXTRA_TIME',
  P: 'PENALTIES',
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  PST: 'POSTPONED',
  CANC: 'CANCELLED',
  ABD: 'CANCELLED',
  AWD: 'FINISHED',
  WO: 'FINISHED',
  LIVE: 'FIRST_HALF',
};

// Bet Name mapping for API-Football bet IDs
const BET_ID_MATCH_WINNER = 1;      // Match Winner (1x2)
const BET_ID_OVER_UNDER_25 = 5;     // Goals Over/Under 2.5
const BET_ID_BTTS = 8;              // Both Teams Score

@Injectable()
export class OddsService implements OnModuleInit {
  private readonly logger = new Logger(OddsService.name);
  private readonly apiKey: string;
  private readonly apiHost = 'v3.football.api-sports.io';
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

  /**
   * On app startup: trigger initial sync so we don't wait 30 min for the first cron.
   */
  async onModuleInit() {
    if (!this.apiKey) return;
    this.logger.log('App started — running initial fixtures + odds sync...');
    // Run in background so it doesn't block startup
    this.syncFixtures()
      .catch((err) => this.logger.error('Initial sync failed', err));
  }

  // ─── Public API ────────────────────────────────────────────────────────

  /**
   * Get today's fixtures with markets and odds.
   * Uses Redis cache (5 min TTL) to reduce API calls.
   */
  async getFixtures(date?: string, fresh = false, sportId?: number) {
    const targetDate = date || this.todayDate();
    const cacheKey = sportId
      ? `${this.cachePrefix}fixtures:${targetDate}:sport:${sportId}`
      : `${this.cachePrefix}fixtures:${targetDate}`;

    // Try cache first (skip if fresh=true)
    if (!fresh) {
      const cached = await this.redis.getJson<any[]>(cacheKey);
      if (cached) return cached;
    }

    // Get active league IDs to filter (optionally by sport)
    const activeLeagueIds = await this.leagueService.getActiveLeagueIds(sportId);

    // Fetch from DB (synced from API-Football cron)
    // Use Brazil timezone offset (-03:00) so the day boundaries match local time
    const fixtures = await this.prisma.fixture.findMany({
      where: {
        startAt: {
          gte: new Date(`${targetDate}T00:00:00-03:00`),
          lt: new Date(`${targetDate}T23:59:59.999-03:00`),
        },
        ...(activeLeagueIds.length > 0 ? { leagueId: { in: activeLeagueIds } } : {}),
      },
      include: {
        markets: {
          include: { odds: true },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const result = fixtures.map((f) => this.mapFixtureResponse(f));

    // Cache for 5 minutes
    await this.redis.setJson(cacheKey, result, 300);

    return result;
  }

  /**
   * Get single fixture with full market data.
   */
  async getFixtureById(fixtureId: number) {
    const cacheKey = `${this.cachePrefix}fixture:${fixtureId}`;

    const cached = await this.redis.getJson<any>(cacheKey);
    if (cached) return cached;

    const fixture = await this.prisma.fixture.findUnique({
      where: { id: fixtureId },
      include: {
        markets: {
          include: { odds: true },
        },
      },
    });

    if (!fixture) throw new NotFoundException('Jogo nao encontrado.');

    const result = this.mapFixtureResponse(fixture);
    await this.redis.setJson(cacheKey, result, 120); // 2 min cache

    return result;
  }

  /**
   * Get fixtures that are currently live.
   */
  async getLiveFixtures() {
    const cacheKey = `${this.cachePrefix}live`;
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    const fixtures = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['FIRST_HALF', 'HALFTIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'] },
      },
      include: {
        markets: { include: { odds: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    const result = fixtures.map((f) => this.mapFixtureResponse(f));
    await this.redis.setJson(cacheKey, result, 30); // 30s cache for live
    return result;
  }

  /**
   * Get available leagues (for Explore screen).
   */
  async getLeagues() {
    const leagues = await this.prisma.fixture.groupBy({
      by: ['leagueId', 'leagueName', 'leagueLogo'],
      where: {
        startAt: { gte: new Date() },
        status: 'NOT_STARTED',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    return leagues.map((l) => ({
      id: l.leagueId,
      name: l.leagueName,
      logo: l.leagueLogo,
      fixtureCount: l._count.id,
    }));
  }

  // ─── Cron: Sync Fixtures from API-Football ─────────────────────────────

  /**
   * Runs every 30 minutes: syncs today's fixtures AND odds from API-Football.
   * Uses direct HTTP calls to avoid internal rate limiter issues.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncFixtures() {
    if (!this.apiKey) {
      this.logger.warn('API_FOOTBALL_KEY not set — skipping sync');
      return;
    }

    this.logger.log('Syncing fixtures + odds from API-Football...');

    try {
      const today = this.todayDate();
      const activeLeagueIds = await this.leagueService.getActiveLeagueIds();

      if (!activeLeagueIds.length) {
        this.logger.warn('No active leagues configured — skipping sync. Add leagues via admin panel.');
        return;
      }

      // ── 1) Sync fixtures: single call by date, filter by active leagues ──
      this.logger.log(`Syncing fixtures for ${activeLeagueIds.length} active leagues...`);
      let fixturesSynced = 0;
      const activeSet = new Set(activeLeagueIds);

      try {
        const response: any = await firstValueFrom(
          this.http.get(`https://${this.apiHost}/fixtures`, {
            headers: { 'x-apisports-key': this.apiKey },
            params: { date: today, timezone: 'America/Sao_Paulo' },
            timeout: 30000,
          }),
        );

        const allFixtures = response.data?.response || [];
        this.logger.log(`API-Football returned ${allFixtures.length} total fixtures for ${today}`);

        for (const item of allFixtures) {
          if (activeSet.has(item.league.id)) {
            await this.upsertFixture(item);
            fixturesSynced++;
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch fixtures: ${err.message}`);
      }

      this.logger.log(`Synced ${fixturesSynced} fixtures for ${today}`);

      // ── 2) Sync odds for upcoming (NOT_STARTED) fixtures ──
      const upcoming = await this.prisma.fixture.findMany({
        where: { status: 'NOT_STARTED' },
        select: { apiFootballId: true, id: true },
        orderBy: { startAt: 'asc' },
      });

      if (upcoming.length) {
        this.logger.log(`Syncing odds for ${upcoming.length} upcoming fixtures...`);
        let oddsSynced = 0;

        for (const fixture of upcoming) {
          try {
            const response: any = await firstValueFrom(
              this.http.get(`https://${this.apiHost}/odds`, {
                headers: { 'x-apisports-key': this.apiKey },
                params: { fixture: fixture.apiFootballId.toString() },
                timeout: 15000,
              }),
            );

            const oddData = response.data?.response?.[0];
            if (oddData) {
              await this.upsertOdds(fixture.id, oddData);
              await this.redis.del(`${this.cachePrefix}fixture:${fixture.id}`);
              oddsSynced++;
            }
          } catch (err: any) {
            this.logger.error(`Failed to sync odds for fixture ${fixture.apiFootballId}: ${err.message}`);
          }
        }

        this.logger.log(`Synced odds for ${oddsSynced}/${upcoming.length} fixtures`);
      }

      // Invalidate fixture list cache
      await this.redis.del(`${this.cachePrefix}fixtures:${today}`);
      this.logger.log('Sync completo (fixtures + odds)!');
    } catch (err) {
      this.logger.error('Failed to sync fixtures', err);
    }
  }

  /**
   * Runs every 2 minutes: updates live fixtures AND checks if NOT_STARTED
   * games have kicked off. This keeps statuses, scores, and elapsed time current.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async syncLiveFixtures() {
    if (!this.apiKey) return;

    // 1) Fixtures already marked as live
    const liveFixtures = await this.prisma.fixture.findMany({
      where: {
        status: { in: ['FIRST_HALF', 'HALFTIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'] },
      },
      select: { apiFootballId: true },
    });

    // 2) Fixtures marked NOT_STARTED but whose startAt has passed (should have started)
    const shouldHaveStarted = await this.prisma.fixture.findMany({
      where: {
        status: 'NOT_STARTED',
        startAt: { lte: new Date() },
      },
      select: { apiFootballId: true },
    });

    // Combine and deduplicate
    const allIds = new Set<number>();
    for (const f of [...liveFixtures, ...shouldHaveStarted]) {
      allIds.add(f.apiFootballId);
    }

    if (!allIds.size) return;

    this.logger.log(
      `Updating ${allIds.size} fixtures (${liveFixtures.length} live, ${shouldHaveStarted.length} should-have-started)...`,
    );

    for (const apiId of allIds) {
      try {
        const data = await this.fetchApi<{ response: ApiFootballFixture[] }>(
          '/fixtures',
          { id: apiId.toString() },
        );

        if (data?.response?.[0]) {
          await this.upsertFixture(data.response[0]);
        }
      } catch (err) {
        this.logger.error(`Failed to update fixture ${apiId}`, err);
      }
    }

    // Invalidate caches
    await this.redis.del(`${this.cachePrefix}live`);
    const today = this.todayDate();
    await this.redis.del(`${this.cachePrefix}fixtures:${today}`);
  }

  /**
   * Manual odds sync (called from admin endpoint).
   * The main cron (syncFixtures) already includes odds sync.
   */
  async syncOdds() {
    if (!this.apiKey) return;

    const upcoming = await this.prisma.fixture.findMany({
      where: { status: 'NOT_STARTED' },
      select: { apiFootballId: true, id: true },
      orderBy: { startAt: 'asc' },
    });

    if (!upcoming.length) return;

    this.logger.log(`Syncing odds for ${upcoming.length} fixtures...`);

    // Process in batches of 8 to respect API rate limit (10/min)
    const batchSize = 8;
    for (let i = 0; i < upcoming.length; i += batchSize) {
      const batch = upcoming.slice(i, i + batchSize);
      for (const fixture of batch) {
        try {
          const data = await this.fetchApi<{ response: ApiFootballOdd[] }>(
            '/odds',
            { fixture: fixture.apiFootballId.toString() },
          );

          if (data?.response?.[0]) {
            await this.upsertOdds(fixture.id, data.response[0]);
            await this.redis.del(`${this.cachePrefix}fixture:${fixture.id}`);
          }
        } catch (err) {
          this.logger.error(`Failed to sync odds for fixture ${fixture.apiFootballId}`, err);
        }
      }
      // Wait 65s between batches to reset rate limit window
      if (i + batchSize < upcoming.length) {
        this.logger.log(`Batch ${Math.floor(i / batchSize) + 1} done, waiting for rate limit reset...`);
        await new Promise(r => setTimeout(r, 65_000));
      }
    }

    // Invalidate fixture list cache
    const today = this.todayDate();
    await this.redis.del(`${this.cachePrefix}fixtures:${today}`);
  }

  // ─── Private: API-Football HTTP Client ─────────────────────────────────

  private async fetchApi<T>(endpoint: string, params: Record<string, string>): Promise<T> {
    // Rate limiting: max 10 calls per minute for free tier
    const rateLimitKey = 'api_football:rate_limit';
    const callCount = await this.redis.incr(rateLimitKey);
    if (callCount === 1) {
      await this.redis.expire(rateLimitKey, 60);
    }
    if (callCount > 10) {
      this.logger.warn('API-Football rate limit reached, skipping request');
      return null as T;
    }

    const response: any = await firstValueFrom(
      this.http.get<T>(`https://${this.apiHost}${endpoint}`, {
        headers: {
          'x-apisports-key': this.apiKey,
        },
        params,
        timeout: 10000,
      }),
    );

    return response.data;
  }

  // ─── Private: Upsert Fixture ───────────────────────────────────────────

  private async upsertFixture(item: ApiFootballFixture) {
    const status = STATUS_MAP[item.fixture.status.short] || 'NOT_STARTED';

    await this.prisma.fixture.upsert({
      where: { apiFootballId: item.fixture.id },
      update: {
        status: status as any,
        scoreHome: item.goals.home,
        scoreAway: item.goals.away,
      },
      create: {
        apiFootballId: item.fixture.id,
        leagueId: item.league.id,
        leagueName: `${item.league.country} - ${item.league.name}`,
        leagueLogo: item.league.logo,
        homeTeam: item.teams.home.name,
        homeLogo: item.teams.home.logo,
        awayTeam: item.teams.away.name,
        awayLogo: item.teams.away.logo,
        startAt: new Date(item.fixture.date),
        status: status as any,
        scoreHome: item.goals.home,
        scoreAway: item.goals.away,
      },
    });
  }

  // ─── Private: Upsert Odds ─────────────────────────────────────────────

  private async upsertOdds(fixtureId: number, oddData: ApiFootballOdd) {
    // Use the first bookmaker available
    const bookmaker = oddData.bookmakers?.[0];
    if (!bookmaker) return;

    for (const bet of bookmaker.bets) {
      let marketType: string | null = null;

      if (bet.id === BET_ID_MATCH_WINNER) marketType = 'MATCH_WINNER';
      else if (bet.id === BET_ID_OVER_UNDER_25) marketType = 'OVER_UNDER_25';
      else if (bet.id === BET_ID_BTTS) marketType = 'BOTH_TEAMS_SCORE';
      else continue; // Skip unsupported market types

      // Upsert market
      const market = await this.prisma.market.upsert({
        where: {
          fixtureId_type: { fixtureId, type: marketType as any },
        },
        update: {},
        create: {
          fixtureId,
          type: marketType as any,
          status: 'active',
        },
      });

      // Upsert odds for this market
      for (const value of bet.values) {
        const oddName = this.normalizeOddName(marketType, value.value);
        const oddValue = parseFloat(value.odd);

        if (isNaN(oddValue) || oddValue <= 1) continue;

        await this.prisma.odd.upsert({
          where: {
            marketId_name: { marketId: market.id, name: oddName },
          },
          update: { value: oddValue },
          create: {
            marketId: market.id,
            name: oddName,
            value: oddValue,
          },
        });
      }
    }
  }

  // ─── Private: Helpers ─────────────────────────────────────────────────

  private normalizeOddName(marketType: string, rawName: string): string {
    if (marketType === 'MATCH_WINNER') {
      if (rawName === 'Home') return 'Casa';
      if (rawName === 'Draw') return 'Empate';
      if (rawName === 'Away') return 'Fora';
    }
    if (marketType === 'OVER_UNDER_25') {
      if (rawName.includes('Over')) return 'Mais 2.5';
      if (rawName.includes('Under')) return 'Menos 2.5';
    }
    if (marketType === 'BOTH_TEAMS_SCORE') {
      if (rawName === 'Yes') return 'Sim';
      if (rawName === 'No') return 'Nao';
    }
    return rawName;
  }

  private mapFixtureResponse(fixture: any) {
    return {
      id: fixture.id,
      apiFootballId: fixture.apiFootballId,
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

  /**
   * Force a full sync bypassing internal rate limiter.
   * Fetches fixtures for ALL active leagues, then syncs odds.
   */
  async forceSyncAll() {
    const today = this.todayDate();
    const activeLeagueIds = await this.leagueService.getActiveLeagueIds();
    this.logger.log(`[forceSyncAll] Syncing ${activeLeagueIds.length} leagues for ${today}...`);

    let totalSynced = 0;
    const activeSet = new Set(activeLeagueIds);

    try {
      const url = `https://${this.apiHost}/fixtures`;
      const response: any = await firstValueFrom(
        this.http.get(url, {
          headers: { 'x-apisports-key': this.apiKey },
          params: { date: today, timezone: 'America/Sao_Paulo' },
          timeout: 30000,
        }),
      );

      const allFixtures = response.data?.response || [];
      this.logger.log(`[forceSyncAll] API returned ${allFixtures.length} total fixtures`);

      for (const item of allFixtures) {
        if (activeSet.has(item.league.id)) {
          await this.upsertFixture(item);
          totalSynced++;
        }
      }
    } catch (err: any) {
      this.logger.error(`[forceSyncAll] Failed to fetch fixtures: ${err.message}`);
    }

    this.logger.log(`[forceSyncAll] Fixtures done! Total synced: ${totalSynced}`);

    // Invalidate fixture cache
    await this.redis.del(`${this.cachePrefix}fixtures:${today}`);

    // Now sync odds for upcoming fixtures (bypassing rate limiter)
    const upcoming = await this.prisma.fixture.findMany({
      where: { status: 'NOT_STARTED' },
      select: { apiFootballId: true, id: true },
      orderBy: { startAt: 'asc' },
    });

    this.logger.log(`[forceSyncAll] Syncing odds for ${upcoming.length} upcoming fixtures...`);
    let oddsSynced = 0;

    for (const fixture of upcoming) {
      try {
        const url = `https://${this.apiHost}/odds`;
        const response: any = await firstValueFrom(
          this.http.get(url, {
            headers: { 'x-apisports-key': this.apiKey },
            params: { fixture: fixture.apiFootballId.toString() },
            timeout: 15000,
          }),
        );

        const oddData = response.data?.response?.[0];
        if (oddData) {
          await this.upsertOdds(fixture.id, oddData);
          await this.redis.del(`${this.cachePrefix}fixture:${fixture.id}`);
          oddsSynced++;
        }
        this.logger.log(`[forceSyncAll] Odds fixture ${fixture.apiFootballId}: ${oddData ? 'OK' : 'no data'}`);
      } catch (err: any) {
        this.logger.error(`[forceSyncAll] Odds fixture ${fixture.apiFootballId} failed: ${err.message}`);
      }
    }

    this.logger.log(`[forceSyncAll] All done! ${totalSynced} fixtures, ${oddsSynced} odds synced.`);
    await this.redis.del(`${this.cachePrefix}fixtures:${today}`);

    return { fixtures: totalSynced, odds: oddsSynced };
  }

  /**
   * Diagnostic: tests API-Football connection, shows DB fixture count, and active leagues.
   */
  async runDiagnostic() {
    const today = this.todayDate();
    const results: any = { today, apiKeySet: !!this.apiKey, steps: [] };

    // 1) Check active leagues
    try {
      const leagueIds = await this.leagueService.getActiveLeagueIds();
      results.activeLeagueIds = leagueIds;
      results.steps.push({ step: 'getActiveLeagueIds', ok: true, count: leagueIds.length });
    } catch (err: any) {
      results.steps.push({ step: 'getActiveLeagueIds', ok: false, error: err.message });
      return results;
    }

    // 2) Test API-Football with Premier League (39) — raw response
    const testLeague = 39;
    try {
      const url = `https://${this.apiHost}/fixtures`;
      const response: any = await firstValueFrom(
        this.http.get(url, {
          headers: { 'x-apisports-key': this.apiKey },
          params: { date: today, league: testLeague.toString(), season: this.currentSeason(), timezone: 'America/Sao_Paulo' },
          timeout: 15000,
        }),
      );

      const raw = response.data;
      const count = raw?.response?.length || 0;
      results.steps.push({
        step: `RAW API-Football /fixtures (league ${testLeague} - Premier League)`,
        ok: true,
        fixturesFromApi: count,
        apiErrors: raw?.errors || {},
        apiResults: raw?.results || 0,
        apiPaging: raw?.paging || {},
        sampleFixture: raw?.response?.[0] || null,
      });

      // 2b) Sync if found
      if (count > 0) {
        for (const item of raw.response) {
          await this.upsertFixture(item);
        }
        results.steps.push({ step: 'upsertFixtures', ok: true, synced: count });
      }
    } catch (err: any) {
      results.steps.push({
        step: `RAW API-Football /fixtures (league ${testLeague})`,
        ok: false,
        error: err.message,
        responseData: err.response?.data || null,
      });
    }

    // 3) Count fixtures in DB
    try {
      const dbCount = await this.prisma.fixture.count({
        where: {
          startAt: {
            gte: new Date(`${today}T00:00:00-03:00`),
            lt: new Date(`${today}T23:59:59.999-03:00`),
          },
        },
      });
      results.steps.push({ step: 'dbFixtureCount', ok: true, count: dbCount });
    } catch (err: any) {
      results.steps.push({ step: 'dbFixtureCount', ok: false, error: err.message });
    }

    return results;
  }

  /**
   * Returns today's date string in Brazil timezone (America/Sao_Paulo).
   * This ensures sync and queries align with the user's local day.
   */
  private todayDate(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }

  /**
   * Returns the current football season year.
   * Most leagues run Aug-May, so Jan-Jul belongs to the previous year's season.
   */
  private currentSeason(): string {
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const year = now.getFullYear();
    // If we're in Jan-Jul, season started the previous year (e.g., 2025/2026 season)
    return month <= 7 ? (year - 1).toString() : year.toString();
  }
}
