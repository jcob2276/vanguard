import { Pressable, ControlInput } from '../../ui/ControlPrimitives';
import { Plus, X, Sparkles, ImageIcon, Type } from 'lucide-react';
import { Card } from '../../ui/Card';
import { Panel } from '../shell/Panel';
import { ToggleChip } from '../../ui/ToggleChip';
import type { Tables } from '../../../lib/database.types';

interface VBColor {
  bg: string;
  text: string;
  border: string;
}

interface VisionBoardPanelProps {
  visionItems: Tables<'vision_board_items'>[];
  isAddingVision: boolean;
  setIsAddingVision: React.Dispatch<React.SetStateAction<boolean>>;
  newVisionType: string;
  setNewVisionType: (v: string) => void;
  newVisionColor: string;
  setNewVisionColor: (v: string) => void;
  newVisionContent: string;
  setNewVisionContent: (v: string) => void;
  addVisionItem: () => void;
  deleteVisionItem: (id: string) => void;
  VB_COLORS: Record<string, VBColor>;
}

export default function VisionBoardPanel({
  visionItems,
  isAddingVision,
  setIsAddingVision,
  newVisionType,
  setNewVisionType,
  newVisionColor,
  setNewVisionColor,
  newVisionContent,
  setNewVisionContent,
  addVisionItem,
  deleteVisionItem,
  VB_COLORS,
}: VisionBoardPanelProps) {
  return (
    <Panel title="">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xs font-black uppercase tracking-[var(--legacy-arbitrary-039)] text-text-muted">Wizualizacja</p>
            <p className="mt-0.5 font-display text-base font-black tracking-tight text-text-primary leading-none">
              Vision Board
              <span className="ml-2 text-xs font-bold text-text-muted">{visionItems.length} elementów</span>
            </p>
          </div>
          <Pressable
            variant="tonal"
            size="sm"
            onClick={() => setIsAddingVision(p => !p)}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-2xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
            icon={<Plus size={11} />}
          >
            Dodaj
          </Pressable>
        </div>

        {/* Add form */}
        {isAddingVision && (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3.5 space-y-2.5">
            {/* Type selector */}
            <div className="flex gap-1.5">
              {[
                { v: 'affirmation', label: 'Afirmacja', icon: <Sparkles size={10} /> },
                { v: 'image',       label: 'Obraz (URL)', icon: <ImageIcon size={10} /> },
                { v: 'word',        label: 'Słowo',    icon: <Type size={10} /> },
              ].map(({ v, label, icon }) => (
                <ToggleChip key={v} active={newVisionType === v} onClick={() => setNewVisionType(v)}>
                  {icon} {label}
                </ToggleChip>
              ))}
            </div>
            {/* Color selector */}
            <div className="flex gap-1.5 items-center">
              <span className="text-2xs font-black uppercase tracking-widest text-text-muted">Kolor:</span>
              {Object.keys(VB_COLORS).map(c => (
                <Pressable
                  key={c}
                  onClick={() => setNewVisionColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${VB_COLORS[c].bg} ${newVisionColor === c ? 'border-primary scale-125' : 'border-transparent hover:scale-110'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <ControlInput
                autoFocus
                value={newVisionContent}
                onChange={e => setNewVisionContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addVisionItem()}
                placeholder={newVisionType === 'image' ? 'URL obrazka...' : newVisionType === 'word' ? 'Jedno słowo...' : 'Afirmacja: Jestem...'}
                className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-sm font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
              />
              <Pressable variant="primary" size="sm" onClick={addVisionItem} className="rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-primary/90 transition-all cursor-pointer">
                Dodaj
              </Pressable>
              <Pressable variant="ghost" size="sm" onClick={() => setIsAddingVision(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer" icon={<X size={13} />} />
            </div>
          </div>
        )}

        {/* Board grid */}
        {visionItems.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Sparkles size={20} className="mx-auto text-text-muted/30" />
            <p className="text-xs text-text-muted/50">Dodaj afirmacje, obrazy i słowa które cię inspirują</p>
          </div>
        ) : (
          <div className="columns-2 gap-2 space-y-0">
            {visionItems.map(item => {
              const c = VB_COLORS[item.color] || VB_COLORS.indigo;
              return (
                <div key={item.id} className="group relative break-inside-avoid mb-2">
                  {item.type === 'image' ? (
                    <Card variant="glass" padding="0" className="rounded-xl relative overflow-hidden">
                      <img
                        src={item.content}
                        alt=""
                        className="w-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <Pressable
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] flex h-6 w-6 items-center justify-center rounded-full bg-scrim/50 text-on-accent transition-all cursor-pointer"
                        icon={<X size={10} />}
                      />
                    </Card>
                  ) : item.type === 'word' ? (
                    <Card variant="glass" padding="1.25rem 1rem" className={`rounded-xl relative flex items-center justify-center ${c.border} ${c.bg}`}>
                      <p className={`font-display text-2xl font-black tracking-tight ${c.text} text-center`}>{item.content}</p>
                      <Pressable
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] p-0.5 text-text-muted/40 hover:text-danger transition-all cursor-pointer"
                        icon={<X size={10} />}
                      />
                    </Card>
                  ) : (
                    <Card variant="glass" padding="1rem 0.875rem" className={`rounded-xl relative ${c.border} ${c.bg}`}>
                      <p className={`text-sm font-bold leading-snug ${c.text}`}>{item.content}</p>
                      <Pressable
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-[var(--opacity-0)] group-hover:opacity-[var(--opacity-100)] p-0.5 text-text-muted/40 hover:text-danger transition-all cursor-pointer"
                        icon={<X size={10} />}
                      />
                    </Card>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}
