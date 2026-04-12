import { SportAdapter, NormalizedFixture, NormalizedOddsData } from './sport-adapter.interface';

/**
 * API-Basketball status mapping.
 * Docs: https://api-sports.io/documentation/basketball/v1
 *
 * API statuses: NS, Q1, Q2, Q3, Q4, OT, BT (Break Time), HT, FT, AOT (After OT),
 *               POST, CANC, SUSP, AWD, ABD, WO
 */
const STATUS_MAP: Record<string, string> = {
  NS: 'NOT_STARTED',
  Q1: 'QUARTER_1',
  Q2: 'QUARTER_2',
  Q3: 'QUARTER_3',
  Q4: 'QUARTER_4',
  OT: 'OVERTIME',
  BT: 'BREAK',
  HT: 'HALFTIME',
  FT: 'FINISHED',
  AOT: 'FINISHED',
  POST: 'POSTPONED',
  CANC: 'CANCELLED',
  SUSP: 'SUSPENDED',
  AWD: 'FINISHED',
  ABD: 'CANCELLED',
  WO: 'FINISHED',
};

/**
 * API-Basketball bet IDs:
 *  1 = Home/Away (Winner)
 *  2 = Home/Away Including Overtime
 *  5 = Over/Under
 *  6 = Asian Handicap (Spread)
 */
const BET_ID_WINNER = 1;
const BET_ID_TOTAL = 5;
const BET_ID_SPREAD = 6;

export class BasketballAdapter implements SportAdapter {
  readonly sportKey = 'basketball';
  readonly apiHost = 'v1.basketball.api-sports.io';

  async fetchFixtures(
    date: string,
    activeLeagueIds: number[],
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture[]> {
    const activeSet = new Set(activeLeagueIds);

    const data = await httpGet<any>(
      `https://${this.apiHost}/games`,
      { 'x-apisports-key': apiKey },
      { date, timezone: 'America/Sao_Paulo' },
    );

    const games = data?.response || [];
    const results: NormalizedFixture[] = [];

    for (const item of games) {
      if (!activeSet.has(item.league.id)) continue;

      results.push({
        apiId: item.id,
        sportKey: this.sportKey,
        leagueId: item.league.id,
        leagueName: `${item.country?.name || 'INT'} - ${item.league.name}`,
        leagueLogo: item.league.logo,
        homeTeam: item.teams.home.name,
        homeLogo: item.teams.home.logo,
        awayTeam: item.teams.away.name,
        awayLogo: item.teams.away.logo,
        startAt: new Date(item.date),
        status: STATUS_MAP[item.status?.short] || 'NOT_STARTED',
        scoreHome: item.scores?.home?.total ?? null,
        scoreAway: item.scores?.away?.total ?? null,
      });
    }

    return results;
  }

  async fetchOdds(
    apiFixtureId: number,
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedOddsData | null> {
    const data = await httpGet<any>(
      `https://${this.apiHost}/odds`,
      { 'x-apisports-key': apiKey },
      { game: apiFixtureId.toString() },
    );

    const oddData = data?.response?.[0];
    if (!oddData) return null;

    const bookmaker = oddData.bookmakers?.[0];
    if (!bookmaker) return null;

    const markets: NormalizedOddsData['markets'] = [];

    for (const bet of bookmaker.bets) {
      let marketType: string | null = null;

      if (bet.id === BET_ID_WINNER) marketType = 'BASKETBALL_WINNER';
      else if (bet.id === BET_ID_TOTAL) marketType = 'BASKETBALL_TOTAL';
      else if (bet.id === BET_ID_SPREAD) marketType = 'BASKETBALL_SPREAD';
      else continue;

      const odds = bet.values
        .map((v: any) => ({
          name: this.normalizeOddName(marketType!, v.value),
          value: parseFloat(v.odd),
        }))
        .filter((o: any) => !isNaN(o.value) && o.value > 1);

      if (odds.length) {
        markets.push({ type: marketType, odds });
      }
    }

    return { apiFixtureId, markets };
  }

  async fetchFixtureById(
    apiFixtureId: number,
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture | null> {
    const data = await httpGet<any>(
      `https://${this.apiHost}/games`,
      { 'x-apisports-key': apiKey },
      { id: apiFixtureId.toString() },
    );

    const item = data?.response?.[0];
    if (!item) return null;

    return {
      apiId: item.id,
      sportKey: this.sportKey,
      leagueId: item.league.id,
      leagueName: `${item.country?.name || 'INT'} - ${item.league.name}`,
      leagueLogo: item.league.logo,
      homeTeam: item.teams.home.name,
      homeLogo: item.teams.home.logo,
      awayTeam: item.teams.away.name,
      awayLogo: item.teams.away.logo,
      startAt: new Date(item.date),
      status: STATUS_MAP[item.status?.short] || 'NOT_STARTED',
      scoreHome: item.scores?.home?.total ?? null,
      scoreAway: item.scores?.away?.total ?? null,
    };
  }

  getLiveStatuses(): string[] {
    return ['QUARTER_1', 'QUARTER_2', 'QUARTER_3', 'QUARTER_4', 'OVERTIME', 'BREAK', 'HALFTIME'];
  }

  private normalizeOddName(marketType: string, rawName: string): string {
    if (marketType === 'BASKETBALL_WINNER') {
      if (rawName === 'Home') return 'Casa';
      if (rawName === 'Away') return 'Fora';
    }
    if (marketType === 'BASKETBALL_TOTAL') {
      if (rawName.includes('Over')) return `Mais ${rawName.replace('Over ', '')}`;
      if (rawName.includes('Under')) return `Menos ${rawName.replace('Under ', '')}`;
    }
    if (marketType === 'BASKETBALL_SPREAD') {
      return rawName; // Keep spread value as-is (e.g. "Home -5.5")
    }
    return rawName;
  }
}
