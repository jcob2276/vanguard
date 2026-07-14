import { Pressable, ControlInput, ControlSelect } from '../../ui/ControlPrimitives';
import { Plus, X, Star, Check, Trash2 } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Panel } from '../shell/Panel';
import { ToggleChip } from '../../ui/ToggleChip';
import type { DreamRow } from '../../../lib/dreamsApi';

interface DreamsPanelProps {
  dreams: DreamRow[];
  doneDreams: number;
  top5Dreams: DreamRow[];
  filteredDreams: DreamRow[];
  dreamFilter: string;
  setDreamFilter: (v: string) => void;
  isAddingDream: boolean;
  setIsAddingDream: React.Dispatch<React.SetStateAction<boolean>>;
  newDreamTitle: string;
  setNewDreamTitle: (v: string) => void;
  newDreamCategory: string;
  setNewDreamCategory: (v: string) => void;
  newDreamLifeGoal: string | null;
  setNewDreamLifeGoal: (v: string | null) => void;
  addDream: () => void;
  openDreamModal: (dream: DreamRow) => void;
  toggleDream: (dream: DreamRow) => void;
  deleteDream: (id: string) => void;
  DREAM_CATEGORIES: string[];
  DREAM_CAT_LABEL: Record<string, string>;
  DREAM_CAT_COLOR: Record<string, string>;
}

