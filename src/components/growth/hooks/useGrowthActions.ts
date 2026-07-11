import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { getTodayWarsaw } from '../../../lib/date';
import { notify } from '../../../lib/notify';
import { restoreDefaultSkillTree } from '../../../lib/growth/growthSeed';
import type { GrowthPinSlot } from '../../../lib/growth/growth';

interface UseGrowthActionsParams {
  userId: string;
  weekStart: string;
  pins: { id: string; slot: string; entity_type: string | null; entity_id: string | null }[];
  focusProjectId: string | null;
  refresh: () => Promise<void>;
}

export function useGrowthActions({ userId, weekStart, pins, focusProjectId, refresh }: UseGrowthActionsParams) {
  const [pickerSlot, setPickerSlot] = useState<GrowthPinSlot | null>(null);
  const [pickerDefaultProjectId, setPickerDefaultProjectId] = useState<string | null>(null);
  const [showFocusEditor, setShowFocusEditor] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [savingScores, setSavingScores] = useState(false);
  const [showScores, setShowScores] = useState(false);
  const [editingScores, setEditingScores] = useState(false);

  const handleSaveFocus = async (skillId: string | null, why: string, drill: string, targetLevel: number) => {
    try {
      const { error } = await supabase.from('learning_week_focus').upsert(
        { user_id: userId, week_start: weekStart, skill_id: skillId, why_text: why, drill_text: drill, target_level: targetLevel },
        { onConflict: 'user_id,week_start' },
      );
      if (error) throw error;
      notify('Zapisano focus tygodnia', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
      throw e;
    }
  };

  const handleDonePin = async (pin: typeof pins[0]) => {
    try {
      const today = getTodayWarsaw();
      const { error } = await supabase.from('learning_week_pins').update({ done: true, done_at: today }).eq('id', pin.id);
      if (error) throw error;
      if (pin.entity_type === 'link' && pin.entity_id) {
        const { error: linkErr } = await supabase.from('vanguard_links').update({ status: 'read' }).eq('id', pin.entity_id);
        if (linkErr) throw linkErr;
      } else if (pin.entity_type === 'todo' && pin.entity_id) {
        const { error: todoErr } = await supabase.from('todo_items').update({ status: 'done' }).eq('id', pin.entity_id);
        if (todoErr) throw todoErr;
      }
      notify('Gotowe!', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleRemovePin = async (pinId: string) => {
    try {
      const { error } = await supabase.from('learning_week_pins').delete().eq('id', pinId);
      if (error) throw error;
      notify('Odpięto element', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleAddMustForProject = (projectId: string) => {
    setPickerDefaultProjectId(projectId);
    setPickerSlot('must');
  };

  const openPicker = (slot: GrowthPinSlot) => {
    setPickerDefaultProjectId(focusProjectId);
    setPickerSlot(slot);
  };

  const closePicker = () => {
    setPickerSlot(null);
    setPickerDefaultProjectId(null);
  };

  const handleQuickPinLink = async (linkId: string, slot: GrowthPinSlot) => {
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId, week_start: weekStart, slot, entity_type: 'link', entity_id: linkId,
        project_id: focusProjectId, sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto link', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handleQuickPinTodo = async (todoId: string, slot: GrowthPinSlot) => {
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId, week_start: weekStart, slot, entity_type: 'todo', entity_id: todoId,
        project_id: focusProjectId, sort_order: pins.filter((p) => p.slot === slot).length,
      });
      if (error) throw error;
      notify('Przypięto zadanie', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const startEditScores = (currentScores: Record<string, number>) => {
    setDraftScores({ ...currentScores });
    setEditingScores(true);
    setShowScores(true);
  };

  const saveScores = async () => {
    setSavingScores(true);
    try {
      const today = getTodayWarsaw();
      const { error } = await supabase.from('learning_skill_snapshots').upsert(
        { user_id: userId, snapshot_date: today, scores: draftScores },
        { onConflict: 'user_id,snapshot_date' },
      );
      if (error) throw error;
      setEditingScores(false);
      notify('Zapisano oceny skilli', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd zapisu', 'error');
    } finally {
      setSavingScores(false);
    }
  };

  const handleRestoreSkillTree = async () => {
    try {
      await restoreDefaultSkillTree(supabase, userId);
      notify('Przywrócono domyślne skilli', 'success');
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handlePickLink = async (linkId: string, skillId: string | null, projectId: string | null) => {
    if (!pickerSlot) return;
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot: pickerSlot,
        entity_type: 'link',
        entity_id: linkId,
        skill_id: skillId,
        project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
        sort_order: pins.filter((p) => p.slot === pickerSlot).length,
      });
      if (error) throw error;
      notify('Przypięto link', 'success');
      closePicker();
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handlePickTodo = async (todoId: string, skillId: string | null, projectId: string | null) => {
    if (!pickerSlot) return;
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot: pickerSlot,
        entity_type: 'todo',
        entity_id: todoId,
        skill_id: skillId,
        project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
        sort_order: pins.filter((p) => p.slot === pickerSlot).length,
      });
      if (error) throw error;
      notify('Przypięto zadanie', 'success');
      closePicker();
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  const handlePickManual = async (
    title: string,
    type: string,
    skillId: string | null,
    projectId: string | null,
  ) => {
    if (!pickerSlot) return;
    try {
      const { error } = await supabase.from('learning_week_pins').insert({
        user_id: userId,
        week_start: weekStart,
        slot: pickerSlot,
        entity_type: 'manual',
        manual_title: title,
        manual_resource_type: type,
        skill_id: skillId,
        project_id: projectId ?? pickerDefaultProjectId ?? focusProjectId,
        sort_order: pins.filter((p) => p.slot === pickerSlot).length,
      });
      if (error) throw error;
      notify('Dodano element do planu', 'success');
      closePicker();
      await refresh();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Błąd', 'error');
    }
  };

  return {
    pickerSlot, setPickerSlot,
    pickerDefaultProjectId,
    showFocusEditor, setShowFocusEditor,
    draftScores, setDraftScores,
    savingScores,
    showScores, setShowScores,
    editingScores, setEditingScores,
    handleSaveFocus,
    handleDonePin,
    handleRemovePin,
    handleAddMustForProject,
    openPicker,
    closePicker,
    handleQuickPinLink,
    handleQuickPinTodo,
    startEditScores,
    saveScores,
    handleRestoreSkillTree,
    handlePickLink,
    handlePickTodo,
    handlePickManual,
  };
}
