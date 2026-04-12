import { SportAdapter, NormalizedFixture, NormalizedOddsData } from './sport-adapter.interface';

/**
 * API-Formula1 adapter.
 * Docs: https://api-sports.io/documentation/formula-1/v1
 *
 * F1 races don't have home/away teams. We map:
 *   - homeTeam = Race name (e.g., "Monaco Grand Prix")
 *   - awayTeam = Circuit name (e.g., "Circuit de Monaco")
 *   - leagueName = season/competition name
 *   - Scores: not applicable (we leave null)
 *
 * Status: NS, FT (Finished), CANC, POST, SUSP, LIVE (In Progress)
 */
const STATUS_MAP: Record<string, string> = {
  NS: 'NOT_STARTED',
  '1': 'IN_PROGRESS',
  '2': 'IN_PROGRESS',
  LIVE: 'IN_PROGRESS',
  FT: 'FINISHED',
  Completed: 'FINISHED',
  POST: 'POSTPONED',
  CANC: 'CANCELLED',
  SUSP: 'SUSPENDED',
};

const BET_ID_RACE_WINNER = 1;
const BET_ID_PODIUM = 2;
const BET_ID_FASTEST_LAP = 3;

export class Formula1Adapter implements SportAdapter {
  readonly sportKey = 'formula1';
  readonly apiHost = 'v1.formula-1.api-sports.io';

  async fetchFixtures(
    date: string,
    activeLeagueIds: number[],
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture[]> {
    // F1 uses /races endpoint with season parameter
    const season = new Date(date).getFullYear().toString();

    const data = await httpGet<any>(
      `https://${this.apiHost}/races`,
      { 'x-apisports-key': apiKey },
      { date, season, timezone: 'America/Sao_Paulo' },
    );

    const races = data?.response || [];
    const results: NormalizedFixture[] = [];
    const activeSet = new Set(activeLeagueIds);

    for (const item of races) {
      const competitionId = item.competition?.id || item.league?.id || 0;

      // If we have active leagues configured, filter by them
      if (activeLeagueIds.length > 0 && !activeSet.has(competitionId)) continue;

      const raceName = item.competition?.name || item.type || 'Race';
      const circuitName = item.circuit?.name || '';
      const status = item.status || 'NS';

      results.push({
        apiId: item.id,
        sportKey: this.sportKey,
        leagueId: competitionId,
        leagueName: `F1 - ${season}`,
        leagueLogo: item.competition?.logo || null,
        homeTeam: raceName,
        homeLogo: undefined,
        awayTeam: circuitName,
        awayLogo: undefined,
        startAt: new Date(item.date),
        status: STATUS_MAP[status] || 'NOT_STARTED',
        scoreHome: null, // F1 doesn't have scores
        scoreAway: null,
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
      { race: apiFixtureId.toString() },
    );

    const oddData = data?.response?.[0];
    if (!oddData) return null;

    const bookmaker = oddData.bookmakers?.[0];
    if (!bookmaker) return null;

    const markets: NormalizedOddsData['markets'] = [];

    for (const bet of bookmaker.bets) {
      let marketType: string | null = null;

      if (bet.id === BET_ID_RACE_WINNER) marketType = 'F1_RACE_WINNER';
      else if (bet.id === BET_ID_PODIUM) marketType = 'F1_PODIUM_FINISH';
      else if (bet.id === BET_ID_FASTEST_LAP) marketType = 'F1_FASTEST_LAP';
      else continue;

      const odds = bet.values
        .map((v: any) => ({
          name: v.value, // Driver name stays as-is
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
      `https://${this.apiHost}/races`,
      { 'x-apisports-key': apiKey },
      { id: apiFixtureId.toString() },
    );

    const item = data?.response?.[0];
    if (!item) return null;

    const season = new Date(item.date).getFullYear().toString();
    const status = item.status || 'NS';

    return {
      apiId: item.id,
      sportKey: this.sportKey,
      leagueId: item.competition?.id || 0,
      leagueName: `F1 - ${season}`,
      leagueLogo: item.competition?.logo || null,
      homeTeam: item.competition?.name || item.type || 'Race',
      homeLogo: undefined,
      awayTeam: item.circuit?.name || '',
      awayLogo: undefined,
      startAt: new Date(item.date),
      status: STATUS_MAP[status] || 'NOT_STARTED',
      scoreHome: null,
      scoreAway: null,
    };
  }

  getLiveStatuses(): string[] {
    return ['IN_PROGRESS'];
  }
}
