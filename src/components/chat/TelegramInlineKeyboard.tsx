import React from 'react';
import { triggerHaptic } from '../../lib/native/haptics';

interface Props {
  onSelectAction: (action: string) => void;
}

const INLINE_BUTTONS = [
  { id: 'lenie', label: '🛏️ Lenie', text: 'Tarcie: Lenie / Prokrastynacja' },
  { id: 'post', label: '⌛ Post', text: 'Posiłek: Post / Fasting' },
  { id: 'dieta', label: '🍽️ Dieta', text: 'Posiłek: ' },
  { id: 'wywiad', label: '💬 Wywiad', text: 'Wywiad' },
];

export default function TelegramInlineKeyboard({ onSelectAction }: Props) {
  return (
    <div className="w-full max-w-sm my-2 p-2 rounded-2xl bg-black/30 backdrop-blur-md border border-white/10 space-y-1.5 shadow-md">
      <div className="grid grid-cols-2 gap-1.5">
        {INLINE_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => {
              void triggerHaptic();
              onSelectAction(btn.text);
            }}
            className="py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-xs text-center border border-white/10"
          >
            {btn.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => {
          void triggerHaptic();
          onSelectAction('Koniec dnia');
        }}
        className="w-full py-2 px-3 rounded-xl bg-[#8B4513]/70 hover:bg-[#8B4513]/90 text-white text-xs font-semibold backdrop-blur-md transition-all shadow-xs text-center border border-white/10 flex items-center justify-center gap-1.5"
      >
        <span>🔚 Koniec dnia</span>
      </button>
    </div>
  );
}
