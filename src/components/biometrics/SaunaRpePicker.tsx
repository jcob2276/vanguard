import Button from '../ui/Button';

interface SaunaRpePickerProps {
  sessionRpe: number | null;
  setSessionRpe: (rpe: number | null) => void;
}

export default function SaunaRpePicker({ sessionRpe, setSessionRpe }: SaunaRpePickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-2xs font-black uppercase tracking-widest text-text-secondary">RPE sesji</label>
        {sessionRpe && (
          <Button variant="ghost" onClick={() => setSessionRpe(null)} className="p-0 min-w-0 text-2xs text-text-muted hover:bg-transparent hover:text-text-muted">wyczyść</Button>
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
          const active = sessionRpe === n ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105' : 'opacity-[var(--opacity-80)]';
          return (
            <Button
              key={n}
              variant="ghost"
              onClick={() => setSessionRpe(sessionRpe === n ? null : n)}
              className={`rounded-lg border py-2 text-xs font-black min-w-0 p-0 hover:bg-transparent ${color} ${active}`}
            >
              {n}
            </Button>
          );
        })}
      </div>
      <p className="text-2xs text-text-muted">
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
