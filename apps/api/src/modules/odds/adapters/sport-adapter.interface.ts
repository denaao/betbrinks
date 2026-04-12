/**
 * Normalized fixture data from any sport API.
 * All adapters must return data in this format.
 */
export interface NormalizedFixture {
  apiId: number;
  sportKey: string;
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  homeTeam: string;
  homeLogo?: string;
  awayTeam: string;
  awayLogo?: string;
  startAt: Date;
  status: string; // Maps to FixtureStatus enum
  scoreHome: number | null;
  scoreAway: number | null;
}

export interface NormalizedMarket {
  type: string; // Maps to MarketType enum
  odds: NormalizedOdd[];
}

export interface NormalizedOdd {
  name: string;
  value: number;
}

export interface NormalizedOddsData {
  apiFixtureId: number;
  markets: NormalizedMarket[];
}

/**
 * Sport adapter interface.
 * Each sport (football, basketball, etc.) implements this
 * to normalize data from its specific API-Sports endpoint.
 */
export interface SportAdapter {
  /** e.g. 'football', 'basketball' */
  readonly sportKey: string;

  /** API-Sports host for this sport, e.g. 'v3.football.api-sports.io' */
  readonly apiHost: string;

  /** Fetch all fixtures for a given date, filtered by active league IDs */
  fetchFixtures(
    date: string,
    activeLeagueIds: number[],
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture[]>;

  /** Fetch odds for a single fixture by its API ID */
  fetchOdds(
    apiFixtureId: number,
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedOddsData | null>;

  /** Fetch a single fixture by API ID (for live updates) */
  fetchFixtureById(
    apiFixtureId: number,
    apiKey: string,
    httpGet: <T>(url: string, headers: Record<string, string>, params: Record<string, string>) => Promise<T>,
  ): Promise<NormalizedFixture | null>;

  /** Get the list of live status values for this sport */
  getLiveStatuses(): string[];
}
