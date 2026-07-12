interface SaunaRpePickerProps {
  sessionRpe: number | null;
  setSessionRpe: (rpe: number | null) => void;
}

export default function SaunaRpePicker({ sessionRpe, setSessionRpe }: SaunaRpePickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[9px] font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
        {sessionRpe && (
          <button type="button" onClick={() => setSessionRpe(null)} className="text-[9px] text-text-muted cursor-pointer">wyczyść</button>
        )}
      </div>
      <div className="grid grid-cols-10 gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
          const color =
            n <= 4
              ? 'border-sky-500/30 text-sky-650 bg-sky-500/8'
              : n <= 6
                ? 'border-yellow-500/35 text-yellow-600 bg-yellow-500/8'
                : n <= 8
                  ? 'border-orange-500/35 text-orange-600 bg-orange-500/8'
                  : 'border-dayB/35 text-dayB bg-dayB/8';
          const active = sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' : 'opacity-80';
          return (
            <button
              key={n}
              type="button"
              onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
              className={`rounded-lg border py-2 text-[11px] font-black transition-all cursor-pointer ${color} ${active}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="text-[9px] text-text-muted">
        {sessionRpe
          ? sessionRpe <= 4
            ? 'Lekko — dużo rezerwy'
            : sessionRpe <= 6
              ? 'Umiarkowanie'
              : sessionRpe <= 8
                ? 'Ciężko — mało rezerwy'
                : 'Maksymalnie'
          : 'Jak intensywnie była sesja?'}
      </p>
    </div>
  );
}
