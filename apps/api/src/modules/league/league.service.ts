import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class LeagueService {
  private readonly logger = new Logger(LeagueService.name);
  private readonly apiKey: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private http: HttpService,
    private redis: RedisService,
  ) {
    this.apiKey = this.config.get<string>('API_FOOTBALL_KEY', '');
  }

  // ─── Get Active Leagues ─────────────────────────────────────────────

  async getActiveLeagues() {
    return this.prisma.activeLeague.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Get All Configured Leagues (active + inactive from our DB) ──────

  async getAllLeagues() {
    return this.prisma.activeLeague.findMany({
      orderBy: [{ isActive: 'desc' }, { country: 'asc' }, { name: 'asc' }],
      include: { sport: { select: { id: true, name: true } } },
    });
  }

  // ─── Get Active League IDs (for sync filtering) ─────────────────────

  async getActiveLeagueIds(sportId?: number): Promise<number[]> {
    const leagues = await this.prisma.activeLeague.findMany({
      where: { isActive: true, ...(sportId ? { sportId } : {}) },
      select: { apiFootballId: true },
    });
    return leagues.map((l) => l.apiFootballId);
  }

  // ─── Fetch ALL Leagues from API-Football (cached 24h) ───────────────

  async fetchAllApiLeagues(): Promise<any[]> {
    const cacheKey = 'api_football:all_leagues';

    // Check cache first (24h)
    const cached = await this.redis.getJson<any[]>(cacheKey);
    if (cached) return cached;

    if (!this.apiKey) throw new BadRequestException('API_FOOTBALL_KEY not configured');

    this.logger.log('Fetching all leagues from API-Football...');

    const url = `${this.config.get('API_FOOTBALL_BASE_URL')}/leagues`;
    const { data } = await firstValueFrom(
      this.http.get(url, {
        headers: { 'x-apisports-key': this.apiKey },
        timeout: 30000,
      }),
    );

    const leagues = (data?.response || []).map((item: any) => ({
      apiFootballId: item.league.id,
      name: item.league.name,
      country: item.country.name,
      countryFlag: item.country.flag,
      logo: item.league.logo,
      type: item.league.type, // "League" or "Cup"
    }));

    // Cache for 24 hours
    await this.redis.setJson(cacheKey, leagues, 86400);

    this.logger.log(`Fetched ${leagues.length} leagues from API-Football`);
    return leagues;
  }

  // ─── Get all API leagues enriched with enabled status ────────────────

  async getAllApiLeaguesWithStatus(sportId?: number) {
    // Determine if we're filtering by a specific sport
    let sport: { id: number; key: string } | null = null;
    if (sportId) {
      sport = await this.prisma.sport.findUnique({
        where: { id: sportId },
        select: { id: true, key: true },
      });
    }

    // For non-football sports (or if no API key), return leagues from DB only
    const isFootball = !sport || sport.key === 'football';

    if (isFootball) {
      // Football: merge API-Football remote list with DB status
      const [apiLeagues, dbLeagues] = await Promise.all([
        this.fetchAllApiLeagues(),
        this.prisma.activeLeague.findMany({
          include: { sport: { select: { id: true, name: true } } },
        }),
      ]);

      const dbMap = new Map(dbLeagues.map((l) => [l.apiFootballId, l]));

      return apiLeagues.map((api) => {
        const db = dbMap.get(api.apiFootballId);
        return {
          ...api,
          dbId: db?.id || null,
          isEnabled: db?.isActive || false,
          sportId: db?.sportId || null,
          sportName: db?.sport?.name || null,
        };
      });
    }

    // Non-football: return leagues from our database for this sport
    const dbLeagues = await this.prisma.activeLeague.findMany({
      where: { sportId: sport!.id },
      include: { sport: { select: { id: true, name: true } } },
      orderBy: [{ isActive: 'desc' }, { country: 'asc' }, { name: 'asc' }],
    });

    return dbLeagues.map((l) => ({
      apiFootballId: l.apiFootballId,
      name: l.name,
      country: l.country,
      countryFlag: null,
      logo: l.logo,
      type: 'League',
      dbId: l.id,
      isEnabled: l.isActive,
      sportId: l.sportId,
      sportName: l.sport?.name || null,
    }));
  }

  // ─── Enable a league (create or activate) ──────────────────────────

  async enableLeague(apiFootballId: number, name: string, country: string, logo?: string, sportId?: number) {
    const existing = await this.prisma.activeLeague.findFirst({
      where: { apiFootballId, sportId: sportId || null },
    });

    if (existing) {
      return this.prisma.activeLeague.update({
        where: { id: existing.id },
        data: { isActive: true, name, country, logo, ...(sportId !== undefined ? { sportId: sportId || null } : {}) },
      });
    }

    return this.prisma.activeLeague.create({
      data: { apiFootballId, name, country, logo, isActive: true, ...(sportId ? { sportId } : {}) },
    });
  }

  // ─── Disable a league ───────────────────────────────────────────────

  async disableLeague(apiFootballId: number, sportId?: number) {
    const existing = await this.prisma.activeLeague.findFirst({
      where: { apiFootballId, ...(sportId ? { sportId } : {}) },
    });

    if (!existing) return { message: 'Liga não encontrada' };

    return this.prisma.activeLeague.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
  }

  // ─── Toggle League by DB id ─────────────────────────────────────────

  async toggleLeague(id: number) {
    const league = await this.prisma.activeLeague.findUnique({ where: { id } });
    if (!league) throw new BadRequestException('Liga não encontrada');

    return this.prisma.activeLeague.update({
      where: { id },
      data: { isActive: !league.isActive },
    });
  }

  // ─── Update league sport ────────────────────────────────────────────

  async updateLeagueSport(apiFootballId: number, sportId: number | null) {
    const existing = await this.prisma.activeLeague.findFirst({
      where: { apiFootballId },
    });

    if (!existing) throw new BadRequestException('Liga não encontrada no banco');

    return this.prisma.activeLeague.update({
      where: { id: existing.id },
      data: { sportId },
    });
  }

  // ─── Remove League ──────────────────────────────────────────────────

  async removeLeague(id: number) {
    return this.prisma.activeLeague.delete({ where: { id } });
  }
}
