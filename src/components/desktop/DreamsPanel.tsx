import { Plus, X, Star, ArrowRight, Check, Trash2 } from 'lucide-react';
import { Panel } from './Panel';

interface DreamsPanelProps {
  dreams: any[];
  doneDreams: number;
  top5Dreams: any[];
  filteredDreams: any[];
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
  openDreamModal: (dream: any) => void;
  toggleDream: (dream: any) => void;
  deleteDream: (id: string) => void;
  dreamToProject: (dream: any) => void;
  projectByDreamId: Record<string, any>;
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
  dreamToProject,
  projectByDreamId,
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
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Lista Marzeń</p>
            <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
              200 Marzeń
              <span className="ml-2 text-[11px] font-bold text-text-muted">
                {doneDreams > 0 ? `${doneDreams} zrealizowanych` : `${dreams.length} zapisanych`}
              </span>
            </p>
          </div>
          <button
            onClick={() => setIsAddingDream(p => !p)}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <Plus size={11} /> Dodaj marzenie
          </button>
        </div>

        {/* Add form */}
        {isAddingDream && (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
            <div className="flex gap-2">
              <input
                autoFocus
                value={newDreamTitle}
                onChange={e => setNewDreamTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addDream()}
                placeholder="Wpisz marzenie..."
                className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
              />
              <select
                value={newDreamCategory}
                onChange={e => setNewDreamCategory(e.target.value)}
                className="rounded-xl border border-border-custom bg-surface px-3 py-2 text-[11px] font-bold text-text-secondary outline-none focus:border-primary cursor-pointer"
              >
                {DREAM_CATEGORIES.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{DREAM_CAT_LABEL[c]}</option>
                ))}
              </select>
              <button onClick={addDream} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                Dodaj
              </button>
              <button onClick={() => setIsAddingDream(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                <X size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Cel:</span>
              {([['cialo', 'Ciało', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'], ['duch', 'Duch', 'border-indigo-500/40 bg-indigo-500/10 text-indigo-500'], ['konto', 'Konto', 'border-amber-500/40 bg-amber-500/10 text-amber-600']] as [string, string, string][]).map(([val, label, active]) => (
                <button key={val} onClick={() => setNewDreamLifeGoal(newDreamLifeGoal === val ? null : val)}
                  className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${newDreamLifeGoal === val ? active : 'border-border-custom text-text-muted hover:text-text-secondary'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 Marzeń */}
        {top5Dreams.length > 0 && (
          <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-500 flex items-center gap-1.5">
              <Star size={9} fill="currentColor" /> Top 5 Marzeń
            </p>
            <div className="space-y-1.5">
              {top5Dreams.map(dream => (
                <div key={dream.id} className="flex items-center gap-2.5 rounded-[14px] border border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-2.5">
                  <Star size={10} className="shrink-0 text-amber-500" fill="currentColor" />
                  <button onClick={() => openDreamModal(dream)} className="flex-1 text-left text-[11px] font-bold text-text-primary hover:text-primary truncate cursor-pointer">
                    {dream.title}
                  </button>
                  {dream.description && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary/40" title="Ma wizję" />}
                  <span className={`text-[7px] font-black uppercase tracking-widest shrink-0 ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>{dream.category}</span>
                  {projectByDreamId[dream.id] ? (
                    <span className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/[0.04] px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary/70">
                      <ArrowRight size={9} /> {projectByDreamId[dream.id].name}
                    </span>
                  ) : (
                    <button
                      onClick={() => dreamToProject(dream)}
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
                    >
                      <ArrowRight size={9} /> Projekt
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border-custom" />
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {DREAM_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setDreamFilter(cat)}
              className={`rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                dreamFilter === cat
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border-custom text-text-muted hover:border-text-secondary hover:text-text-secondary'
              }`}
            >
              {DREAM_CAT_LABEL[cat]}
              {cat !== 'all' && dreams.filter(d => d.category === cat).length > 0 && (
                <span className="ml-1 opacity-60">{dreams.filter(d => d.category === cat).length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Dreams list */}
        {filteredDreams.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-text-muted/50">
            {dreams.length === 0 ? 'Zacznij od zapisania pierwszego marzenia' : 'Brak marzeń w tej kategorii'}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 max-h-[480px] overflow-y-auto pr-1">
            {filteredDreams.map(dream => (
              <div
                key={dream.id}
                onClick={() => openDreamModal(dream)}
                className={`group flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 transition-all cursor-pointer ${
                  dream.is_done
                    ? 'border-emerald-500/15 bg-emerald-500/[0.04] opacity-60'
                    : dream.is_top5
                    ? 'border-amber-500/15 bg-amber-500/[0.02] hover:border-amber-500/30'
                    : 'border-border-custom bg-surface hover:border-primary/20'
                }`}
              >
                <button
                  onClick={e => { e.stopPropagation(); toggleDream(dream); }}
                  className={`shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
                    dream.is_done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border-custom hover:border-primary'
                  }`}
                >
                  {dream.is_done && <Check size={9} strokeWidth={3} />}
                </button>
                <p className={`flex-1 text-[11px] font-semibold leading-snug min-w-0 truncate ${dream.is_done ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                  {dream.title}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  {dream.is_top5 && !dream.is_done && <Star size={8} className="text-amber-500" fill="currentColor" />}
                  {dream.description && <span className="w-1 h-1 rounded-full bg-primary/40" />}
                  {projectByDreamId[dream.id] && (
                    <span className="text-[7px] font-black uppercase tracking-widest text-primary/60 border border-primary/20 rounded px-1 py-0.5">
                      proj
                    </span>
                  )}
                  <span className={`text-[7px] font-black uppercase tracking-widest ${DREAM_CAT_COLOR[dream.category] || 'text-text-muted'}`}>
                    {dream.category}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteDream(dream.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress bar */}
        {dreams.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border-custom">
            <div className="flex justify-between text-[8px] font-bold text-text-muted uppercase tracking-widest">
              <span>{doneDreams} zrealizowanych</span>
              <span>{dreams.length} / 200</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border-custom overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min((dreams.length / 200) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
