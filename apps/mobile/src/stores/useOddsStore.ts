import { create } from 'zustand';
import { FixtureResponse } from '@betbrinks/shared';

interface OddsState {
  fixtures: FixtureResponse[];
  liveFixtures: FixtureResponse[];
  isLoading: boolean;
  error: string | null;

  setFixtures: (fixtures: FixtureResponse[]) => void;
  setLiveFixtures: (fixtures: FixtureResponse[]) => void;
  updateFixtureOdds: (fixtureId: number, fixture: FixtureResponse) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useOddsStore = create<OddsState>((set) => ({
  fixtures: [],
  liveFixtures: [],
  isLoading: false,
  error: null,

  setFixtures: (fixtures) => set({ fixtures, isLoading: false }),

  setLiveFixtures: (fixtures) =>
    set({ liveFixtures: fixtures.filter((f) => f.status !== 'NOT_STARTED' && f.status !== 'FINISHED') }),

  updateFixtureOdds: (fixtureId, updated) =>
    set((state) => ({
      fixtures: state.fixtures.map((f) => (f.id === fixtureId ? updated : f)),
      liveFixtures: state.liveFixtures.map((f) => (f.id === fixtureId ? updated : f)),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
