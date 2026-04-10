import { create } from 'zustand';
import { OddResponse, FixtureResponse } from '@betbrinks/shared';

interface BetSelection {
  fixture: FixtureResponse;
  odd: OddResponse;
  marketType: string;
}

interface BetState {
  selection: BetSelection | null;
  amount: number;
  isSlipOpen: boolean;

  selectOdd: (fixture: FixtureResponse, odd: OddResponse, marketType: string) => void;
  clearSelection: () => void;
  setAmount: (amount: number) => void;
  openSlip: () => void;
  closeSlip: () => void;

  potentialReturn: () => number;
}

export const useBetStore = create<BetState>((set, get) => ({
  selection: null,
  amount: 0,
  isSlipOpen: false,

  selectOdd: (fixture, odd, marketType) =>
    set({ selection: { fixture, odd, marketType }, isSlipOpen: true, amount: 0 }),

  clearSelection: () => set({ selection: null, amount: 0, isSlipOpen: false }),

  setAmount: (amount) => set({ amount }),

  openSlip: () => set({ isSlipOpen: true }),
  closeSlip: () => set({ isSlipOpen: false }),

  potentialReturn: () => {
    const { selection, amount } = get();
    if (!selection || !amount) return 0;
    return Math.floor(amount * selection.odd.value);
  },
}));
