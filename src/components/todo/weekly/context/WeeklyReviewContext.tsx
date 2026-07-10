import { createContext, useContext } from 'react';
import type { StreamEntry } from '../../../../lib/behavior/streamReview';
import type { Prediction } from '../../../../lib/predictionsApi';
import type { TodoItemRow, TodoItemUpdate, TodoSectionRow } from '../../../../lib/todo/todo';

export type WeeklyAiRecap = {
  phase1?: { narrative: string; question: string; longterm_motif?: string | null };
} | null;

export interface WeeklyReviewContextType {
  userId: string | undefined;
  today: string;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  step: number;
  setStep: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
  sections: TodoSectionRow[];
  setSections: React.Dispatch<React.SetStateAction<TodoSectionRow[]>>;
  inboxItems: TodoItemRow[];
  setInboxItems: React.Dispatch<React.SetStateAction<TodoItemRow[]>>;
  sectionItems: TodoItemRow[];
  setSectionItems: React.Dispatch<React.SetStateAction<TodoItemRow[]>>;
  streamEntries: StreamEntry[];
  setStreamEntries: React.Dispatch<React.SetStateAction<StreamEntry[]>>;
  editingStreamId: string | null;
  setEditingStreamId: (id: string | null) => void;
  editingStreamText: string;
  setEditingStreamText: (text: string) => void;
  pendingUpdates: Record<string, TodoItemUpdate>;
  setPendingUpdates: React.Dispatch<React.SetStateAction<Record<string, TodoItemUpdate>>>;
  currentSectionIdx: number;
  setCurrentSectionIdx: (idx: number) => void;
  weeklyNote: string;
  setWeeklyNote: (note: string) => void;
  aiRecap: WeeklyAiRecap;
  predictions: Prediction[];
  setPredictions: React.Dispatch<React.SetStateAction<Prediction[]>>;
  newPredictionText: string;
  setNewPredictionText: (text: string) => void;
  newPredictionConfidence: number;
  setNewPredictionConfidence: (confidence: number) => void;
  stagedPredictions: { metric: string; value: number }[];
  setStagedPredictions: React.Dispatch<React.SetStateAction<{ metric: string; value: number }[]>>;
  stageUpdate: (itemId: string, patch: TodoItemUpdate) => void;
  getStagedItem: (item: TodoItemRow) => TodoItemRow;
  activeSections: TodoSectionRow[];
  startEditStream: (entry: StreamEntry) => void;
  saveEditStream: () => Promise<void>;
  handleDeleteStream: (id: string) => Promise<void>;
  handleResolveCustom: (id: string, value: number) => Promise<void>;
  handleCreateCustomPred: () => Promise<void>;
  handleFinishReview: () => Promise<void>;
}

export const WeeklyReviewContext = createContext<WeeklyReviewContextType | null>(null);

export function useWeeklyReview() {
  const context = useContext(WeeklyReviewContext);
  if (!context) {
    throw new Error('useWeeklyReview must be used within a WeeklyReviewProvider');
  }
  return context;
}
