import { create } from 'zustand';
import { getTodayWarsaw, formatWarsawDate } from '../lib/date';

export interface NOf1Experiment {
  id: string; // factorKey + '__' + outcomeKey + '__' + startDate
  factorKey: string;
  factorLabel: string;
  outcomeKey: string;
  outcomeLabel: string;
  status: 'active' | 'completed' | 'cancelled';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  conditionDescription: string;
  baselineMean: number | null;
  experimentMean: number | null;
  delta: number | null;
  completedAt?: string;
  notes?: string;
}

interface NOf1State {
  experiments: NOf1Experiment[];
  startExperiment: (
    factorKey: string,
    factorLabel: string,
    outcomeKey: string,
    outcomeLabel: string,
    durationDays: number,
    conditionDescription: string
  ) => void;
  cancelExperiment: (id: string) => void;
  completeExperiment: (
    id: string,
    baselineMean: number | null,
    experimentMean: number | null,
    delta: number | null,
    notes?: string
  ) => void;
}

// Load initial state from localStorage
const STORAGE_KEY = 'vanguard_n_of_1_experiments';
const loadStored = (): NOf1Experiment[] => {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val ? JSON.parse(val) : [];
  } catch (e) {
    console.error('Failed to parse stored experiments:', e);
    return [];
  }
};

const saveStored = (list: NOf1Experiment[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to store experiments:', e);
  }
};

export const useNOf1Store = create<NOf1State>((set) => ({
  experiments: loadStored(),

  startExperiment: (factorKey, factorLabel, outcomeKey, outcomeLabel, durationDays, conditionDescription) =>
    set((state) => {
      // Check if there is already an active experiment for this pair
      const active = state.experiments.find(
        (e) => e.factorKey === factorKey && e.outcomeKey === outcomeKey && e.status === 'active'
      );
      if (active) return state; // Avoid duplicates

      const today = getTodayWarsaw();
      const end = new Date();
      end.setDate(end.getDate() + durationDays);
      const endDate = formatWarsawDate(end);

      const newExp: NOf1Experiment = {
        id: `${factorKey}__${outcomeKey}__${today}`,
        factorKey,
        factorLabel,
        outcomeKey,
        outcomeLabel,
        status: 'active',
        startDate: today,
        endDate,
        durationDays,
        conditionDescription,
        baselineMean: null,
        experimentMean: null,
        delta: null
      };

      const updated = [newExp, ...state.experiments];
      saveStored(updated);
      return { experiments: updated };
    }),

  cancelExperiment: (id) =>
    set((state) => {
      const updated = state.experiments.map((e) =>
        e.id === id ? { ...e, status: 'cancelled' as const } : e
      );
      saveStored(updated);
      return { experiments: updated };
    }),

  completeExperiment: (id, baselineMean, experimentMean, delta, notes) =>
    set((state) => {
      const today = getTodayWarsaw();
      const updated = state.experiments.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'completed' as const,
              baselineMean,
              experimentMean,
              delta,
              notes,
              completedAt: today
            }
          : e
      );
      saveStored(updated);
      return { experiments: updated };
    })
}));
