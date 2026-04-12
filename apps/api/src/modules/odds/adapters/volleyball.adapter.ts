import { SportAdapter, NormalizedFixture, NormalizedOddsData } from './sport-adapter.interface';

/**
 * API-Volleyball status mapping.
 * Docs: https://api-sports.io/documentation/volleyball/v1
 *
 * API statuses: NS, S1-S5, FT, POST, CANC, SUSP, AWD, ABD, WO, INTR (Interrupted)
 */
const STATUS_MAP: Record<string, string> = {
  NS: 'NOT_STARTED',
  S1: 'SET_1',
  S2: 'SET_2',
  S3: 'SET_3',
  S4: 'SET_4',
  S5: 'SET_5',
  FT: 'FINISHED',
  POST: 'POSTPONED',
  CANC: 'CANCELLED',
  SUSP: 'SUSPENDED',
  AWD: 'FINISHED',
  ABD: 'CANCELLED',
  WO: 'FINISHED',
  INTR: 'SUSPENDED',
};

/**
 * API-Volleyball bet IDs:
 *  1 = Match Winner (Home/Away)
 *  2 = Total Sets (Over/Under)
 *  3 = Handicap (Sets)
 */
const BET_ID_WINNER = 1;
const BET_ID_TOTAL_SETS = 2;
const BET_ID_HANDICAP = 3;

export class VolleyballAdapter implements SportAdapter {
  readonly sportKey = 'volleyball';
  readonly apiHost = 'v1.volleyball.api-sports.io';

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

      // Volleyball scores: sets won by each team
      const homeScore = item.scores?.home != null ? item.scores.home : null;
      const awayScore = item.scores?.away != null ? item.scores.away : null;

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
        scoreHome: homeScore,
        scoreAway: awayScore,
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

      if (bet.id === BET_ID_WINNER) marketType = 'VOLLEYBALL_WINNER';
      else if (bet.id === BET_ID_TOTAL_SETS) marketType = 'VOLLEYBALL_TOTAL_SETS';
      else if (bet.id === BET_ID_HANDICAP) marketType = 'VOLLEYBALL_HANDICAP';
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
      scoreHome: item.scores?.home ?? null,
      scoreAway: item.scores?.away ?? null,
    };
  }

  getLiveStatuses(): string[] {
    return ['SET_1', 'SET_2', 'SET_3', 'SET_4', 'SET_5'];
  }

  private normalizeOddName(marketType: string, rawName: string): string {
    if (marketType === 'VOLLEYBALL_WINNER') {
      if (rawName === 'Home') return 'Casa';
      if (rawName === 'Away') return 'Fora';
    }
    if (marketType === 'VOLLEYBALL_TOTAL_SETS') {
      if (rawName.includes('Over')) return `Mais ${rawName.replace('Over ', '')} sets`;
      if (rawName.includes('Under')) return `Menos ${rawName.replace('Under ', '')} sets`;
    }
    return rawName;
  }
}
