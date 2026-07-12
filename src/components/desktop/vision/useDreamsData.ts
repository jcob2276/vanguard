import { useState } from 'react';
import { notify } from '../../../lib/notify';
import {
  type DreamRow,
  useDreamsQuery,
  useVisionItemsQuery,
  useSprintReviewQuery,
  useAddDreamMutation,
  useToggleDreamMutation,
  useToggleTop5Mutation,
  useDeleteDreamMutation,
  useSaveDreamEditMutation,
  useAddVisionItemMutation,
  useDeleteVisionItemMutation,
} from '../../../lib/dreamsApi';


export interface UseDreamsDataProps {
  userId: string;
  loading: boolean;
}

export function useDreamsData({ userId, loading }: UseDreamsDataProps) {
  const { data: dreams = [] } = useDreamsQuery(userId);
  const { data: visionItems = [] } = useVisionItemsQuery(userId);
  const { data: sprintReview = null } = useSprintReviewQuery(userId, loading);

  const addDreamMutation = useAddDreamMutation(userId);
  const toggleDreamMutation = useToggleDreamMutation(userId);
  const toggleTop5Mutation = useToggleTop5Mutation(userId);
  const deleteDreamMutation = useDeleteDreamMutation(userId);
  const saveDreamEditMutation = useSaveDreamEditMutation(userId);
  const addVisionItemMutation = useAddVisionItemMutation(userId);
  const deleteVisionItemMutation = useDeleteVisionItemMutation(userId);

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

  const [newVisionContent, setNewVisionContent] = useState('');
  const [newVisionType, setNewVisionType] = useState('affirmation');
  const [newVisionColor, setNewVisionColor] = useState('indigo');
  const [isAddingVision, setIsAddingVision] = useState(false);

  async function addDream() {
    if (!newDreamTitle.trim() || !userId) return;
    try {
      await addDreamMutation.mutateAsync({
        title: newDreamTitle.trim(),
        category: newDreamCategory,
        lifeGoal: newDreamLifeGoal || null,
      });
      setNewDreamTitle('');
      setNewDreamLifeGoal(null);
      setIsAddingDream(false);
    } catch { /* mirrors previous silent-fail on error */ }
  }

  async function toggleDream(dream: DreamRow) {
    try {
      await toggleDreamMutation.mutateAsync(dream);
    } catch { /* mirrors previous silent-fail on error */ }
  }

  async function deleteDream(id: string) {
    try {
      await deleteDreamMutation.mutateAsync(id);
      if (editingDream?.id === id) setEditingDream(null);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Nie udało się usunąć marzenia', 'error');
    }
  }

  async function toggleTop5(dream: DreamRow) {
    try {
      await toggleTop5Mutation.mutateAsync(dream);
    } catch { /* mirrors previous silent-fail on error */ }
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
    try {
      await saveDreamEditMutation.mutateAsync({
        id: editingDream.id,
        title: editDreamTitle.trim(),
        description: editDreamDesc.trim() || null,
        category: editDreamCat,
        lifeGoal: editDreamLifeGoal || null,
      });
      setEditingDream(null);
    } catch { /* mirrors previous silent-fail on error */ }
  }

  async function addVisionItem() {
    if (!newVisionContent.trim() || !userId) return;
    try {
      await addVisionItemMutation.mutateAsync({
        content: newVisionContent.trim(),
        type: newVisionType,
        color: newVisionColor,
      });
      setNewVisionContent('');
      setIsAddingVision(false);
    } catch { /* mirrors previous silent-fail on error */ }
  }

  async function deleteVisionItem(id: string) {
    try {
      await deleteVisionItemMutation.mutateAsync(id);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Nie udało się usunąć elementu', 'error');
    }
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
    dreams,
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
    savingDream: saveDreamEditMutation.isPending,
    sprintReview,
    visionItems,
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
