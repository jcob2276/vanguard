/**
 * @component TerminyPage
 * @role Terminy — urodziny, przeglądy, polisy z przypomnieniami.
 * @usedBy Dashboard (/terminy)
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { getTodayWarsaw, type LifeObligationKind } from '@vanguard/domain';
import { ArrowLeft, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import ContentContainer from '../shared/ContentContainer';
import Tabs from '../ui/Tabs';
import Spinner from '../ui/Spinner';
import { Pressable } from '../ui/ControlPrimitives';
import { confirmDialog, notify } from '../../lib/notify';
import {
  useLifeObligationMutations,
  useLifeObligations,
  type LifeObligation,
  type LifeObligationInput,
} from '../../lib/lifeObligationsApi';
import { TerminyHorizon } from './TerminyHorizon';
import { TerminyVault } from './TerminyVault';
import TerminyAddSheet from './TerminyAddSheet';
import TerminySidebar from './TerminySidebar';
import { deriveAll, type StarterTemplate } from './terminyDerived';

export type TerminyTabKey = 'horizon' | 'people' | 'vehicle' | 'document';

const TABS = [
  { key: 'horizon', label: 'Nadchodzące' },
  { key: 'people', label: 'Ludzie' },
  { key: 'vehicle', label: 'Pojazd' },
  { key: 'document', label: 'Dokumenty' },
] as const;

interface Props {
  onBack: () => void;
  onNavigateTo?: (dest: string) => void;
}

export default function TerminyPage({ onBack, onNavigateTo }: Props) {
  const userId = useStore((s) => s.session?.user?.id);
  const today = getTodayWarsaw();
  const { data: items = [], isLoading, error } = useLifeObligations(userId);
  const { add, remove, update } = useLifeObligationMutations(userId);
  const reduceMotion = useReducedMotion();

  const [tab, setTab] = useState<TerminyTabKey>('horizon');
  const [addOpen, setAddOpen] = useState(false);
  const [seedTemplate, setSeedTemplate] = useState<StarterTemplate | null>(null);
  const [editing, setEditing] = useState<LifeObligation | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const rows = useMemo(() => deriveAll(items, today), [items, today]);

  const openAdd = (template?: StarterTemplate | null, kind?: LifeObligationKind) => {
    setEditing(null);
    setSeedTemplate(template ?? null);
    if (kind === 'people' || kind === 'vehicle' || kind === 'document') setTab(kind);
    setAddOpen(true);
  };

  const openEdit = (id: string) => {
    const item = items.find((row) => row.id === id);
    if (!item) return;
    setSeedTemplate(null);
    setEditing(item);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setSeedTemplate(null);
    setEditing(null);
  };

  const submit = async (input: LifeObligationInput) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...input });
        notify('Zapisano zmiany', 'success');
      } else {
        await add.mutateAsync(input);
        notify('Dodano termin', 'success');
      }
      closeAdd();
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Nie udało się zapisać', 'error');
    }
  };

  const onDelete = async (id: string, title: string) => {
    if (!(await confirmDialog(`Usunąć „${title}”?`))) return;
    try {
      await remove.mutateAsync(id);
      notify('Usunięto', 'success');
    } catch (e: unknown) {
      notify(e instanceof Error ? e.message : 'Nie udało się usunąć', 'error');
    }
  };

  const initialKind: LifeObligationKind = tab === 'horizon' ? 'people' : tab;

  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-text-muted">
        Zaloguj się, żeby otworzyć Terminy.
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-text-primary">
      <TerminySidebar
        tab={tab}
        setTab={setTab}
        rows={rows}
        onNavigateTo={onNavigateTo}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex flex-1 flex-col min-w-0 h-full overflow-y-auto">
        <header className="sticky top-0 z-[var(--z-sticky)] border-b border-border-custom/25 bg-background/85 backdrop-blur-[var(--blur-md)]">
          <div className="mx-auto flex max-w-[var(--content-wide)] items-center gap-3 px-[var(--space-4)] py-4 md:px-[var(--space-8)]">
            <Pressable
              onClick={onBack}
              aria-label="Wróć"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-[transform,background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 hover:bg-surface-2 hover:text-text-primary"
            >
              <ArrowLeft size={20} strokeWidth={1.75} />
            </Pressable>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight">Terminy</h1>
              <p className="text-xs text-text-muted">Urodziny, przeglądy, polisy</p>
            </div>
            <Pressable
              onClick={() => openAdd(null)}
              aria-label="Dodaj termin"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-accent transition-[transform,opacity] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-95 hover:opacity-[var(--opacity-90)]"
            >
              <Plus size={20} strokeWidth={2.25} />
            </Pressable>
          </div>
        </header>

        <ContentContainer width="default" className="space-y-6 pb-16 pt-6 flex-1">
          {isLoading && (
            <div className="flex justify-center py-16"><Spinner /></div>
          )}
          {error && (
            <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/20">
              {(error as Error).message}
            </p>
          )}

          {!isLoading && !error && (
            <>
              <Tabs
                tabs={[...TABS]}
                active={tab}
                onChange={(k) => setTab(k as TerminyTabKey)}
                className="rounded-2xl bg-surface-2/80 p-1 ring-1 ring-border-custom/20 [&_button]:rounded-xl [&_button]:py-2.5 [&_button]:text-sm [&_button]:font-medium"
              />

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {tab === 'horizon' ? (
                    <TerminyHorizon
                      rows={rows}
                      onDelete={onDelete}
                      onEdit={openEdit}
                      onOpenAdd={(tpl) => openAdd(tpl ?? null)}
                    />
                  ) : (
                    <TerminyVault
                      kind={tab}
                      rows={rows}
                      onDelete={onDelete}
                      onEdit={openEdit}
                      onOpenAdd={() => openAdd(null, tab)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </ContentContainer>
      </div>

      <TerminyAddSheet
        open={addOpen}
        onClose={closeAdd}
        onSubmit={submit}
        pending={add.isPending || update.isPending}
        initialTemplate={seedTemplate}
        initialKind={initialKind}
        editing={editing}
      />
    </div>
  );
}
