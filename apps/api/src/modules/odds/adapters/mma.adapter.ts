import { SportAdapter, NormalizedFixture, NormalizedOddsData } from './sport-adapter.interface';

/**
 * API-MMA adapter.
 * Docs: https://api-sports.io/documentation/mma/v1
 *
 * MMA fights use a different data shape: fighters instead of teams.
 * We map fighter1 → homeTeam and fighter2 → awayTeam to keep the
 * Fixture schema consistent.
 *
 * Status: NS, R1-R5, FT, POST, CANC, SUSP
 */
const STATUS_MAP: Record<string, string> = {
  NS: 'NOT_STARTED',
  R1: 'ROUND_1',
  R2: 'ROUND_2',
  R3: 'ROUND_3',
  R4: 'ROUND_4',
  R5: 'ROUND_5',
  FT: 'FINISHED',
  POST: 'POSTPONED',
  CANC: 'CANCELLED',
  SUSP: 'SUSPENDED',
};

const BET_ID_FIGHT_WINNER = 1;
const BET_ID_METHOD = 2;
const BET_ID_TOTAL_ROUNDS = 3;

export class MmaAdapter implements SportAdapter {
  readonly sportKey = 'mma';
  readonly apiHost = 'v1.mma.api-sports.io';

  async fetchFixtures(
    date: string,
    activeLeagueIds: number[],
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture[]> {
    const activeSet = new Set(activeLeagueIds);

    const data = await httpGet<any>(
      `https://${this.apiHost}/fights`,
      { 'x-apisports-key': apiKey },
      { date },
    );

    const fights = data?.response || [];
    const results: NormalizedFixture[] = [];

    for (const item of fights) {
      // MMA: league = category/organization (e.g., UFC)
      const leagueId = item.league?.id || item.category?.id || 0;
      if (activeLeagueIds.length > 0 && !activeSet.has(leagueId)) continue;

      const fighter1 = item.fighters?.home || item.fighters?.fighter1 || {};
      const fighter2 = item.fighters?.away || item.fighters?.fighter2 || {};

      results.push({
        apiId: item.id,
        sportKey: this.sportKey,
        leagueId: leagueId,
        leagueName: item.league?.name || item.category?.name || 'MMA',
        leagueLogo: item.league?.logo || null,
        homeTeam: fighter1.name || 'Fighter 1',
        homeLogo: fighter1.logo || fighter1.photo || null,
        awayTeam: fighter2.name || 'Fighter 2',
        awayLogo: fighter2.logo || fighter2.photo || null,
        startAt: new Date(item.date),
        status: STATUS_MAP[item.status?.short] || 'NOT_STARTED',
        scoreHome: null, // MMA doesn't have running scores
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
      { fight: apiFixtureId.toString() },
    );

    const oddData = data?.response?.[0];
    if (!oddData) return null;

    const bookmaker = oddData.bookmakers?.[0];
    if (!bookmaker) return null;

    const markets: NormalizedOddsData['markets'] = [];

    for (const bet of bookmaker.bets) {
      let marketType: string | null = null;

      if (bet.id === BET_ID_FIGHT_WINNER) marketType = 'MMA_FIGHT_WINNER';
      else if (bet.id === BET_ID_METHOD) marketType = 'MMA_METHOD_OF_VICTORY';
      else if (bet.id === BET_ID_TOTAL_ROUNDS) marketType = 'MMA_TOTAL_ROUNDS';
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
      `https://${this.apiHost}/fights`,
      { 'x-apisports-key': apiKey },
      { id: apiFixtureId.toString() },
    );

    const item = data?.response?.[0];
    if (!item) return null;

    const fighter1 = item.fighters?.home || item.fighters?.fighter1 || {};
    const fighter2 = item.fighters?.away || item.fighters?.fighter2 || {};

    return {
      apiId: item.id,
      sportKey: this.sportKey,
      leagueId: item.league?.id || item.category?.id || 0,
      leagueName: item.league?.name || item.category?.name || 'MMA',
      leagueLogo: item.league?.logo || null,
      homeTeam: fighter1.name || 'Fighter 1',
      homeLogo: fighter1.logo || fighter1.photo || null,
      awayTeam: fighter2.name || 'Fighter 2',
      awayLogo: fighter2.logo || fighter2.photo || null,
      startAt: new Date(item.date),
      status: STATUS_MAP[item.status?.short] || 'NOT_STARTED',
      scoreHome: null,
      scoreAway: null,
    };
  }

  getLiveStatuses(): string[] {
    return ['ROUND_1', 'ROUND_2', 'ROUND_3', 'ROUND_4', 'ROUND_5'];
  }

  private normalizeOddName(marketType: string, rawName: string): string {
    if (marketType === 'MMA_FIGHT_WINNER') {
      if (rawName === 'Home' || rawName === 'Fighter 1') return 'Lutador 1';
      if (rawName === 'Away' || rawName === 'Fighter 2') return 'Lutador 2';
      if (rawName === 'Draw') return 'Empate';
    }
    if (marketType === 'MMA_METHOD_OF_VICTORY') {
      if (rawName.includes('KO')) return 'KO/TKO';
      if (rawName.includes('Sub')) return 'Finalização';
      if (rawName.includes('Dec')) return 'Decisão';
    }
    if (marketType === 'MMA_TOTAL_ROUNDS') {
      if (rawName.includes('Over')) return `Mais ${rawName.replace('Over ', '')} rounds`;
      if (rawName.includes('Under')) return `Menos ${rawName.replace('Under ', '')} rounds`;
    }
    return rawName;
  }
}
