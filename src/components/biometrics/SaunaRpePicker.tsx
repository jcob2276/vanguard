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
              ? 'border-info/30 text-info bg-info/8'
              : n <= 6
                ? 'border-warning/35 text-warning bg-warning/8'
                : n <= 8
                  ? 'border-warning/35 text-warning bg-warning/8'
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