export default function DreamsPanel({
  dreams,
  doneDreams,
  top5Dreams,
  filteredDreams,
  dreamFilter,
  setDreamFilter,
  isAddingDream,
  setIsAddingDream,
  newDreamTitle,
  setNewDreamTitle,
  newDreamCategory,
  setNewDreamCategory,
  newDreamLifeGoal,
  setNewDreamLifeGoal,
  addDream,
  openDreamModal,
  toggleDream,
  deleteDream,
  DREAM_CATEGORIES,
  DREAM_CAT_LABEL,
  DREAM_CAT_COLOR,
}: DreamsPanelProps) {
  return (
    <Panel title="">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-039)] text-text-muted">Lista Marzeń</p>
            <p className="mt-0.5 font-display text-base font-black tracking-tight text-text-primary leading-none">
              200 Marzeń
              <span className="ml-2 text-xs font-bold text-text-muted">
                {doneDreams > 0 ? `${doneDreams} zrealizowanych` : `${dreams.length} zapisanych`}
              </span>
            </p>
          </div>
          <Pressable
            variant="tonal"
            size="sm"
            onClick={() => setIsAddingDream(p => !p)}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-2xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
            icon={<Plus size={11} />}
          >
            Dodaj marzenie
          </Pressable>
        </div>

        {/* Add form */}
        {isAddingDream && (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
            <div className="flex gap-2">
              <ControlInput
                autoFocus
                value={newDreamTitle}
                onChange={e => setNewDreamTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDream()}
                placeholder="Wpisz marzenie..."
                className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
              />
              <ControlSelect
                value={newDreamCategory}
                onChange={e => setNewDreamCategory(e.target.value)}
                className="rounded-xl border border-border-custom bg-surface px-3 py-2 text-xs font-bold text-text-secondary outline-none focus:border-primary cursor-pointer"
              >
                {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                ))}
              </ControlSelect>
              <Pressable variant="primary" size="sm" onClick={addDream} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all cursor-pointer">
                Dodaj
              </Pressable>
              <Pressable variant="ghost" size="sm" onClick={() => setIsAddingDream(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer" icon={<X size={13} />} />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xs font-black uppercase tracking-widest text-text-muted">Cel:</span>
              {([['cialo', 'Ciało', 'success'], ['duch', 'Duch', 'primary'], ['konto', 'Konto', 'warning']] as [string, string, 'success' | 'primary' | 'warning'][]).map(([val, label, variant]) => (
                <ToggleChip key={val} active={newDreamLifeGoal === val} onClick={() => setNewDreamLifeGoal(newDreamLifeGoal === val ? null : val)} variant={variant}>
                  {label}
                </ToggleChip>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 Marzeń */}
        {top5Dreams.length > 0 && (
          <div className="space-y-2">
            <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-039)] text-warning flex items-center gap-1.5">
              <Star size={9} fill="currentColor" /> Top 5 Marzeń
            </p>
            <div className="space-y-1.5">
              {top5Dreams.map(dream => (
                <Card key={dream.id} variant="glass" padding="0.625rem 0.875rem" className="rounded-xl flex items-center gap-2.5" style={{ border: 'var(--border-width-thin) solid var(--legacy-color-121)', background: 'var(--legacy-color-118)' }}>
                  <Star size={10} className="shrink-0 text-warning" fill="currentColor" />
                  <Pressable variant="ghost" size="sm" onClick={() => openDreamModal(dream)} className="flex-1 text-left text-xs font-bold text-text-primary hover:text-primary truncate cursor-pointer">
                    {dream.title}
                  </Pressable>
                  {dream.description && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary/40" title="Ma wizję" />}
                  <span className={`text-3xs font-black uppercase tracking-widest shrink-0 ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>{dream.category}</span>
                </Card>
              ))}
            </div>
            <div className="border-t border-border-custom" />
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {DREAM_CATEGORIES.map(cat => (
            <ToggleChip
              key={cat}
              active={dreamFilter === cat}
              onClick={() => setDreamFilter(cat)}
              variant="primary"
            >
              {DREAM_CAT_LABEL[cat]}
              {cat !== 'all' && dreams.filter(d => d.category === cat).length > 0 && (
                <span className="ml-1 opacity-[var(--opacity-60)]">{dreams.filter(d => d.category === cat).length}</span>
              )}
            </ToggleChip>
          ))}
        </div>

        {/* Dreams list */}
        {filteredDreams.length === 0 ? (
          <p className="py-6 text-center text-xs text-text-muted/50">
            {dreams.length === 0 ? 'Zacznij od zapisania pierwszego marzenia' : 'Brak marzeń w tej kategorii'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-[var(--legacy-h-032)] overflow-y-auto pr-1">
            {filteredDreams.map(dream => (
              <Card
                key={dream.id}
                variant="glass"
                padding="0.625rem 0.875rem"
                className={`rounded-xl group flex items-center gap-2.5 transition-all duration-[var(--motion-medium)] cursor-pointer ${
                  dream.is_done
                    ? 'opacity-[var(--opacity-60)]'
                    : 'hover:shadow-sm hover:-translate-y-0.5'
                }`}
                style={{
                  ...(dream.is_done
                    ? { border: 'var(--border-width-thin) solid var(--legacy-color-096)', background: 'var(--legacy-color-092)' }
                    : dream.is_top5
                    ? { border: 'var(--border-width-thin) solid var(--legacy-color-120)', background: 'var(--legacy-color-117)' }
                    : { border: 'var(--border-width-thin) solid var(--legacy-color-089)' })
                }}
                onClick={() => openDreamModal(dream)}
              >
                <Pressable
                  onClick={e => { e.stopPropagation(); toggleDream(dream); }}
                  className={`shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                    dream.is_done
                      ? 'border-success bg-success text-on-accent'
                      : 'border-border-custom hover:border-primary'
                  }`}
                >
                  {dream.is_done && <Check size={9} strokeWidth={3} />}
                </Pressable>
                <p className={`flex-1 text-xs font-semibold leading-snug min-w-0 truncate ${dream.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {dream.title}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {dream.is_top5 && !dream.is_done && <Star size={8} className="text-warning" fill="currentColor" />}
                  {dream.description && <span className="w-1 h-1 rounded-full bg-primary/40" />}
                  <span className={`text-3xs font-black uppercase tracking-widest ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>
                    {dream.category}
                  </span>
                  <Pressable
                    variant="ghost"
                    size="sm"
                    onClick={e => { e.stopPropagation(); deleteDream(dream.id); }}
                    className="opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] p-0.5 text-text-muted/40 hover:text-danger transition-all cursor-pointer"
                    icon={<Trash2 size={10} />}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {dreams.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border-custom">
            <div className="flex justify-between text-2xs font-bold text-text-muted uppercase tracking-widest">
              <span>{doneDreams} zrealizowanych</span>
              <span>{dreams.length} / 200</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border-custom overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-[var(--motion-long)]"
                style={{ width: `${Math.min((dreams.length / 200) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
