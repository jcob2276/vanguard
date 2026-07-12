import { Plus, X, Sparkles, ImageIcon, Type } from 'lucide-react';
import { Panel } from '../shell/Panel';
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
            <p className="text-[8px] font-black uppercase tracking-[0.25em] text-text-muted">Wizualizacja</p>
            <p className="mt-0.5 font-display text-[15px] font-black tracking-tight text-text-primary leading-none">
              Vision Board
              <span className="ml-2 text-[11px] font-bold text-text-muted">{visionItems.length} elementów</span>
            </p>
          </div>
          <button
            onClick={() => setIsAddingVision(p => !p)}
            className="flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <Plus size={11} /> Dodaj
          </button>
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
                <button
                  key={v}
                  onClick={() => setNewVisionType(v)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    newVisionType === v ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border-custom text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Color selector */}
            <div className="flex gap-1.5 items-center">
              <span className="text-[8px] font-black uppercase tracking-widest text-text-muted">Kolor:</span>
              {Object.keys(VB_COLORS).map(c => (
                <button
                  key={c}
                  onClick={() => setNewVisionColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-all cursor-pointer ${VB_COLORS[c].bg} ${newVisionColor === c ? 'border-primary scale-125' : 'border-transparent hover:scale-110'}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={newVisionContent}
                onChange={e => setNewVisionContent(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addVisionItem()}
                placeholder={newVisionType === 'image' ? 'URL obrazka...' : newVisionType === 'word' ? 'Jedno słowo...' : 'Afirmacja: Jestem...'}
                className="flex-1 rounded-xl border border-border-custom bg-surface px-3.5 py-2 text-[12px] font-semibold text-text-primary outline-none focus:border-primary placeholder:text-text-muted/40"
              />
              <button onClick={addVisionItem} className="rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-primary/90 transition-all cursor-pointer">
                Dodaj
              </button>
              <button onClick={() => setIsAddingVision(false)} className="rounded-xl border border-border-custom px-3 py-2 text-text-muted hover:text-text-primary cursor-pointer">
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        {/* Board grid */}
        {visionItems.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Sparkles size={20} className="mx-auto text-text-muted/30" />
            <p className="text-[11px] text-text-muted/50">Dodaj afirmacje, obrazy i słowa które cię inspirują</p>
          </div>
        ) : (
          <div className="columns-2 gap-2 space-y-0">
            {visionItems.map(item => {
              const c = VB_COLORS[item.color] || VB_COLORS.indigo;
              return (
                <div key={item.id} className="group relative break-inside-avoid mb-2">
                  {item.type === 'image' ? (
                    <div className="relative overflow-hidden rounded-[14px] border border-border-custom bg-surface">
                      <img
                        src={item.content}
                        alt=""
                        className="w-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <button
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : item.type === 'word' ? (
                    <div className={`relative flex items-center justify-center rounded-[14px] border ${c.border} ${c.bg} px-4 py-5`}>
                      <p className={`font-display text-[22px] font-black tracking-tight ${c.text} text-center`}>{item.content}</p>
                      <button
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <div className={`relative rounded-[14px] border ${c.border} ${c.bg} px-3.5 py-4`}>
                      <p className={`text-[12px] font-bold leading-snug ${c.text}`}>{item.content}</p>
                      <button
                        onClick={() => deleteVisionItem(item.id)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-text-muted/40 hover:text-rose-500 transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
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
