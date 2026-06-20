import { User } from 'lucide-react';

interface MirrorStepProps {
  declaration: string;
  onNext: () => void;
}

export default function MirrorStep({ declaration, onNext }: MirrorStepProps) {
  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="flex-1 flex flex-col justify-center text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <User size={24} />
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-xl font-black tracking-tight uppercase font-display">
            KROK 2: IDŹ DO LUSTRA
          </h3>
          <p className="text-[14px] text-text-secondary leading-relaxed max-w-[280px] mx-auto">
            Spójrz na siebie i powiedz na głos najważniejsze zdanie z Twojej deklaracji tożsamości:
          </p>
          <div className="py-4.5 px-5 border-l-4 border-primary/50 bg-primary/[0.03] dark:bg-primary/[0.05] rounded-r-2xl max-w-sm mx-auto my-4 text-left shadow-sm">
            <p className="font-display text-[15px] font-black text-text-primary leading-relaxed italic">
              "{declaration || 'Jestem twórcą swojego życia.'}"
            </p>
          </div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">
            Wypowiedz to z pewnością, bez szukania dowodów.
          </p>
        </div>
      </div>
      <button
        onClick={onNext}
        className="w-full py-4 rounded-full bg-primary text-white font-black text-sm uppercase tracking-widest active:scale-98 transition-all cursor-pointer"
      >
        Wypowiedziane! 🗣️
      </button>
    </div>
  );
}
