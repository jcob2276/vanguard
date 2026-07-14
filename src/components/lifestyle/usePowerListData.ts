import { useEffect, useMemo, useRef, useState } from 'react';
import { getTodayWarsaw, getYesterdayWarsaw, getWarsawHour } from '../../lib/date';
import { useHaptics } from '../../hooks/useHaptics';
import { useLifeGoals } from '../projects/hooks/useLifeGoals';
import { useDirectionContext } from './direction/hooks/useDirectionContext';
import { usePowerListActions } from './hooks/usePowerListActions';
import { usePowerListEffects } from './hooks/usePowerListEffects';
import {
  type TaskSlot,
  EMPTY_SLOT,
  powerListKpiKey,
  type UsePowerListDataProps,
  type DailyWinWithTasks,
  type ProjectOption,
} from './usePowerListTypes';
import { type PillarProjectBinding, type DirectionProjectSummary } from '../../lib/dailyPlanProposal';
import type { LifeGoalDisplayRow } from '../../lib/projects/lifeGoals';

export type { TaskSlot, UsePowerListDataProps, ProjectOption, DailyWinWithTasks } from './usePowerListTypes';
export { TIME_SLOT_LABELS } from './usePowerListTypes';

function getPillarProjects(lifeGoalRows: LifeGoalDisplayRow[]): PillarProjectBinding[] {
  return lifeGoalRows
    .filter((r) => r.projectId)
    .map((r) => ({
      pillar: r.id as 'cialo' | 'duch' | 'konto',
      projectId: r.projectId!,
      name: r.subtitle || r.title,
      kpis: (r.kpis ?? []).map((k) => ({
        id: k.id,
        name: k.name,
        current: k.current,
        target: k.target,
      })),
    }));
}

function getAllProjectOptions(activeProjects: DirectionProjectSummary[] | undefined): ProjectOption[] {
  return activeProjects?.map((p) => ({
    id: p.id,
    name: p.name,
    kpis: p.kpis ?? [],
  })) ?? [];
}

function getEveningCloseDue(todayWin: DailyWinWithTasks | null): boolean {
  if (!todayWin) return false;
  if (todayWin.day_note?.trim()) return false;
  if (!todayWin.task_1?.trim()) return false;
  if (todayWin.result === 'Z' || todayWin.result === 'P') return true;
  const h = getWarsawHour();
  return h >= 20;
}

const getInitialTaskForm = () => Array.from({ length: 5 }, () => ({ ...EMPTY_SLOT }));

export function usePowerListData({
  session,
  todayWin,
  onUpdate,
  planDaySignal,
}: UsePowerListDataProps) {
  const userId = session.user.id;
  const { displayRows: lifeGoalRows, refresh: refreshLifeGoals } = useLifeGoals(userId);
  const direction = useDirectionContext(userId);
  const today = getTodayWarsaw();
  const yesterdayStr = getYesterdayWarsaw();
  const haptics = useHaptics();
  const weekGoals = direction.weekGoals ?? null;
  const pillarProjects = useMemo(() => getPillarProjects(lifeGoalRows), [lifeGoalRows]);
  const allProjectOptions = useMemo(() => getAllProjectOptions(direction.activeProjects), [direction.activeProjects]);
  useEffect(() => {
    if (!todayWin) void refreshLifeGoals();
  }, [todayWin, refreshLifeGoals]);
  const [checkpointPrompt, setCheckpointPrompt] = useState<{ index: number; checkpointId: string; title: string } | null>(null);
  const [markingCheckpoint, setMarkingCheckpoint] = useState(false);
  const [yesterdayNote, setYesterdayNote] = useState('');
  const [newTaskForm, setNewTaskForm] = useState<TaskSlot[]>(getInitialTaskForm);
  const [pickerSlot, setPickerSlot] = useState(-1);
  const [submitting, setSubmitting] = useState(false);
  const [eveningNote, setEveningNote] = useState('');
  const [savingEvening, setSavingEvening] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const draftLoaded = useRef(false);
  const [todaySlotKpis, setTodaySlotKpis] = useState<Record<number, string>>(() => {
    try {
      const raw = localStorage.getItem(powerListKpiKey(userId, today));
      return raw ? (JSON.parse(raw) as Record<number, string>) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      if (Object.keys(todaySlotKpis).length === 0) {
        localStorage.removeItem(powerListKpiKey(userId, today));
      } else {
        localStorage.setItem(powerListKpiKey(userId, today), JSON.stringify(todaySlotKpis));
      }
    } catch {
      /* ignore */
    }
  }, [todaySlotKpis, userId, today]);
  const occupiedSlots = useMemo(() => newTaskForm.map((s) => !!s.task.trim()), [newTaskForm]);
  const [aiQuestions, setAiQuestions] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const queries = usePowerListEffects({
    userId,
    today,
    todayWin,
    draftLoadedRef: draftLoaded,
    newTaskForm,
    setNewTaskForm,
    yesterdayNote,
    setYesterdayNote,
    planDaySignal,
    directionLoading: direction.loading,
  });

  const yesterdayNoteRequired = !!queries.yesterdayWin && !queries.yesterdayWin.day_note;

  const actions = usePowerListActions({
    userId,
    today,
    direction,
    pillarProjects,
    newTaskForm,
    setNewTaskForm,
    checkpointPrompt,
    setCheckpointPrompt,
    setMarkingCheckpoint,
    yesterdayWin: queries.yesterdayWin,
    yesterdayNote,
    yesterdayNoteRequired,
    submitting,
    setSubmitting,
    eveningNote,
    savingEvening,
    setSavingEvening,
    todaySlotKpis,
    setAiQuestions,
    setAiLoading,
    onUpdate,
    session,
    setTodaySlotKpis,
    allProjectOptions,
  });
  const eveningCloseDue = useMemo(() => getEveningCloseDue(todayWin), [todayWin]);
  return {
    userId,
    today,
    direction,
    haptics,
    weekGoals,
    pillarProjects,
    allProjectOptions,
    projectMap: queries.projectMap,
    checkpointPrompt,
    setCheckpointPrompt,
    markingCheckpoint,
    yesterdayWin: queries.yesterdayWin,
    yesterdayNote,
    setYesterdayNote,
    yesterdayNoteRequired,
    newTaskForm,
    setNewTaskForm,
    todoItems: queries.todoItems,
    pickerSlot,
    setPickerSlot,
    submitting,
    eveningNote,
    setEveningNote,
    savingEvening,
    pickerRef,
    todaySlotKpis,
    aiQuestions,
    aiLoading,
    occupiedSlots,
    eveningCloseDue,
    fillSlotFromCheckpoint: actions.fillSlotFromCheckpoint,
    confirmCheckpointDone: actions.confirmCheckpointDone,
    generateQuestions: actions.generateQuestions,
    saveEveningClose: () => actions.saveEveningClose(todayWin),
    toggleTask: (idx: number) => actions.toggleTask(idx, todayWin),
    startNewDay: actions.startNewDay,
    updateSlot: actions.updateSlot,
    projectOptionsForSlot: actions.projectOptionsForSlot,
    kpiHintForSlot: actions.kpiHintForSlot,
    kpisForProject: actions.kpisForProject,
    todayStr: today,
    yesterdayStr,
  };
}
