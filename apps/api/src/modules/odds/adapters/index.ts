export { SportAdapter, NormalizedFixture, NormalizedOddsData, NormalizedMarket, NormalizedOdd } from './sport-adapter.interface';
export { FootballAdapter } from './football.adapter';
export { BasketballAdapter } from './basketball.adapter';
export { VolleyballAdapter } from './volleyball.adapter';
export { MmaAdapter } from './mma.adapter';
export { Formula1Adapter } from './formula1.adapter';

import { SportAdapter } from './sport-adapter.interface';
import { FootballAdapter } from './football.adapter';
import { BasketballAdapter } from './basketball.adapter';
import { VolleyballAdapter } from './volleyball.adapter';
import { MmaAdapter } from './mma.adapter';
import { Formula1Adapter } from './formula1.adapter';

/**
 * Registry of all sport adapters, keyed by sport key.
 * The OddsService uses this to get the right adapter for each sport.
 */
export const SPORT_ADAPTERS: Record<string, SportAdapter> = {
  football: new FootballAdapter(),
  basketball: new BasketballAdapter(),
  volleyball: new VolleyballAdapter(),
  mma: new MmaAdapter(),
  formula1: new Formula1Adapter(),
};

/** Get all live statuses across all sports */
export function getAllLiveStatuses(): string[] {
  const all = new Set<string>();
  for (const adapter of Object.values(SPORT_ADAPTERS)) {
    for (const s of adapter.getLiveStatuses()) {
      all.add(s);
    }
  }
  return [...all];
}
