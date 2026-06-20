import { Sparkles } from 'lucide-react';

interface LightsStepProps {
  mainIntention: string;
  lightsAnswer: string;
  setLightsAnswer: (val: string) => void;
  onComplete: () => void;
}

export default function LightsStep({
  mainIntention,
  lightsAnswer,
  setLightsAnswer,
  onComplete,
}: LightsStepProps) {
  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-[0_8px_20px_rgba(245,158,11,0.1)] animate-pulse">
          <Sparkles size={26} fill="currentColor" />
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-xl font-black tracking-tight uppercase">
            ĆWICZENIE: ZMIANA ŚWIATEŁ
          </h3>
          <div className="bg-surface border border-amber-500/20 rounded-2xl p-4.5 max-w-sm mx-auto text-left shadow-sm">
            <p className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Intencja główna:</p>
            <p className="mt-1 font-display text-[15px] font-black text-text-primary leading-snug">
              {mainIntention}
            </p>
          </div>

          <p className="text-xs text-text-secondary leading-relaxed max-w-[280px] mx-auto pt-2">
            Zadaj sobie pytanie i wpisz odpowiedź:
          </p>
          <p className="font-display text-[13.5px] font-black text-text-primary italic leading-snug max-w-[280px] mx-auto">
            "Jakie nowe ekscytujące możliwości otworzą się przede mną, gdy to zrealizuję?"
          </p>

          <textarea
            value={lightsAnswer}
            onChange={(e) => setLightsAnswer(e.target.value)}
            placeholder="Wyobraź to sobie tak, jakby to JUŻ BYŁO WYKONANE. Poczuj to fizycznie na ciele (gęsia skórka, motyle w brzuchu). Wpisz co czujesz..."
            rows={4}
            className="w-full max-w-sm mx-auto rounded-xl border border-border-custom bg-surface p-4 text-xs text-text-primary outline-none focus:border-amber-500 resize-none leading-relaxed mt-2"
          />

          <p className="text-[9px] uppercase font-bold text-text-muted leading-relaxed max-w-[240px] mx-auto mt-2">
            Celem jest połączenie neuro-aktywacji z wyrzutem dopaminy w Twoim ciele.
          </p>
        </div>
      </div>

      <button
        onClick={onComplete}
        disabled={lightsAnswer.trim().length < 5}
        className="w-full py-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-sm uppercase tracking-widest disabled:opacity-40 disabled:from-gray-500 disabled:to-gray-500 mt-4 shadow-lg shadow-amber-500/10 active:scale-98 transition-all cursor-pointer"
      >
        Zakończ i Zwyciężaj! 🏆
      </button>
    </div>
  );
}
