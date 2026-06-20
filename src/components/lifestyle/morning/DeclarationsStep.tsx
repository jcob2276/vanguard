import { useState } from 'react';
import { BookOpen, Check, Edit, Trash2, Plus } from 'lucide-react';
import { useHaptics } from '../../../hooks/useHaptics';

interface DeclarationsStepProps {
  declarations: string[];
  onUpdateDeclarations: (decs: string[]) => Promise<void>;
  onNext: () => void;
}

export default function DeclarationsStep({
  declarations,
  onUpdateDeclarations,
  onNext,
}: DeclarationsStepProps) {
  const haptics = useHaptics();
  const [editingDeclarations, setEditingDeclarations] = useState(false);
  const [newDeclarationText, setNewDeclarationText] = useState('');
  const [localDecs, setLocalDecs] = useState<string[]>(declarations);

  // Sync local status when entering edit mode
  const startEditing = () => {
    setLocalDecs(declarations);
    setEditingDeclarations(true);
    haptics.light();
  };

  const saveChanges = async () => {
    setEditingDeclarations(false);
    await onUpdateDeclarations(localDecs);
    haptics.success();
  };

  const removeDeclaration = (idx: number) => {
    setLocalDecs((prev) => prev.filter((_, i) => i !== idx));
  };

  const addDeclaration = () => {
    if (newDeclarationText.trim() === '') return;
    setLocalDecs((prev) => [...prev, newDeclarationText.trim()]);
    setNewDeclarationText('');
    haptics.light();
  };

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="space-y-5 flex-1 flex flex-col overflow-hidden">
        <header className="text-center space-y-1.5 shrink-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <BookOpen size={20} />
          </div>
          <h3 className="font-display text-lg font-black tracking-tight uppercase mt-2">
            KROK 4: DEKLARACJE TOŻSAMOŚCI
          </h3>
          <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
            Odczytaj na głos z pełnym zaangażowaniem
          </p>
        </header>

        {/* Declarations Scrollable List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[300px]">
          {editingDeclarations ? (
            <div className="space-y-3">
              {localDecs.map((dec, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-surface p-2.5 rounded-xl border border-border-custom">
                  <textarea
                    value={dec}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalDecs((prev) => prev.map((d, i) => (i === idx ? val : d)));
                    }}
                    className="flex-1 bg-transparent text-xs text-text-primary outline-none resize-none"
                    rows={2}
                  />
                  <button
                    onClick={() => removeDeclaration(idx)}
                    className="text-red-400 hover:text-red-500 p-1 cursor-pointer"
                    title="Usuń"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <div className="border-t border-border-custom/50 pt-3 space-y-2">
                <p className="text-[9px] uppercase font-bold text-text-muted">Dodaj nową deklarację:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDeclarationText}
                    onChange={(e) => setNewDeclarationText(e.target.value)}
                    placeholder="Jestem..."
                    className="flex-1 rounded-xl border border-border-custom bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-primary"
                  />
                  <button
                    onClick={addDeclaration}
                    className="rounded-xl bg-primary px-3 text-white cursor-pointer"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {declarations.map((dec, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 items-start p-3 bg-surface border border-border-custom/50 rounded-2xl shadow-sm hover:border-border-custom transition-all"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-black font-display mt-0.5">
                    {idx + 1}
                  </div>
                  <p className="text-xs leading-relaxed text-text-primary font-medium">{dec}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Edit Trigger Button */}
        <div className="shrink-0 flex justify-end">
          {editingDeclarations ? (
            <button
              onClick={saveChanges}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full cursor-pointer"
            >
              <Check size={12} />
              <span>Zapisz zmiany</span>
            </button>
          ) : (
            <button
              onClick={startEditing}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-secondary bg-surface p-2 rounded-full border border-border-custom/80 cursor-pointer"
            >
              <Edit size={11} />
              <span>Edytuj deklaracje</span>
            </button>
          )}
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={editingDeclarations}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed mt-4 active:scale-98 transition-all cursor-pointer"
      >
        Odczytane! 📖
      </button>
    </div>
  );
}
