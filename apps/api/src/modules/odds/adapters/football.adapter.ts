import { SportAdapter, NormalizedFixture, NormalizedOddsData } from './sport-adapter.interface';

const STATUS_MAP: Record<string, string> = {
  TBD: 'NOT_STARTED', NS: 'NOT_STARTED',
  '1H': 'FIRST_HALF', HT: 'HALFTIME', '2H': 'SECOND_HALF',
  ET: 'EXTRA_TIME', P: 'PENALTIES',
  FT: 'FINISHED', AET: 'FINISHED', PEN: 'FINISHED',
  PST: 'POSTPONED', CANC: 'CANCELLED', ABD: 'CANCELLED',
  AWD: 'FINISHED', WO: 'FINISHED', LIVE: 'FIRST_HALF',
};

const BET_ID_MATCH_WINNER = 1;
const BET_ID_OVER_UNDER_25 = 5;
const BET_ID_BTTS = 8;

export class FootballAdapter implements SportAdapter {
  readonly sportKey = 'football';
  readonly apiHost = 'v3.football.api-sports.io';

  async fetchFixtures(
    date: string,
    activeLeagueIds: number[],
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture[]> {
    const activeSet = new Set(activeLeagueIds);

    const data = await httpGet<any>(
      `https://${this.apiHost}/fixtures`,
      { 'x-apisports-key': apiKey },
      { date, timezone: 'America/Sao_Paulo' },
    );

    const allFixtures = data?.response || [];
    const results: NormalizedFixture[] = [];

    for (const item of allFixtures) {
      if (!activeSet.has(item.league.id)) continue;

      results.push({
        apiId: item.fixture.id,
        sportKey: this.sportKey,
        leagueId: item.league.id,
        leagueName: `${item.league.country} - ${item.league.name}`,
        leagueLogo: item.league.logo,
        homeTeam: item.teams.home.name,
        homeLogo: item.teams.home.logo,
        awayTeam: item.teams.away.name,
        awayLogo: item.teams.away.logo,
        startAt: new Date(item.fixture.date),
        status: STATUS_MAP[item.fixture.status.short] || 'NOT_STARTED',
        scoreHome: item.goals.home,
        scoreAway: item.goals.away,
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
      { fixture: apiFixtureId.toString() },
    );

    const oddData = data?.response?.[0];
    if (!oddData) return null;

    const bookmaker = oddData.bookmakers?.[0];
    if (!bookmaker) return null;

    const markets: NormalizedOddsData['markets'] = [];

    for (const bet of bookmaker.bets) {
      let marketType: string | null = null;
      if (bet.id === BET_ID_MATCH_WINNER) marketType = 'MATCH_WINNER';
      else if (bet.id === BET_ID_OVER_UNDER_25) marketType = 'OVER_UNDER_25';
      else if (bet.id === BET_ID_BTTS) marketType = 'BOTH_TEAMS_SCORE';
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
      `https://${this.apiHost}/fixtures`,
      { 'x-apisports-key': apiKey },
      { id: apiFixtureId.toString() },
    );

    const item = data?.response?.[0];
    if (!item) return null;

    return {
      apiId: item.fixture.id,
      sportKey: this.sportKey,
      leagueId: item.league.id,
      leagueName: `${item.league.country} - ${item.league.name}`,
      leagueLogo: item.league.logo,
      homeTeam: item.teams.home.name,
      homeLogo: item.teams.home.logo,
      awayTeam: item.teams.away.name,
      awayLogo: item.teams.away.logo,
      startAt: new Date(item.fixture.date),
      status: STATUS_MAP[item.fixture.status.short] || 'NOT_STARTED',
      scoreHome: item.goals.home,
      scoreAway: item.goals.away,
    };
  }

  getLiveStatuses(): string[] {
    return ['FIRST_HALF', 'HALFTIME', 'SECOND_HALF', 'EXTRA_TIME', 'PENALTIES'];
  }

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
}
