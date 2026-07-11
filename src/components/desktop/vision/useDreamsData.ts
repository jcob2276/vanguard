import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { fetchSprintReview, type SprintReview } from '../../../lib/goal/goalSpine';
import type { Database } from '../../../lib/database.types';

export type DreamRow = Database['public']['Tables']['dreams']['Row'];
export type VisionBoardItemRow = Database['public']['Tables']['vision_board_items']['Row'];

export interface UseDreamsDataProps {
  userId: string;
  loading: boolean;
}

export function useDreamsData({ userId, loading }: UseDreamsDataProps) {
  const [dreams, setDreams] = useState<DreamRow[]>([]);
  const [newDreamTitle, setNewDreamTitle] = useState('');
  const [newDreamCategory, setNewDreamCategory] = useState('inne');
  const [dreamFilter, setDreamFilter] = useState('all');
  const [isAddingDream, setIsAddingDream] = useState(false);
  const [editingDream, setEditingDream] = useState<DreamRow | null>(null);
  const [editDreamTitle, setEditDreamTitle] = useState('');
  const [editDreamDesc, setEditDreamDesc] = useState('');
  const [editDreamCat, setEditDreamCat] = useState('inne');
  const [editDreamLifeGoal, setEditDreamLifeGoal] = useState<string | null>(null);
  const [newDreamLifeGoal, setNewDreamLifeGoal] = useState<string | null>(null);
  const [savingDream, setSavingDream] = useState(false);
  const [sprintReview, setSprintReview] = useState<SprintReview | null>(null);

  const [visionItems, setVisionItems] = useState<VisionBoardItemRow[]>([]);
  const [newVisionContent, setNewVisionContent] = useState('');
  const [newVisionType, setNewVisionType] = useState('affirmation');
  const [newVisionColor, setNewVisionColor] = useState('indigo');
  const [isAddingVision, setIsAddingVision] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('dreams').select('*').eq('user_id', userId)
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setDreams(data); });
    supabase.from('vision_board_items').select('*').eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setVisionItems(data); });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void fetchSprintReview(userId).then(setSprintReview);
  }, [userId, loading]);

  async function addDream() {
    if (!newDreamTitle.trim() || !userId) return;
    const { data, error } = await supabase.from('dreams')
      .insert({ user_id: userId, title: newDreamTitle.trim(), category: newDreamCategory, life_goal: newDreamLifeGoal || null } as never)
      .select().single();
    if (!error && data) {
      setDreams(prev => [data, ...prev]);
      setNewDreamTitle('');
      setNewDreamLifeGoal(null);
      setIsAddingDream(false);
    }
  }

  async function toggleDream(dream: DreamRow) {
    const is_done = !dream.is_done;
    const { data, error } = await supabase.from('dreams')
      .update({ is_done, done_at: is_done ? new Date().toISOString() : null })
      .eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  async function deleteDream(id: string) {
    const { error } = await supabase.from('dreams').delete().eq('id', id);
    if (error) { notify(error.message, 'error'); return; }
    setDreams(prev => prev.filter(d => d.id !== id));
    if (editingDream?.id === id) setEditingDream(null);
  }

  async function toggleTop5(dream: DreamRow) {
    const is_top5 = !dream.is_top5;
    const { data, error } = await supabase.from('dreams').update({ is_top5 }).eq('id', dream.id).select().single();
    if (!error && data) setDreams(prev => prev.map(d => d.id === dream.id ? data : d));
  }

  function openDreamModal(dream: DreamRow) {
    setEditingDream(dream);
    setEditDreamTitle(dream.title);
    setEditDreamDesc(dream.description || '');
    setEditDreamCat(dream.category || 'inne');
    setEditDreamLifeGoal(dream.life_goal || null);
  }

  async function saveDreamEdit() {
    if (!editingDream) return;
    setSavingDream(true);
    const { data, error } = await supabase.from('dreams')
      .update({ title: editDreamTitle.trim(), description: editDreamDesc.trim() || null, category: editDreamCat, life_goal: editDreamLifeGoal || null } as never)
      .eq('id', editingDream.id).select().single();
    if (!error && data) {
      setDreams(prev => prev.map(d => d.id === editingDream.id ? data : d));
      setEditingDream(null);
    }
    setSavingDream(false);
  }

  async function addVisionItem() {
    if (!newVisionContent.trim() || !userId) return;
    const { data, error } = await supabase.from('vision_board_items')
      .insert({ user_id: userId, type: newVisionType, content: newVisionContent.trim(), color: newVisionColor })
      .select().single();
    if (!error && data) { setVisionItems(prev => [data, ...prev]); setNewVisionContent(''); setIsAddingVision(false); }
  }

  async function deleteVisionItem(id: string) {
    const { error } = await supabase.from('vision_board_items').delete().eq('id', id);
    if (error) { notify(error.message, 'error'); return; }
    setVisionItems(prev => prev.filter(v => v.id !== id));
  }

  const DREAM_CATEGORIES = ['all', 'finanse', 'ciało', 'relacje', 'doświadczenia', 'wolność', 'inne'];
  const DREAM_CAT_LABEL: Record<string, string> = { all: 'Wszystkie', finanse: 'Finanse', ciało: 'Ciało', relacje: 'Relacje', doświadczenia: 'Doświadczenia', wolność: 'Wolność', inne: 'Inne' };
  const DREAM_CAT_COLOR: Record<string, string> = { finanse: 'text-emerald-500', ciało: 'text-rose-500', relacje: 'text-violet-500', doświadczenia: 'text-amber-500', wolność: 'text-sky-500', inne: 'text-text-muted' };

  const VB_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-300',  border: 'border-indigo-500/25' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', border: 'border-emerald-500/25' },
    amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-300',   border: 'border-amber-500/25' },
    rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-300',    border: 'border-rose-500/25' },
    violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-300',  border: 'border-violet-500/25' },
    sky:     { bg: 'bg-sky-500/10',     text: 'text-sky-300',     border: 'border-sky-500/25' },
  };

  const filteredDreams = dreamFilter === 'all' ? dreams : dreams.filter(d => d.category === dreamFilter);
  const doneDreams = dreams.filter(d => d.is_done).length;
  const top5Dreams = dreams.filter(d => d.is_top5 && !d.is_done).slice(0, 5);

  return {
    dreams, setDreams,
    newDreamTitle, setNewDreamTitle,
    newDreamCategory, setNewDreamCategory,
    dreamFilter, setDreamFilter,
    isAddingDream, setIsAddingDream,
    editingDream, setEditingDream,
    editDreamTitle, setEditDreamTitle,
    editDreamDesc, setEditDreamDesc,
    editDreamCat, setEditDreamCat,
    editDreamLifeGoal, setEditDreamLifeGoal,
    newDreamLifeGoal, setNewDreamLifeGoal,
    savingDream, setSavingDream,
    sprintReview, setSprintReview,
    visionItems, setVisionItems,
    newVisionContent, setNewVisionContent,
    newVisionType, setNewVisionType,
    newVisionColor, setNewVisionColor,
    isAddingVision, setIsAddingVision,
    addDream,
    toggleDream,
    deleteDream,
    toggleTop5,
    openDreamModal,
    saveDreamEdit,
    addVisionItem,
    deleteVisionItem,
    DREAM_CATEGORIES,
    DREAM_CAT_LABEL,
    DREAM_CAT_COLOR,
    VB_COLORS,
    filteredDreams,
    doneDreams,
    top5Dreams
  };
}
