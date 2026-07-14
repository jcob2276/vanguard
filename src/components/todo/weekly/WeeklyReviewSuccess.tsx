import React from 'react';
import { Sparkles } from 'lucide-react';

export default function WeeklyReviewSuccess() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 animate-fadeIn">
      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-3xl shadow-lg shadow-[var(--shadow-glow-primary)]/5">
        <Sparkles />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-black text-text-primary uppercase tracking-wider">
          System oczyszczony!
        </h2>
        <p className="text-sm text-text-muted">
          TwĂłj Tygodniowy PrzeglÄ…d ZadaĹ„ zostaĹ‚ zakoĹ„czony. Masz teraz peĹ‚nÄ… jasnoĹ›Ä‡ umysĹ‚u oraz zdefiniowane prognozy.
        </p>
      </div>
    </div>
  );
}
