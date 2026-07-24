import React from 'react';
import { triggerHaptic } from '../../lib/native/haptics';

interface Props {
  onSelectAction: (actionText: string) => void;
  onToggleFood: () => void;
  onToggleMore: () => void;
  showMore: boolean;
  showFoodCard: boolean;
}

const MORE_KEYS = [
  { id: 'tarcie', label: '⚡ Tarcie', text: 'Tarcie: ' },
  { id: 'post', label: '⌛ Post', text: 'Posiłek: Post' },
  { id: 'wywiad', label: '💬 Wywiad', text: 'Wywiad' },
  { id: 'end', label: '🔚 Koniec dnia', text: 'Koniec dnia' },
];

export default function TelegramBottomKeyboard({
  onSelectAction,
  onToggleFood,
  onToggleMore,
  showMore,
  showFoodCard,
}: Props) {
  return (
    <div className="px-3 pt-2 pb-3 bg-[#1F2937]/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl border-t border-white/10 space-y-1.5 font-sans z-30">
      {/* Expanded More Buttons Grid */}
      {showMore && (
        <div className="grid grid-cols-2 gap-1.5 pb-1 border-b border-white/10">
          {MORE_KEYS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                void triggerHaptic();
                onSelectAction(k.text);
              }}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-2xs text-center border border-white/10"
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {/* Main 2 Rows */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => {
            void triggerHaptic();
            onSelectAction('Zadanie: ');
          }}
          className="py-2.5 px-2 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-xs font-semibold shadow-2xs text-center border border-white/10 transition-all active:scale-95"
        >
          + Zadanie
        </button>

        <button
          type="button"
          onClick={() => {
            void triggerHaptic();
            onToggleFood();
          }}
          className={`py-2.5 px-2 rounded-2xl text-xs font-semibold shadow-2xs text-center border transition-all active:scale-95 ${
            showFoodCard
              ? 'bg-[#20B2AA] text-white border-[#20B2AA]'
              : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white border-white/10'
          }`}
        >
          🍽️ Posiłek
        </button>

        <button
          type="button"
          onClick={() => {
            void triggerHaptic();
            onSelectAction('Notatka: ');
          }}
          className="py-2.5 px-2 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-xs font-semibold shadow-2xs text-center border border-white/10 transition-all active:scale-95"
        >
          📝 Notatka
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            void triggerHaptic();
            onSelectAction('Suplement: ');
          }}
          className="py-2.5 px-3 rounded-2xl bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white text-xs font-semibold shadow-2xs text-center border border-white/10 transition-all active:scale-95"
        >
          💊 Suplement
        </button>

        <button
          type="button"
          onClick={() => {
            void triggerHaptic();
            onToggleMore();
          }}
          className={`py-2.5 px-3 rounded-2xl text-xs font-semibold shadow-2xs text-center border transition-all active:scale-95 ${
            showMore
              ? 'bg-[#20B2AA] text-white border-[#20B2AA]'
              : 'bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white border-white/10'
          }`}
        >
          ••• Więcej
        </button>
      </div>
    </div>
  );
}
